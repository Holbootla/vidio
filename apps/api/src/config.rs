use std::env;
use std::time::Duration;

/// Runtime configuration for the API binary, sourced from environment variables.
pub struct Config {
    pub bind_addr: String,
    pub access_token_secret: Vec<u8>,
    pub access_ttl: Duration,
    pub refresh_ttl: Duration,
    pub addon_timeout: Duration,
    pub addon_max_response_bytes: usize,
    pub addon_allow_private_networks: bool,
}

/// A fixed, obviously-insecure secret used only when none is configured.
const DEV_SECRET: &str = "insecure-dev-secret-change-me-0000000000000000";

impl Config {
    /// Loads configuration from the environment, applying safe defaults.
    ///
    /// Returns an error only for values that are present but malformed.
    pub fn from_env() -> Result<Self, String> {
        let bind_addr = env_or("VIDIO_BIND_ADDR", "0.0.0.0:8080");

        let access_token_secret = match env::var("VIDIO_ACCESS_TOKEN_SECRET") {
            Ok(secret) if secret.len() >= 32 => secret.into_bytes(),
            Ok(_) => return Err("VIDIO_ACCESS_TOKEN_SECRET must be at least 32 bytes".into()),
            Err(_) => {
                tracing::warn!(
                    "VIDIO_ACCESS_TOKEN_SECRET is not set; using an INSECURE development secret. \
                     Set a strong secret in production."
                );
                DEV_SECRET.as_bytes().to_vec()
            }
        };

        Ok(Self {
            bind_addr,
            access_token_secret,
            access_ttl: Duration::from_secs(parse_env("VIDIO_ACCESS_TOKEN_TTL_SECS", 900)?),
            refresh_ttl: Duration::from_secs(parse_env("VIDIO_REFRESH_TOKEN_TTL_SECS", 2_592_000)?),
            addon_timeout: Duration::from_millis(parse_env("VIDIO_ADDON_FETCH_TIMEOUT_MS", 8_000)?),
            addon_max_response_bytes: parse_env("VIDIO_ADDON_MAX_RESPONSE_BYTES", 5 * 1024 * 1024)?,
            addon_allow_private_networks: parse_bool_env(
                "VIDIO_ADDON_ALLOW_PRIVATE_NETWORKS",
                false,
            )?,
        })
    }
}

fn env_or(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn parse_env<T>(key: &str, default: T) -> Result<T, String>
where
    T: std::str::FromStr,
{
    match env::var(key) {
        Ok(value) => value
            .parse::<T>()
            .map_err(|_| format!("invalid value for {key}")),
        Err(_) => Ok(default),
    }
}

fn parse_bool_env(key: &str, default: bool) -> Result<bool, String> {
    match env::var(key) {
        Ok(value) => match value.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Ok(true),
            "0" | "false" | "no" | "off" => Ok(false),
            _ => Err(format!("invalid boolean for {key}")),
        },
        Err(_) => Ok(default),
    }
}
