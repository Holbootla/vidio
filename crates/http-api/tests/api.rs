//! Integration tests exercising the HTTP API end-to-end via `oneshot`.

use std::sync::Arc;

use application::services::AuthConfig;
use application::{Clock, DiscoveryConfig, SystemClock};
use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::Router;
use http_api::{build_router, ApiConfig, AppState};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use tower::ServiceExt;

const MANIFEST_URL: &str = "https://addon.example.com/manifest.json";

fn manifest_json() -> String {
    json!({
        "id": "org.vidio.example",
        "version": "1.0.0",
        "name": "Example Add-on",
        "types": ["movie"],
        "catalogs": [{ "type": "movie", "id": "top" }],
        "resources": [
            "catalog",
            { "name": "stream", "types": ["movie"], "idPrefixes": ["tt"] }
        ]
    })
    .to_string()
}

fn build_app(client: Arc<addon_runtime::MockAddonClient>) -> Router {
    let repos = persistence::InMemoryRepositories::new();
    let clock: Arc<dyn Clock> = Arc::new(SystemClock);
    let client: Arc<dyn addon_runtime::AddonClient> = client;
    let config = ApiConfig {
        access_token_secret: b"test-signing-secret-please-change".to_vec(),
        auth: AuthConfig::default(),
        discovery: DiscoveryConfig::default(),
        addon_policy: addon_runtime::UrlPolicy::secure(),
    };
    build_router(AppState::new(&repos, client, clock, config))
}

fn app() -> Router {
    build_app(Arc::new(addon_runtime::MockAddonClient::new()))
}

async fn send(app: &Router, request: Request<Body>) -> (StatusCode, Value) {
    let response = app.clone().oneshot(request).await.unwrap();
    let status = response.status();
    let bytes = response.into_body().collect().await.unwrap().to_bytes();
    let value: Value = if bytes.is_empty() {
        Value::Null
    } else {
        serde_json::from_slice(&bytes).unwrap_or(Value::Null)
    };
    (status, value)
}

fn json_post(uri: &str, body: Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

async fn register_and_login(app: &Router) -> String {
    let (status, _) = send(
        app,
        json_post(
            "/v1/auth/register",
            json!({ "email": "user@example.com", "password": "sup3r-secret-pw" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);

    let (status, body) = send(
        app,
        json_post(
            "/v1/auth/login",
            json!({ "email": "user@example.com", "password": "sup3r-secret-pw" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    body["access_token"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn health_returns_ok() {
    let app = app();
    let (status, body) = send(
        &app,
        Request::builder()
            .uri("/health")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn register_then_login_yields_access_token() {
    let app = app();
    let token = register_and_login(&app).await;
    assert!(!token.is_empty());
}

#[tokio::test]
async fn register_response_omits_password_hash() {
    let app = app();
    let (status, body) = send(
        &app,
        json_post(
            "/v1/auth/register",
            json!({ "email": "secret@example.com", "password": "sup3r-secret-pw" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED);
    assert!(body["user"].get("password_hash").is_none());
    assert_eq!(body["user"]["email"], "secret@example.com");
}

#[tokio::test]
async fn protected_route_requires_token() {
    let app = app();

    let (status, body) = send(
        &app,
        Request::builder()
            .uri("/v1/profiles")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    // RFC 9457 problem document.
    assert_eq!(body["status"], 401);
    assert!(body.get("title").is_some());

    let token = register_and_login(&app).await;
    let (status, body) = send(
        &app,
        Request::builder()
            .uri("/v1/profiles")
            .header("authorization", format!("Bearer {token}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body.as_array().unwrap().len() == 1);
}

#[tokio::test]
async fn me_returns_current_user_without_secrets() {
    let app = app();
    let token = register_and_login(&app).await;
    let (status, body) = send(
        &app,
        Request::builder()
            .uri("/v1/me")
            .header("authorization", format!("Bearer {token}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["email"], "user@example.com");
    assert!(body.get("password_hash").is_none());
}

async fn default_profile_id(app: &Router, token: &str) -> String {
    let (status, body) = send(
        app,
        Request::builder()
            .uri("/v1/profiles")
            .header("authorization", format!("Bearer {token}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    body[0]["id"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn install_addon_omits_transport_url_and_manifest_snapshot() {
    let client = Arc::new(addon_runtime::MockAddonClient::new());
    client.insert(MANIFEST_URL, manifest_json());
    let app = build_app(client);

    let token = register_and_login(&app).await;
    let profile_id = default_profile_id(&app, &token).await;

    let request = Request::builder()
        .method("POST")
        .uri(format!("/v1/profiles/{profile_id}/addons"))
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", "application/json")
        .body(Body::from(
            json!({ "transport_url": MANIFEST_URL }).to_string(),
        ))
        .unwrap();
    let (status, body) = send(&app, request).await;

    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(body["manifest_id"], "org.vidio.example");
    assert_eq!(body["name"], "Example Add-on");
    assert!(body.get("transport_url").is_none(), "leaked transport_url");
    assert!(
        body.get("manifest_snapshot").is_none(),
        "leaked manifest_snapshot"
    );
    assert!(body.get("capabilities").is_some());
}

#[tokio::test]
async fn home_returns_rows_array() {
    let client = Arc::new(addon_runtime::MockAddonClient::new());
    client.insert(MANIFEST_URL, manifest_json());
    let app = build_app(client);

    let token = register_and_login(&app).await;
    let profile_id = default_profile_id(&app, &token).await;

    let (status, body) = send(
        &app,
        Request::builder()
            .uri(format!("/v1/profiles/{profile_id}/home"))
            .header("authorization", format!("Bearer {token}"))
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(body["rows"].is_array());
    assert!(body["warnings"].is_array());
}

#[tokio::test]
async fn unknown_route_returns_404() {
    let app = app();
    let (status, _) = send(
        &app,
        Request::builder()
            .uri("/v1/does-not-exist")
            .body(Body::empty())
            .unwrap(),
    )
    .await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn malformed_json_body_returns_4xx() {
    let app = app();
    let request = Request::builder()
        .method("POST")
        .uri("/v1/auth/register")
        .header("content-type", "application/json")
        .body(Body::from("{ not valid json"))
        .unwrap();
    let response = app.oneshot(request).await.unwrap();
    assert!(response.status().is_client_error());
}

#[tokio::test]
async fn weak_password_is_unprocessable() {
    let app = app();
    let (status, body) = send(
        &app,
        json_post(
            "/v1/auth/register",
            json!({ "email": "weak@example.com", "password": "short" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(body["status"], 422);
}
