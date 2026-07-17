mod support;

use application::ports::ChangeRepository;
use application::AppError;
use domain::{ProfileId, ProfilePreferences};
use support::Harness;

#[tokio::test]
async fn get_returns_owned_profile() {
    let h = Harness::new();
    let auth = h.auth();
    let profiles = h.profile();
    let outcome = auth
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();

    let fetched = profiles
        .get(outcome.user.id, outcome.profile.id)
        .await
        .unwrap();
    assert_eq!(fetched.id, outcome.profile.id);
}

#[tokio::test]
async fn cross_user_access_is_forbidden() {
    let h = Harness::new();
    let auth = h.auth();
    let profiles = h.profile();
    let owner = auth
        .register("owner@example.com", "supersecret", None)
        .await
        .unwrap();
    let other = auth
        .register("other@example.com", "supersecret", None)
        .await
        .unwrap();

    let result = profiles.get(other.user.id, owner.profile.id).await;
    assert!(matches!(result, Err(AppError::Forbidden(_))));
}

#[tokio::test]
async fn missing_profile_is_not_found() {
    let h = Harness::new();
    let auth = h.auth();
    let profiles = h.profile();
    let user = auth
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let result = profiles.get(user.user.id, ProfileId::new()).await;
    assert!(matches!(result, Err(AppError::NotFound(_))));
}

#[tokio::test]
async fn rename_and_update_preferences_bump_version() {
    let h = Harness::new();
    let auth = h.auth();
    let profiles = h.profile();
    let user = auth
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();

    let renamed = profiles
        .rename(user.user.id, user.profile.id, "Living Room")
        .await
        .unwrap();
    assert_eq!(renamed.name, "Living Room");
    assert!(renamed.version > user.profile.version);

    let prefs = ProfilePreferences {
        subtitle_languages: vec!["en".to_string(), "es".to_string()],
        ..ProfilePreferences::default()
    };
    let updated = profiles
        .update_preferences(user.user.id, user.profile.id, prefs.clone())
        .await
        .unwrap();
    assert_eq!(
        updated.preferences.subtitle_languages,
        prefs.subtitle_languages
    );
    assert!(updated.version > renamed.version);

    // Changes are recorded in the sync feed.
    let seq = h
        .repos
        .changes
        .latest_sequence(user.profile.id)
        .await
        .unwrap();
    assert!(seq >= 2);
}
