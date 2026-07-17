mod support;

use application::AppError;
use support::Harness;

fn manifest_json(id: &str, name: &str) -> String {
    format!(
        r#"{{
            "id": "{id}",
            "version": "1.0.0",
            "name": "{name}",
            "types": ["movie"],
            "catalogs": [{{"type": "movie", "id": "top"}}],
            "resources": ["catalog", {{"name": "stream", "types": ["movie"], "idPrefixes": ["tt"]}}]
        }}"#
    )
}

#[tokio::test]
async fn install_parses_manifest_and_stores_capabilities() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let url = "https://addon.example.com/manifest.json";
    h.addon_client
        .insert(url, manifest_json("org.example", "Example"));

    let addons = h.addon();
    let installed = addons
        .install(user.user.id, user.profile.id, url)
        .await
        .unwrap();

    assert_eq!(installed.manifest_id, "org.example");
    assert_eq!(installed.name, "Example");
    assert!(installed.enabled);
    assert_eq!(installed.priority, 0);
    assert!(installed.capabilities.supports_resource("stream"));
    assert!(installed.capabilities.supports_type("movie"));
}

#[tokio::test]
async fn duplicate_install_is_conflict() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let url = "https://addon.example.com/manifest.json";
    h.addon_client
        .insert(url, manifest_json("org.example", "Example"));
    let addons = h.addon();

    addons
        .install(user.user.id, user.profile.id, url)
        .await
        .unwrap();
    let again = addons.install(user.user.id, user.profile.id, url).await;
    assert!(matches!(again, Err(AppError::Conflict(_))));
}

#[tokio::test]
async fn install_rejects_ssrf_url() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let addons = h.addon();
    let result = addons
        .install(
            user.user.id,
            user.profile.id,
            "https://169.254.169.254/manifest.json",
        )
        .await;
    assert!(matches!(result, Err(AppError::Validation(_))));
}

#[tokio::test]
async fn enable_disable_and_remove() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let url = "https://addon.example.com/manifest.json";
    h.addon_client
        .insert(url, manifest_json("org.example", "Example"));
    let addons = h.addon();
    let installed = addons
        .install(user.user.id, user.profile.id, url)
        .await
        .unwrap();

    let disabled = addons
        .set_enabled(user.user.id, user.profile.id, installed.id, false)
        .await
        .unwrap();
    assert!(!disabled.enabled);

    addons
        .remove(user.user.id, user.profile.id, installed.id)
        .await
        .unwrap();
    let list = addons.list(user.user.id, user.profile.id).await.unwrap();
    assert!(list.is_empty());
}

#[tokio::test]
async fn reorder_assigns_priorities_by_index() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let url_a = "https://a.example.com/manifest.json";
    let url_b = "https://b.example.com/manifest.json";
    h.addon_client.insert(url_a, manifest_json("org.a", "A"));
    h.addon_client.insert(url_b, manifest_json("org.b", "B"));
    let addons = h.addon();

    let a = addons
        .install(user.user.id, user.profile.id, url_a)
        .await
        .unwrap();
    let b = addons
        .install(user.user.id, user.profile.id, url_b)
        .await
        .unwrap();
    assert_eq!(a.priority, 0);
    assert_eq!(b.priority, 1);

    let reordered = addons
        .reorder(user.user.id, user.profile.id, &[b.id, a.id])
        .await
        .unwrap();
    assert_eq!(reordered[0].id, b.id);
    assert_eq!(reordered[0].priority, 0);
    assert_eq!(reordered[1].id, a.id);
    assert_eq!(reordered[1].priority, 1);
}

#[tokio::test]
async fn refresh_updates_snapshot() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let url = "https://addon.example.com/manifest.json";
    h.addon_client
        .insert(url, manifest_json("org.example", "Old Name"));
    let addons = h.addon();
    let installed = addons
        .install(user.user.id, user.profile.id, url)
        .await
        .unwrap();
    assert_eq!(installed.name, "Old Name");

    h.addon_client
        .insert(url, manifest_json("org.example", "New Name"));
    let refreshed = addons
        .refresh(user.user.id, user.profile.id, installed.id)
        .await
        .unwrap();
    assert_eq!(refreshed.name, "New Name");
}

#[tokio::test]
async fn cross_user_cannot_install() {
    let h = Harness::new();
    let auth = h.auth();
    let owner = auth
        .register("owner@example.com", "supersecret", None)
        .await
        .unwrap();
    let other = auth
        .register("other@example.com", "supersecret", None)
        .await
        .unwrap();
    let url = "https://addon.example.com/manifest.json";
    h.addon_client
        .insert(url, manifest_json("org.example", "Example"));

    let result = h
        .addon()
        .install(other.user.id, owner.profile.id, url)
        .await;
    assert!(matches!(result, Err(AppError::Forbidden(_))));
}
