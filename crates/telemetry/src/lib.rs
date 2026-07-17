//! Telemetry initialization for tracing and structured logging.
//!
//! Reads the `RUST_LOG` environment variable for filtering, falling back to
//! `info`. Call [`init`] once at process startup.

#![forbid(unsafe_code)]

use tracing_subscriber::{fmt, EnvFilter};

/// Initializes the global tracing subscriber (idempotent; safe to call once).
///
/// Emits compact human-readable logs by default. Set `RUST_LOG` to control
/// verbosity, e.g. `RUST_LOG=debug` or `RUST_LOG=vidio_api=debug,info`.
pub fn init() {
    init_with("info");
}

/// Like [`init`] but with an explicit default filter directive.
pub fn init_with(default_directive: &str) {
    let filter =
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(default_directive));
    // `try_init` returns an error if a subscriber is already set; ignore it so
    // tests and repeated calls do not panic.
    let _ = fmt().with_env_filter(filter).with_target(true).try_init();
}
