use thiserror::Error;

/// Errors raised while parsing manifests/responses or building request URLs.
#[derive(Debug, Error)]
pub enum ProtocolError {
    #[error("invalid manifest: {0}")]
    InvalidManifest(String),
    #[error("failed to decode JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid transport url: {0}")]
    InvalidTransportUrl(String),
    #[error("invalid resource request: {0}")]
    InvalidRequest(String),
}

pub type ProtocolResult<T> = Result<T, ProtocolError>;
