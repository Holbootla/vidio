//! The Vidio HTTP API binary.
//!
//! Wires the in-memory repository adapters, the SSRF-safe add-on client and the
//! use-case services into the Axum router, then serves it. The in-memory
//! adapters are the initial storage; a PostgreSQL adapter is the next step.

mod config;

use std::sync::Arc;

use addon_runtime::{AddonClient, AddonClientConfig, HttpAddonClient, UrlPolicy};
use application::services::AuthConfig;
use application::{Clock, DiscoveryConfig, SystemClock};
use config::Config;
use http_api::{build_router, ApiConfig, AppState};
use persistence::InMemoryRepositories;

#[tokio::main]
async fn main() {
    telemetry::init();

    if let Err(error) = run().await {
        tracing::error!(%error, "fatal error");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::from_env().map_err(|e| e.to_string())?;

    let repos = InMemoryRepositories::new();
    let clock: Arc<dyn Clock> = Arc::new(SystemClock);

    let policy = UrlPolicy {
        allow_private_networks: config.addon_allow_private_networks,
    };
    let client_config = AddonClientConfig {
        timeout: config.addon_timeout,
        max_response_bytes: config.addon_max_response_bytes,
        max_redirects: 3,
        user_agent: concat!("vidio/", env!("CARGO_PKG_VERSION")).to_string(),
        policy: policy.clone(),
    };
    let client: Arc<dyn AddonClient> = Arc::new(HttpAddonClient::new(client_config)?);

    let api_config = ApiConfig {
        access_token_secret: config.access_token_secret,
        auth: AuthConfig {
            access_ttl: time::Duration::seconds(config.access_ttl.as_secs() as i64),
            refresh_ttl: time::Duration::seconds(config.refresh_ttl.as_secs() as i64),
        },
        discovery: DiscoveryConfig::default(),
        addon_policy: policy,
    };

    let state = AppState::new(&repos, client, clock, api_config);
    let router = build_router(state);

    let listener = tokio::net::TcpListener::bind(&config.bind_addr).await?;
    tracing::info!(addr = %config.bind_addr, "vidio-api listening");

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

/// Resolves on Ctrl-C or `SIGTERM`, enabling graceful shutdown.
///
/// Containers (Docker, Fly.io, Kubernetes) send `SIGTERM` on stop/rollout, so
/// both signals must be handled for clean in-flight request draining.
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
