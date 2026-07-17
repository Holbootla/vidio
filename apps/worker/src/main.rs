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
            _ = tokio::signal::ctrl_c() => {
                tracing::info!("shutdown signal received");
                break;
            }
        }
    }
}
