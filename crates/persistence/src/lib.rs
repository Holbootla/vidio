//! Persistence adapters implementing the application repository ports.
//!
//! This crate provides thread-safe, in-memory reference implementations of
//! every repository port defined in the `application` crate. They are the
//! storage backend used for hermetic tests and local runs; a PostgreSQL
//! adapter is added separately.

#![forbid(unsafe_code)]

pub mod addons;
pub mod changes;
pub mod devices;
pub mod library;
pub mod profiles;
pub mod progress;
pub mod sessions;
pub mod users;

pub use addons::InMemoryAddonRepository;
pub use changes::InMemoryChangeRepository;
pub use devices::InMemoryDeviceRepository;
pub use library::InMemoryLibraryRepository;
pub use profiles::InMemoryProfileRepository;
pub use progress::InMemoryProgressRepository;
pub use sessions::InMemorySessionRepository;
pub use users::InMemoryUserRepository;

use std::sync::Arc;

/// A convenience bundle wiring up one shared instance of every in-memory
/// repository, ready to inject into the application's use-case services.
#[derive(Debug, Default, Clone)]
pub struct InMemoryRepositories {
    pub users: Arc<InMemoryUserRepository>,
    pub profiles: Arc<InMemoryProfileRepository>,
    pub devices: Arc<InMemoryDeviceRepository>,
    pub sessions: Arc<InMemorySessionRepository>,
    pub addons: Arc<InMemoryAddonRepository>,
    pub library: Arc<InMemoryLibraryRepository>,
    pub progress: Arc<InMemoryProgressRepository>,
    pub changes: Arc<InMemoryChangeRepository>,
}

