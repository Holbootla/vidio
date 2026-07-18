//! The Vidio background worker binary.
//!
//! Placeholder skeleton for scheduled background work (manifest refresh, cache
//! warming, session/token cleanup, notification dispatch). These jobs require
//! the shared PostgreSQL storage adapter (the next milestone); until then this
//! binary runs a heartbeat loop and shuts down gracefully.

use std::time::Duration;

#[tokio::main]
async fn main() {
    telemetry::init();
    tracing::info!("vidio-worker started");

    let mut ticker = tokio::time::interval(Duration::from_secs(60));
    loop {
        tokio::select! {
            _ = ticker.tick() => {
                tracing::debug!("worker heartbeat: no shared storage configured yet");
            }
            _ = shutdown_signal() => {
                break;
            }
        }
    }
}

/// Resolves on Ctrl-C or `SIGTERM`, enabling graceful shutdown in containers.
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};
        match signal(SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(error) => tracing::warn!(%error, "failed to install SIGTERM handler"),
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received");
}
