//! HTTP API layer: the Axum router, DTOs, extractors and error mapping.
//!
//! This crate exposes the vidio backend over HTTP. It maps use-case services
//! from the `application` crate onto REST endpoints, translating
//! [`application::AppError`] into RFC 9457 `application/problem+json` responses
//! and shielding secret domain fields behind response DTOs.

#![forbid(unsafe_code)]

pub mod dto;
pub mod error;
pub mod extract;
pub mod routes;
pub mod state;

pub use error::{ApiError, ApiResult};
pub use state::{ApiConfig, AppState};

use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

/// Builds the fully-wired application router with tracing and permissive CORS.
pub fn build_router(state: AppState) -> axum::Router {
    routes::routes()
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive())
        .with_state(state)
}
