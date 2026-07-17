use addon_runtime::RuntimeError;
use auth::AuthError;
use domain::DomainError;
use thiserror::Error;

/// Errors returned by repository ports (infrastructure boundary).
#[derive(Debug, Error)]
pub enum RepoError {
    #[error("entity not found")]
    NotFound,
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("storage backend error: {0}")]
    Backend(String),
}

/// The application-level error type surfaced by use-case services.
///
/// HTTP mapping (in the `http-api` crate): `Validation` -> 400/422,
/// `Unauthorized` -> 401, `Forbidden` -> 403, `NotFound` -> 404,
/// `Conflict` -> 409, `Upstream` -> 502, `Internal` -> 500.
#[derive(Debug, Error)]
pub enum AppError {
    #[error("validation error: {0}")]
    Validation(String),
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    #[error("forbidden: {0}")]
    Forbidden(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("upstream add-on error: {0}")]
    Upstream(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation(message.into())
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::NotFound(message.into())
    }
    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::Forbidden(message.into())
    }
    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict(message.into())
    }
}

pub type AppResult<T> = Result<T, AppError>;

impl From<DomainError> for AppError {
    fn from(err: DomainError) -> Self {
        match err {
            DomainError::Validation(m) => AppError::Validation(m),
            DomainError::InvalidTransition(m) => AppError::Conflict(m),
        }
    }
}

impl From<RepoError> for AppError {
    fn from(err: RepoError) -> Self {
        match err {
            RepoError::NotFound => AppError::NotFound("entity not found".into()),
            RepoError::Conflict(m) => AppError::Conflict(m),
            RepoError::Backend(m) => AppError::Internal(m),
        }
    }
}

impl From<AuthError> for AppError {
    fn from(err: AuthError) -> Self {
        match err {
            AuthError::InvalidCredentials => AppError::Unauthorized("invalid credentials".into()),
            AuthError::TokenExpired => AppError::Unauthorized("token expired".into()),
            AuthError::TokenInvalid => AppError::Unauthorized("invalid token".into()),
            AuthError::WeakPassword(m) => AppError::Validation(m),
            AuthError::Hashing(m) => AppError::Internal(m),
        }
    }
}

impl From<RuntimeError> for AppError {
    fn from(err: RuntimeError) -> Self {
        match err {
            RuntimeError::InvalidUrl(m) | RuntimeError::Blocked(m) => AppError::Validation(m),
            other => AppError::Upstream(other.to_string()),
        }
    }
}
