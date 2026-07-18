use thiserror::Error;

/// Errors raised by the add-on runtime while validating URLs or fetching data.
#[derive(Debug, Error)]
pub enum RuntimeError {
    /// The URL is syntactically invalid.
    #[error("invalid url: {0}")]
    InvalidUrl(String),
    /// The URL targets a disallowed destination (SSRF protection).
    #[error("blocked url: {0}")]
    Blocked(String),
    /// DNS resolution failed.
    #[error("dns resolution failed: {0}")]
    Dns(String),
    /// The upstream did not respond in time.
    #[error("request timed out")]
    Timeout,
    /// A transport-level error occurred.
    #[error("transport error: {0}")]
    Transport(String),
    /// The upstream returned a non-success status code.
    #[error("upstream returned status {0}")]
    UpstreamStatus(u16),
    /// The response exceeded the configured size limit.
    #[error("response exceeded size limit")]
    TooLarge,
    /// The response body could not be decoded.
    #[error("failed to decode response: {0}")]
    Decode(String),
}

pub type RuntimeResult<T> = Result<T, RuntimeError>;
