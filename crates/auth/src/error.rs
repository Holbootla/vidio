//! Error types for the `auth` crate.

/// Errors that can occur while performing authentication primitives.
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    /// A password hashing or verification operation failed for a reason
    /// unrelated to an actual credential mismatch.
    #[error("password hashing failed: {0}")]
    Hashing(String),

    /// The provided credentials did not match.
    #[error("invalid credentials")]
    InvalidCredentials,

    /// The provided password did not meet strength requirements.
    #[error("weak password: {0}")]
    WeakPassword(String),

    /// A token could not be decoded or its signature was invalid.
    #[error("token is invalid")]
    TokenInvalid,

    /// A token was well-formed but has expired.
    #[error("token has expired")]
    TokenExpired,
}

/// Convenience result type used throughout the crate.
pub type AuthResult<T> = Result<T, AuthError>;
