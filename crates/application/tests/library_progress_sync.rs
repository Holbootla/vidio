mod support;

use application::services::{AddLibraryItem, ProgressUpdate};
use domain::{MediaKey, MediaType};
use support::Harness;
use time::Duration;

fn library_item(content_id: &str, name: &str) -> AddLibraryItem {
    AddLibraryItem {
        content_type: "movie".to_string(),
        content_id: content_id.to_string(),
        manifest_id: "org.example".to_string(),
        name: name.to_string(),
        poster: Some("https://cdn.example.com/p.jpg".to_string()),
        meta_snapshot: None,
    }
}

#[tokio::test]
async fn add_list_and_remove_library_items() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let lib = h.library();

    let entry = lib
        .add(user.user.id, user.profile.id, library_item("tt1", "Film"))
        .await
        .unwrap();
    assert_eq!(entry.name, "Film");
    assert!(!entry.removed);

    let listed = lib.list(user.user.id, user.profile.id).await.unwrap();
    assert_eq!(listed.len(), 1);

    lib.remove(user.user.id, user.profile.id, &entry.media_key)
        .await
        .unwrap();
    let after = lib.list(user.user.id, user.profile.id).await.unwrap();
    assert!(after.is_empty());
}

#[tokio::test]
async fn removing_missing_item_is_idempotent() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let key = MediaKey::from_content(&MediaType::Movie, "org.example", "tt404").unwrap();
    assert!(h
        .library()
        .remove(user.user.id, user.profile.id, &key)
        .await
        .is_ok());
}

#[tokio::test]
async fn progress_update_and_continue_watching() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let progress = h.progress();

    let update = ProgressUpdate {
        content_type: "movie".to_string(),
        video_id: "tt1".to_string(),
        media_id: "tt1".to_string(),
        manifest_id: "org.example".to_string(),
        position_secs: 300.0,
        duration_secs: 6000.0,
        watched: None,
        device_id: None,
    };
    let recorded = progress
        .update(user.user.id, user.profile.id, update)
        .await
        .unwrap();
    assert_eq!(recorded.revision, 1);
    assert!(recorded.is_in_progress());

    let cw = progress
        .continue_watching(user.user.id, user.profile.id, 10)
        .await
        .unwrap();
    assert_eq!(cw.len(), 1);
}

#[tokio::test]
async fn finished_item_leaves_continue_watching() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let progress = h.progress();

    let update = ProgressUpdate {
        content_type: "movie".to_string(),
        video_id: "tt1".to_string(),
        media_id: "tt1".to_string(),
        manifest_id: "org.example".to_string(),
        position_secs: 5900.0,
        duration_secs: 6000.0,
        watched: None,
        device_id: None,
    };
    let recorded = progress
        .update(user.user.id, user.profile.id, update)
        .await
        .unwrap();
    assert!(recorded.watched);

    let cw = progress
        .continue_watching(user.user.id, user.profile.id, 10)
        .await
        .unwrap();
    assert!(cw.is_empty());
    let history = progress
        .history(user.user.id, user.profile.id, 10)
        .await
        .unwrap();
    assert_eq!(history.len(), 1);
}

#[tokio::test]
async fn invalid_progress_is_rejected() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let update = ProgressUpdate {
        content_type: "movie".to_string(),
        video_id: "tt1".to_string(),
        media_id: "tt1".to_string(),
        manifest_id: "org.example".to_string(),
        position_secs: 9999.0,
        duration_secs: 100.0,
        watched: None,
        device_id: None,
    };
    let result = h
        .progress()
        .update(user.user.id, user.profile.id, update)
        .await;
    assert!(matches!(result, Err(application::AppError::Validation(_))));
}

#[tokio::test]
async fn sync_feed_accumulates_changes_across_services() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();

    h.library()
        .add(user.user.id, user.profile.id, library_item("tt1", "Film"))
        .await
        .unwrap();
    h.clock.advance(Duration::seconds(1));
    h.progress()
        .update(
            user.user.id,
            user.profile.id,
            ProgressUpdate {
                content_type: "movie".to_string(),
                video_id: "tt1".to_string(),
                media_id: "tt1".to_string(),
                manifest_id: "org.example".to_string(),
                position_secs: 60.0,
                duration_secs: 6000.0,
                watched: None,
                device_id: None,
            },
        )
        .await
        .unwrap();

    let page = h
        .sync()
        .pull(user.user.id, user.profile.id, 0, 100)
        .await
        .unwrap();
    assert_eq!(page.changes.len(), 2);
    assert_eq!(page.latest_sequence, 2);
    assert!(!page.has_more);

    // Incremental pull from the first cursor returns only the newer change.
    let incremental = h
        .sync()
        .pull(user.user.id, user.profile.id, 1, 100)
        .await
        .unwrap();
    assert_eq!(incremental.changes.len(), 1);
    assert_eq!(incremental.changes[0].sequence, 2);
}

#[tokio::test]
async fn sync_paging_reports_has_more() {
    let h = Harness::new();
    let user = h
        .auth()
        .register("user@example.com", "supersecret", None)
        .await
        .unwrap();
    let lib = h.library();
    for i in 0..3 {
        h.clock.advance(Duration::seconds(1));
        lib.add(
            user.user.id,
            user.profile.id,
            library_item(&format!("tt{i}"), "Film"),
        )
        .await
        .unwrap();
    }

    let page = h
        .sync()
        .pull(user.user.id, user.profile.id, 0, 2)
        .await
        .unwrap();
    assert_eq!(page.changes.len(), 2);
    assert!(page.has_more);
    assert_eq!(page.latest_sequence, 3);
}
