use crate::error::{RuntimeError, RuntimeResult};
use crate::security::{guard_url, resolve_allowed_addrs, UrlPolicy};
use async_trait::async_trait;
use std::time::Duration;
use url::Url;

/// Configuration for the HTTP add-on client.
#[derive(Debug, Clone)]
pub struct AddonClientConfig {
    pub timeout: Duration,
    pub max_response_bytes: usize,
    pub max_redirects: usize,
    pub user_agent: String,
    pub policy: UrlPolicy,
}

impl Default for AddonClientConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(8),
            max_response_bytes: 5 * 1024 * 1024,
            max_redirects: 3,
            user_agent: concat!("vidio/", env!("CARGO_PKG_VERSION")).to_string(),
            policy: UrlPolicy::secure(),
        }
    }
}

/// Fetches raw resource bodies from add-ons. Abstracted as a trait so the
/// application layer can be tested without any network access.
#[async_trait]
pub trait AddonClient: Send + Sync {
    /// Fetches the response body at `url` as a UTF-8 string, applying all
    /// configured limits and SSRF guards.
    async fn get(&self, url: &Url) -> RuntimeResult<String>;
}

/// A production [`AddonClient`] backed by `reqwest` with SSRF protections.
pub struct HttpAddonClient {
    http: reqwest::Client,
    config: AddonClientConfig,
}

impl HttpAddonClient {
    pub fn new(config: AddonClientConfig) -> RuntimeResult<Self> {
        let http = reqwest::Client::builder()
            .timeout(config.timeout)
            .redirect(reqwest::redirect::Policy::none())
            .user_agent(config.user_agent.clone())
            .https_only(!config.policy.allow_private_networks)
            .build()
            .map_err(|e| RuntimeError::Transport(e.to_string()))?;
        Ok(Self { http, config })
    }

    async fn validate_destination(&self, url: &Url) -> RuntimeResult<()> {
        guard_url(url, &self.config.policy)?;
        if let Some(host) = url.host_str() {
            // IP-literal hosts were already validated by `guard_url`; resolving
            // a domain here also rejects DNS rebinding to internal ranges.
            let port = url.port_or_known_default().unwrap_or(443);
            resolve_allowed_addrs(host, port, &self.config.policy).await?;
        }
        Ok(())
    }
}

fn map_reqwest_error(err: reqwest::Error) -> RuntimeError {
    if err.is_timeout() {
        RuntimeError::Timeout
    } else {
        RuntimeError::Transport(err.to_string())
    }
}

#[async_trait]
impl AddonClient for HttpAddonClient {
    async fn get(&self, url: &Url) -> RuntimeResult<String> {
        let mut current = url.clone();

        for _ in 0..=self.config.max_redirects {
            self.validate_destination(&current).await?;

            let response = self
                .http
                .get(current.clone())
                .send()
                .await
                .map_err(map_reqwest_error)?;

            let status = response.status();
            if status.is_redirection() {
                let location = response
                    .headers()
                    .get(reqwest::header::LOCATION)
                    .and_then(|v| v.to_str().ok())
                    .ok_or_else(|| RuntimeError::Transport("redirect without location".into()))?;
                current = current
                    .join(location)
                    .map_err(|e| RuntimeError::InvalidUrl(e.to_string()))?;
                continue;
            }

            if !status.is_success() {
                return Err(RuntimeError::UpstreamStatus(status.as_u16()));
            }

            return read_body_limited(response, self.config.max_response_bytes).await;
        }

        Err(RuntimeError::Blocked("too many redirects".into()))
    }
}

/// Reads a response body, enforcing a hard byte limit while streaming.
async fn read_body_limited(mut response: reqwest::Response, limit: usize) -> RuntimeResult<String> {
    // Reject early when the advertised length already exceeds the limit.
    if let Some(len) = response.content_length() {
        if len as usize > limit {
            return Err(RuntimeError::TooLarge);
        }
    }

    let mut buf: Vec<u8> = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(map_reqwest_error)? {
        if buf.len() + chunk.len() > limit {
            return Err(RuntimeError::TooLarge);
        }
        buf.extend_from_slice(&chunk);
    }

    String::from_utf8(buf).map_err(|e| RuntimeError::Decode(e.to_string()))
}

#[cfg(feature = "mock")]
mod mock {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    /// An in-memory [`AddonClient`] mapping URLs to canned responses, for tests.
    #[derive(Default)]
    pub struct MockAddonClient {
        responses: Mutex<HashMap<String, Result<String, String>>>,
    }

    impl MockAddonClient {
        pub fn new() -> Self {
            Self::default()
        }

        /// Registers a successful response body for an exact URL.
        pub fn insert(&self, url: impl Into<String>, body: impl Into<String>) {
            self.responses
                .lock()
                .unwrap()
                .insert(url.into(), Ok(body.into()));
        }

        /// Registers a transport error for an exact URL.
        pub fn insert_error(&self, url: impl Into<String>, message: impl Into<String>) {
            self.responses
                .lock()
                .unwrap()
                .insert(url.into(), Err(message.into()));
        }
    }

    #[async_trait]
    impl AddonClient for MockAddonClient {
        async fn get(&self, url: &Url) -> RuntimeResult<String> {
            let responses = self.responses.lock().unwrap();
            match responses.get(url.as_str()) {
                Some(Ok(body)) => Ok(body.clone()),
                Some(Err(message)) => Err(RuntimeError::Transport(message.clone())),
                None => Err(RuntimeError::UpstreamStatus(404)),
            }
        }
    }
}

#[cfg(feature = "mock")]
pub use mock::MockAddonClient;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_secure() {
        let config = AddonClientConfig::default();
        assert!(!config.policy.allow_private_networks);
        assert_eq!(config.max_response_bytes, 5 * 1024 * 1024);
    }

    #[test]
    fn client_builds() {
        assert!(HttpAddonClient::new(AddonClientConfig::default()).is_ok());
    }

    #[tokio::test]
    async fn mock_client_returns_registered_body() {
        let client = MockAddonClient::new();
        client.insert("https://addon.example.com/manifest.json", "{\"ok\":true}");
        let url = Url::parse("https://addon.example.com/manifest.json").unwrap();
        assert_eq!(client.get(&url).await.unwrap(), "{\"ok\":true}");
    }

    #[tokio::test]
    async fn mock_client_missing_url_is_404() {
        let client = MockAddonClient::new();
        let url = Url::parse("https://addon.example.com/missing.json").unwrap();
        assert!(matches!(
            client.get(&url).await,
            Err(RuntimeError::UpstreamStatus(404))
        ));
    }

    #[tokio::test]
    async fn http_client_blocks_ssrf_before_request() {
        let client = HttpAddonClient::new(AddonClientConfig::default()).unwrap();
        let url = Url::parse("https://169.254.169.254/manifest.json").unwrap();
        assert!(matches!(
            client.get(&url).await,
            Err(RuntimeError::Blocked(_))
        ));
    }
}