impl InMemoryRepositories {
    pub fn new() -> Self {
        Self::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use application::models::{NewSyncChange, SyncResourceKind};
    use application::ports::{
        AddonRepository, ChangeRepository, DeviceRepository, LibraryRepository, ProfileRepository,
        ProgressRepository, SessionRepository, UserRepository,
    };
    use domain::{
        AddonCapabilities, AddonInstallation, DeviceId, EmailAddress, InstallationId, LibraryEntry,
        MediaKey, MediaType, PasswordHash, PlaybackProgress, Profile, ProfileId, Session,
        SessionId, User, UserId, VideoKey,
    };
    use time::{Duration, OffsetDateTime};

    fn epoch() -> OffsetDateTime {
        OffsetDateTime::UNIX_EPOCH
    }

    fn user_with_email(email: &str) -> User {
        User::register(
            UserId::new(),
            EmailAddress::parse(email).unwrap(),
            PasswordHash::from_encoded("hash"),
            epoch(),
        )
    }

    #[tokio::test]
    async fn user_create_find_and_duplicate_email_conflict() {
        let repo = InMemoryUserRepository::new();
        let user = user_with_email("alice@example.com");
        repo.create(&user).await.unwrap();

        // Same id is rejected.
        assert!(matches!(
            repo.create(&user).await,
            Err(application::RepoError::Conflict(_))
        ));

        // Different id but same email is rejected.
        let mut dup_email = user_with_email("alice@example.com");
        dup_email.id = UserId::new();
        assert!(matches!(
            repo.create(&dup_email).await,
            Err(application::RepoError::Conflict(_))
        ));

        let found = repo
            .find_by_email(&EmailAddress::parse("alice@example.com").unwrap())
            .await
            .unwrap();
        assert_eq!(found.unwrap().id, user.id);

        assert!(repo.find_by_id(user.id).await.unwrap().is_some());
        assert!(repo.find_by_id(UserId::new()).await.unwrap().is_none());
    }

    #[tokio::test]
    async fn user_update_requires_existing() {
        let repo = InMemoryUserRepository::new();
        let mut user = user_with_email("bob@example.com");
        assert!(matches!(
            repo.update(&user).await,
            Err(application::RepoError::NotFound)
        ));
        repo.create(&user).await.unwrap();
        user.verify(epoch()).unwrap();
        repo.update(&user).await.unwrap();
        assert_eq!(
            repo.find_by_id(user.id).await.unwrap().unwrap().status,
            domain::UserStatus::Active
        );
    }

    #[tokio::test]
    async fn profile_list_is_sorted_by_created_at_ascending() {
        let repo = InMemoryProfileRepository::new();
        let user_id = UserId::new();

        let mut first = Profile::new_default(ProfileId::new(), user_id, "First", epoch()).unwrap();
        first.created_at = epoch();
        let mut second =
            Profile::new_default(ProfileId::new(), user_id, "Second", epoch()).unwrap();
        second.created_at = epoch() + Duration::seconds(10);
        let other =
            Profile::new_default(ProfileId::new(), UserId::new(), "Other", epoch()).unwrap();

        // Insert out of order.
        repo.create(&second).await.unwrap();
        repo.create(&first).await.unwrap();
        repo.create(&other).await.unwrap();

        assert!(matches!(
            repo.create(&first).await,
            Err(application::RepoError::Conflict(_))
        ));

        let listed = repo.list_by_user(user_id).await.unwrap();
        let ids: Vec<ProfileId> = listed.iter().map(|p| p.id).collect();
        assert_eq!(ids, vec![first.id, second.id]);
    }

    #[tokio::test]
    async fn session_create_find_by_hash_and_revoke_all() {
        let repo = InMemorySessionRepository::new();
        let user_id = UserId::new();

        let make = |hash: &str| Session {
            id: SessionId::new(),
            user_id,
            device_id: DeviceId::new(),
            refresh_token_hash: hash.to_string(),
            issued_at: epoch(),
            expires_at: epoch() + Duration::days(30),
            revoked_at: None,
            rotated_to: None,
        };

        let s1 = make("hash-1");
        let s2 = make("hash-2");
        repo.create(&s1).await.unwrap();
        repo.create(&s2).await.unwrap();

        // Duplicate hash is rejected.
        let mut dup = make("hash-1");
        dup.id = SessionId::new();
        assert!(matches!(
            repo.create(&dup).await,
            Err(application::RepoError::Conflict(_))
        ));

        let found = repo.find_by_token_hash("hash-2").await.unwrap().unwrap();
        assert_eq!(found.id, s2.id);
        assert!(repo.find_by_token_hash("missing").await.unwrap().is_none());

        // A session belonging to another user should be untouched.
        let other = Session {
            user_id: UserId::new(),
            ..make("hash-other")
        };
        repo.create(&other).await.unwrap();

        let revoke_time = epoch() + Duration::hours(1);
        repo.revoke_all_for_user(user_id, revoke_time)
            .await
            .unwrap();

        assert_eq!(
            repo.find_by_id(s1.id).await.unwrap().unwrap().revoked_at,
            Some(revoke_time)
        );
        assert_eq!(
            repo.find_by_id(s2.id).await.unwrap().unwrap().revoked_at,
            Some(revoke_time)
        );
        assert_eq!(
            repo.find_by_id(other.id).await.unwrap().unwrap().revoked_at,
            None
        );
    }

    fn addon(
        profile_id: ProfileId,
        manifest_id: &str,
        priority: i32,
        installed: OffsetDateTime,
    ) -> AddonInstallation {
        AddonInstallation {
            id: InstallationId::new(),
            profile_id,
            manifest_id: manifest_id.to_string(),
            transport_url: "https://example.com/manifest.json".to_string(),
            name: manifest_id.to_string(),
            version: "1.0.0".to_string(),
            description: None,
            enabled: true,
            priority,
            capabilities: AddonCapabilities::default(),
            manifest_snapshot: "{}".to_string(),
            installed_at: installed,
            updated_at: installed,
        }
    }

    #[tokio::test]
    async fn addon_list_ordered_by_priority_and_find_by_manifest() {
        let repo = InMemoryAddonRepository::new();
        let profile_id = ProfileId::new();

        let low = addon(profile_id, "low", 0, epoch());
        let high = addon(profile_id, "high", 10, epoch());
        // Same priority, earlier install wins the tie-break.
        let tie_early = addon(profile_id, "tie-early", 5, epoch());
        let tie_late = addon(profile_id, "tie-late", 5, epoch() + Duration::seconds(5));
        let other_profile = addon(ProfileId::new(), "other", 0, epoch());

        for a in [&high, &tie_late, &low, &tie_early, &other_profile] {
            repo.create(a).await.unwrap();
        }

        let listed = repo.list_by_profile(profile_id).await.unwrap();
        let order: Vec<String> = listed.iter().map(|a| a.manifest_id.clone()).collect();
        assert_eq!(order, vec!["low", "tie-early", "tie-late", "high"]);

        let found = repo
            .find_by_manifest_id(profile_id, "high")
            .await
            .unwrap()
            .unwrap();
        assert_eq!(found.id, high.id);
        assert!(repo
            .find_by_manifest_id(profile_id, "nope")
            .await
            .unwrap()
            .is_none());

        repo.delete(low.id).await.unwrap();
        assert!(repo.find_by_id(low.id).await.unwrap().is_none());
        // Deleting a missing id is a no-op.
        repo.delete(low.id).await.unwrap();
    }

    #[tokio::test]
    async fn library_list_respects_include_removed_and_ordering() {
        let repo = InMemoryLibraryRepository::new();
        let profile_id = ProfileId::new();

        let key_a = MediaKey::from_content(&MediaType::Movie, "a", "tt1").unwrap();
        let key_b = MediaKey::from_content(&MediaType::Movie, "a", "tt2").unwrap();

        let mut kept =
            LibraryEntry::new(profile_id, key_a.clone(), MediaType::Movie, "Kept", epoch());
        kept.updated_at = epoch() + Duration::seconds(5);
        let mut removed = LibraryEntry::new(
            profile_id,
            key_b.clone(),
            MediaType::Movie,
            "Removed",
            epoch(),
        );
        removed.mark_removed(epoch() + Duration::seconds(10));

        repo.upsert(&kept).await.unwrap();
        repo.upsert(&removed).await.unwrap();

        assert_eq!(
            repo.get(profile_id, &key_a).await.unwrap().unwrap().name,
            "Kept"
        );

        let visible = repo.list(profile_id, false).await.unwrap();
        assert_eq!(visible.len(), 1);
        assert_eq!(visible[0].media_key, key_a);

        // Including removed entries, they are sorted by updated_at descending.
        let all = repo.list(profile_id, true).await.unwrap();
        let keys: Vec<MediaKey> = all.iter().map(|e| e.media_key.clone()).collect();
        assert_eq!(keys, vec![key_b, key_a]);
    }

    fn progress(profile_id: ProfileId, video_id: &str) -> PlaybackProgress {
        let video = VideoKey::from_content(&MediaType::Movie, "a", video_id).unwrap();
        let media = MediaKey::from_content(&MediaType::Movie, "a", video_id).unwrap();
        PlaybackProgress::new(profile_id, video, media, epoch())
    }

    #[tokio::test]
    async fn progress_continue_watching_only_in_progress_vs_history() {
        let repo = InMemoryProgressRepository::new();
        let profile_id = ProfileId::new();

        let mut in_progress = progress(profile_id, "tt1");
        in_progress
            .record(300.0, 1000.0, None, None, epoch() + Duration::seconds(5))
            .unwrap();

        let mut watched = progress(profile_id, "tt2");
        watched
            .record(
                1000.0,
                1000.0,
                Some(true),
                None,
                epoch() + Duration::seconds(20),
            )
            .unwrap();

        let mut in_progress_recent = progress(profile_id, "tt3");
        in_progress_recent
            .record(100.0, 1000.0, None, None, epoch() + Duration::seconds(30))
            .unwrap();

        repo.upsert(&in_progress).await.unwrap();
        repo.upsert(&watched).await.unwrap();
        repo.upsert(&in_progress_recent).await.unwrap();

        assert!(repo
            .get(profile_id, &in_progress.video_key)
            .await
            .unwrap()
            .is_some());

        let cw = repo.list_continue_watching(profile_id, 10).await.unwrap();
        let cw_keys: Vec<VideoKey> = cw.iter().map(|p| p.video_key.clone()).collect();
        // Only in-progress items, most-recently-updated first.
        assert_eq!(
            cw_keys,
            vec![
                in_progress_recent.video_key.clone(),
                in_progress.video_key.clone()
            ]
        );

        // Limit is honored.
        let cw_limited = repo.list_continue_watching(profile_id, 1).await.unwrap();
        assert_eq!(cw_limited.len(), 1);
        assert_eq!(cw_limited[0].video_key, in_progress_recent.video_key);

        // History includes the watched item too.
        let history = repo.list_history(profile_id, 10).await.unwrap();
        assert_eq!(history.len(), 3);
        assert_eq!(history[0].video_key, in_progress_recent.video_key);
        assert_eq!(history[2].video_key, in_progress.video_key);
    }

    #[tokio::test]
    async fn change_append_sequences_per_profile_and_list_after() {
        let repo = InMemoryChangeRepository::new();
        let profile_a = ProfileId::new();
        let profile_b = ProfileId::new();

        let new_change = |profile_id: ProfileId, key: &str| NewSyncChange {
            profile_id,
            kind: SyncResourceKind::Library,
            key: key.to_string(),
            payload: serde_json::Value::Null,
            deleted: false,
        };

        assert_eq!(repo.latest_sequence(profile_a).await.unwrap(), 0);

        let a1 = repo
            .append(new_change(profile_a, "a1"), epoch())
            .await
            .unwrap();
        let a2 = repo
            .append(new_change(profile_a, "a2"), epoch() + Duration::seconds(1))
            .await
            .unwrap();
        let b1 = repo
            .append(new_change(profile_b, "b1"), epoch())
            .await
            .unwrap();

        assert_eq!(a1.sequence, 1);
        assert_eq!(a2.sequence, 2);
        assert_eq!(b1.sequence, 1);

        assert_eq!(repo.latest_sequence(profile_a).await.unwrap(), 2);
        assert_eq!(repo.latest_sequence(profile_b).await.unwrap(), 1);

        let after_zero = repo.list_after(profile_a, 0, 10).await.unwrap();
        let seqs: Vec<u64> = after_zero.iter().map(|c| c.sequence).collect();
        assert_eq!(seqs, vec![1, 2]);

        let after_one = repo.list_after(profile_a, 1, 10).await.unwrap();
        assert_eq!(after_one.len(), 1);
        assert_eq!(after_one[0].key, "a2");

        // Limit is honored.
        let limited = repo.list_after(profile_a, 0, 1).await.unwrap();
        assert_eq!(limited.len(), 1);
        assert_eq!(limited[0].sequence, 1);
    }

    #[tokio::test]
    async fn device_upsert_list_and_delete() {
        use domain::{Device, DevicePlatform};
        let repo = InMemoryDeviceRepository::new();
        let profile_id = ProfileId::new();

        let mut d1 = Device {
            id: DeviceId::new(),
            profile_id,
            platform: DevicePlatform::Web,
            display_name: "Laptop".to_string(),
            app_version: None,
            created_at: epoch(),
            last_seen_at: epoch(),
        };
        let d2 = Device {
            id: DeviceId::new(),
            profile_id,
            platform: DevicePlatform::Android,
            display_name: "Phone".to_string(),
            app_version: Some("1.2.3".to_string()),
            created_at: epoch() + Duration::seconds(5),
            last_seen_at: epoch() + Duration::seconds(5),
        };
        repo.upsert(&d2).await.unwrap();
        repo.upsert(&d1).await.unwrap();

        let listed = repo.list_by_profile(profile_id).await.unwrap();
        assert_eq!(
            listed.iter().map(|d| d.id).collect::<Vec<_>>(),
            vec![d1.id, d2.id]
        );

        // Upsert replaces in place.
        d1.display_name = "Renamed".to_string();
        repo.upsert(&d1).await.unwrap();
        assert_eq!(
            repo.find_by_id(d1.id).await.unwrap().unwrap().display_name,
            "Renamed"
        );

        repo.delete(d1.id).await.unwrap();
        assert!(repo.find_by_id(d1.id).await.unwrap().is_none());
        repo.delete(d1.id).await.unwrap();
    }

    #[tokio::test]
    async fn bundle_constructs_all_repositories() {
        let repos = InMemoryRepositories::new();
        let user = user_with_email("bundle@example.com");
        repos.users.create(&user).await.unwrap();
        assert!(repos.users.find_by_id(user.id).await.unwrap().is_some());
    }
}
