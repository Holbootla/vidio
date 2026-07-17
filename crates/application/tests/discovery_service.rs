mod support;

use application::AppError;
use support::Harness;

const MANIFEST: &str = r#"{
    "id": "org.example",
    "version": "1.0.0",
    "name": "Example",
    "types": ["movie"],
    "catalogs": [
        {"type": "movie", "id": "top", "name": "Top Movies"},
        {"type": "movie", "id": "find", "name": "Search", "extra": [{"name": "search", "isRequired": true}]}
    ],
    "resources": ["catalog", "meta"]
}"#;

async fn setup() -> (Harness, domain::UserId, domain::ProfileId) {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    h.addon_client
        .insert("https://addon.example.com/manifest.json", MANIFEST);
    h.addon()
        .install(
            user.user.id,
            user.profile.id,
            "https://addon.example.com/manifest.json",
        )
        .await
        .unwrap();
    (h, user.user.id, user.profile.id)
}

#[tokio::test]
async fn home_aggregates_default_catalogs_only() {
    let (h, user_id, profile_id) = setup().await;
    h.addon_client.insert(
        "https://addon.example.com/catalog/movie/top.json",
        r#"{"metas":[{"id":"tt1","type":"movie","name":"Film One"}]}"#,
    );

    let response = h.discovery().home(user_id, profile_id).await.unwrap();
    assert_eq!(response.rows.len(), 1);
    assert_eq!(response.rows[0].title, "Top Movies");
    assert_eq!(response.rows[0].items.len(), 1);
    assert!(response.warnings.is_empty());
}

#[tokio::test]
async fn home_reports_warning_for_failing_addon() {
    let (h, user_id, profile_id) = setup().await;
    // No catalog response registered -> the mock returns 404 -> warning, no rows.
    let response = h.discovery().home(user_id, profile_id).await.unwrap();
    assert!(response.rows.is_empty());
    assert_eq!(response.warnings.len(), 1);
}

#[tokio::test]
async fn search_uses_search_capable_catalogs() {
    let (h, user_id, profile_id) = setup().await;
    h.addon_client.insert(
        "https://addon.example.com/catalog/movie/find/search=matrix.json",
        r#"{"metas":[{"id":"tt2","type":"movie","name":"The Matrix"}]}"#,
    );

    let response = h
        .discovery()
        .search(user_id, profile_id, "matrix")
        .await
        .unwrap();
    assert_eq!(response.rows.len(), 1);
    assert_eq!(response.rows[0].items[0].name, "The Matrix");
}

#[tokio::test]
async fn empty_search_is_rejected() {
    let (h, user_id, profile_id) = setup().await;
    let result = h.discovery().search(user_id, profile_id, "   ").await;
    assert!(matches!(result, Err(AppError::Validation(_))));
}

#[tokio::test]
async fn resolve_meta_returns_first_capable() {
    let (h, user_id, profile_id) = setup().await;
    h.addon_client.insert(
        "https://addon.example.com/meta/movie/tt1.json",
        r#"{"meta":{"id":"tt1","type":"movie","name":"Film One","description":"desc"}}"#,
    );

    let meta = h
        .discovery()
        .resolve_meta(user_id, profile_id, "movie", "tt1")
        .await
        .unwrap();
    assert_eq!(meta.name, "Film One");
    assert_eq!(meta.description.as_deref(), Some("desc"));
}

#[tokio::test]
async fn resolve_meta_not_found_without_response() {
    let (h, user_id, profile_id) = setup().await;
    let result = h
        .discovery()
        .resolve_meta(user_id, profile_id, "movie", "tt999")
        .await;
    assert!(matches!(result, Err(AppError::NotFound(_))));
}
