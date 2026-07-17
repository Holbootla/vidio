//! HTTP error type mapping [`application::AppError`] to RFC 9457 responses.

use application::AppError;
use axum::http::{header, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Serialize;

/// Wraps an [`AppError`] so it can be rendered as an HTTP problem response.
#[derive(Debug)]
pub struct ApiError(pub AppError);

/// Convenience result alias for handlers.
pub type ApiResult<T> = Result<T, ApiError>;

impl From<AppError> for ApiError {
    fn from(err: AppError) -> Self {
        Self(err)
    }
}

/// An RFC 9457 `application/problem+json` payload.
#[derive(Debug, Serialize)]
struct ProblemJson {
    #[serde(rename = "type")]
    type_uri: &'static str,
    title: &'static str,
    status: u16,
    detail: String,
}

impl ApiError {
    fn parts(&self) -> (StatusCode, &'static str, &'static str) {
        match &self.0 {
            AppError::Validation(_) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "/errors/validation",
                "Validation failed",
            ),
            AppError::Unauthorized(_) => (
                StatusCode::UNAUTHORIZED,
                "/errors/unauthorized",
                "Unauthorized",
            ),
            AppError::Forbidden(_) => (StatusCode::FORBIDDEN, "/errors/forbidden", "Forbidden"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "/errors/not-found", "Not found"),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "/errors/conflict", "Conflict"),
            AppError::Upstream(_) => (
                StatusCode::BAD_GATEWAY,
                "/errors/upstream",
                "Upstream add-on error",
            ),
            AppError::Internal(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "/errors/internal",
                "Internal server error",
            ),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, type_uri, title) = self.parts();
        let body = ProblemJson {
            type_uri,
            title,
            status: status.as_u16(),
            detail: self.0.to_string(),
        };
        let payload = serde_json::to_vec(&body).unwrap_or_else(|_| b"{}".to_vec());
        (
            status,
            [(header::CONTENT_TYPE, "application/problem+json")],
            payload,
        )
            .into_response()
    }
}
