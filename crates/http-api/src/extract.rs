//! Request extractors, notably bearer-token authentication.

use application::{AppError, AuthContext};
use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;

use crate::error::ApiError;
use crate::state::AppState;

/// The authenticated principal, extracted from a `Bearer` access token.
pub struct AuthUser(pub AuthContext);

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| {
                ApiError::from(AppError::Unauthorized(
                    "missing authorization header".into(),
                ))
            })?;

        let token = header.strip_prefix("Bearer ").ok_or_else(|| {
            ApiError::from(AppError::Unauthorized(
                "authorization header must be a bearer token".into(),
            ))
        })?;

        let ctx = state.auth.verify_access_token(token.trim())?;
        Ok(AuthUser(ctx))
    }
}
