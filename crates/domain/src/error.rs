use thiserror::Error;

/// Errors produced when a domain invariant is violated.
///
/// These are pure validation/consistency errors; infrastructure failures
/// (database, network) belong to outer layers.
#[derive(Debug, Error, PartialEq, Eq, Clone)]
pub enum DomainError {
    #[error("validation error: {0}")]
    Validation(String),
    #[error("invalid state transition: {0}")]
    InvalidTransition(String),
}

impl DomainError {
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation(message.into())
    }

    pub fn invalid_transition(message: impl Into<String>) -> Self {
        Self::InvalidTransition(message.into())
    }
}

/// Convenience alias for domain operations that can fail validation.
pub type DomainResult<T> = Result<T, DomainError>;
