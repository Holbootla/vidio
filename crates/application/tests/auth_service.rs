mod support;

use application::services::DeviceInfo;
use application::AppError;
use support::Harness;

#[tokio::test]
async fn register_creates_user_and_default_profile() {
    let h = Harness::new();
    let svc = h.auth();
    let outcome = svc
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    assert_eq!(outcome.user.email.as_str(), "user@example.com");
    assert!(outcome.profile.is_default);
}

#[tokio::test]
async fn register_rejects_duplicate_email_and_weak_password() {
    let h = Harness::new();
    let svc = h.auth();
    svc.register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let dup = svc.register("USER@example.com", "supersecret", None).await;
    assert!(matches!(dup, Err(AppError::Conflict(_))));
    let weak = svc.register("other@example.com", "short", None).await;
    assert!(matches!(weak, Err(AppError::Validation(_))));
}

#[tokio::test]
async fn login_succeeds_and_token_verifies() {
    let h = Harness::new();
    let svc = h.auth();
    svc.register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let tokens = svc
        .login("user@example.com", "supersecret", DeviceInfo::default())
        .await
        .unwrap();
    let ctx = svc.verify_access_token(&tokens.access_token).unwrap();
    assert_eq!(ctx.user_id, tokens.user_id);
    assert_eq!(ctx.session_id, tokens.session_id);
}

#[tokio::test]
async fn login_rejects_bad_credentials() {
    let h = Harness::new();
    let svc = h.auth();
    svc.register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    assert!(matches!(
        svc.login("user@example.com", "wrongpass", DeviceInfo::default())
            .await,
        Err(AppError::Unauthorized(_))
    ));
    assert!(matches!(
        svc.login("nobody@example.com", "supersecret", DeviceInfo::default())
            .await,
        Err(AppError::Unauthorized(_))
    ));
}

#[tokio::test]
async fn refresh_rotates_and_issues_new_tokens() {
    let h = Harness::new();
    let svc = h.auth();
    svc.register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let first = svc
        .login("user@example.com", "supersecret", DeviceInfo::default())
        .await
        .unwrap();
    let second = svc
        .refresh(&first.refresh_token, DeviceInfo::default())
        .await
        .unwrap();
    assert_ne!(first.refresh_token, second.refresh_token);
    assert!(svc.verify_access_token(&second.access_token).is_ok());
}

#[tokio::test]
async fn refresh_reuse_is_detected_and_revokes_family() {
    let h = Harness::new();
    let svc = h.auth();
    svc.register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let first = svc
        .login("user@example.com", "supersecret", DeviceInfo::default())
        .await
        .unwrap();
    let second = svc
        .refresh(&first.refresh_token, DeviceInfo::default())
        .await
        .unwrap();

    let reuse = svc
        .refresh(&first.refresh_token, DeviceInfo::default())
        .await;
    assert!(matches!(reuse, Err(AppError::Unauthorized(_))));

    let after = svc
        .refresh(&second.refresh_token, DeviceInfo::default())
        .await;
    assert!(matches!(after, Err(AppError::Unauthorized(_))));
}

#[tokio::test]
async fn logout_revokes_refresh_token() {
    let h = Harness::new();
    let svc = h.auth();
    svc.register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let tokens = svc
        .login("user@example.com", "supersecret", DeviceInfo::default())
        .await
        .unwrap();
    svc.logout(&tokens.refresh_token).await.unwrap();
    let after = svc
        .refresh(&tokens.refresh_token, DeviceInfo::default())
        .await;
    assert!(matches!(after, Err(AppError::Unauthorized(_))));
}

#[tokio::test]
async fn tampered_access_token_is_rejected() {
    let h = Harness::new();
    let svc = h.auth();
    svc.register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let tokens = svc
        .login("user@example.com", "supersecret", DeviceInfo::default())
        .await
        .unwrap();
    let tampered = format!("{}x", tokens.access_token);
    assert!(matches!(
        svc.verify_access_token(&tampered),
        Err(AppError::Unauthorized(_))
    ));
}
