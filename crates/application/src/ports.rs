//! Repository ports: the interfaces the application layer depends on.
//!
//! Adapters (in-memory, PostgreSQL) implement these traits. They are
//! object-safe so services can hold `Arc<dyn Port>` and be wired at runtime.

use crate::error::RepoError;
use crate::models::{NewSyncChange, SyncChange};
use async_trait::async_trait;
use domain::{
    AddonInstallation, Device, EmailAddress, InstallationId, LibraryEntry, MediaKey,
    PlaybackProgress, Profile, ProfileId, Session, SessionId, User, UserId, VideoKey,
};

type RepoResult<T> = Result<T, RepoError>;

/// Persistence for user accounts.
#[async_trait]
pub trait UserRepository: Send + Sync {
    /// Creates a user, returning [`RepoError::Conflict`] if the email exists.
    async fn create(&self, user: &User) -> RepoResult<()>;
    async fn find_by_id(&self, id: UserId) -> RepoResult<Option<User>>;
    async fn find_by_email(&self, email: &EmailAddress) -> RepoResult<Option<User>>;
    async fn update(&self, user: &User) -> RepoResult<()>;
}

/// Persistence for viewing profiles.
#[async_trait]
pub trait ProfileRepository: Send + Sync {
    async fn create(&self, profile: &Profile) -> RepoResult<()>;
    async fn find_by_id(&self, id: ProfileId) -> RepoResult<Option<Profile>>;
    async fn list_by_user(&self, user_id: UserId) -> RepoResult<Vec<Profile>>;
    async fn update(&self, profile: &Profile) -> RepoResult<()>;
}

/// Persistence for devices bound to profiles.
#[async_trait]
pub trait DeviceRepository: Send + Sync {
    async fn upsert(&self, device: &Device) -> RepoResult<()>;
    async fn find_by_id(&self, id: domain::DeviceId) -> RepoResult<Option<Device>>;
    async fn list_by_profile(&self, profile_id: ProfileId) -> RepoResult<Vec<Device>>;
    async fn delete(&self, id: domain::DeviceId) -> RepoResult<()>;
}

/// Persistence for refresh-token sessions.
#[async_trait]
pub trait SessionRepository: Send + Sync {
    async fn create(&self, session: &Session) -> RepoResult<()>;
    async fn find_by_id(&self, id: SessionId) -> RepoResult<Option<Session>>;
    async fn find_by_token_hash(&self, token_hash: &str) -> RepoResult<Option<Session>>;
    async fn update(&self, session: &Session) -> RepoResult<()>;
    /// Revokes every active session for a user (used on refresh-token reuse).
    async fn revoke_all_for_user(
        &self,
        user_id: UserId,
        now: time::OffsetDateTime,
    ) -> RepoResult<()>;
}

/// Persistence for installed add-ons.
#[async_trait]
pub trait AddonRepository: Send + Sync {
    async fn create(&self, installation: &AddonInstallation) -> RepoResult<()>;
    async fn find_by_id(&self, id: InstallationId) -> RepoResult<Option<AddonInstallation>>;
    /// Lists a profile's add-ons ordered by ascending priority.
    async fn list_by_profile(&self, profile_id: ProfileId) -> RepoResult<Vec<AddonInstallation>>;
    async fn find_by_manifest_id(
        &self,
        profile_id: ProfileId,
        manifest_id: &str,
    ) -> RepoResult<Option<AddonInstallation>>;
    async fn update(&self, installation: &AddonInstallation) -> RepoResult<()>;
    async fn delete(&self, id: InstallationId) -> RepoResult<()>;
}

/// Persistence for a profile's library.
#[async_trait]
pub trait LibraryRepository: Send + Sync {
    async fn upsert(&self, entry: &LibraryEntry) -> RepoResult<()>;
    async fn get(
        &self,
        profile_id: ProfileId,
        media_key: &MediaKey,
    ) -> RepoResult<Option<LibraryEntry>>;
    /// Lists entries; when `include_removed` is false, soft-removed entries are omitted.
    async fn list(
        &self,
        profile_id: ProfileId,
        include_removed: bool,
    ) -> RepoResult<Vec<LibraryEntry>>;
}

/// Persistence for playback progress.
#[async_trait]
pub trait ProgressRepository: Send + Sync {
    async fn upsert(&self, progress: &PlaybackProgress) -> RepoResult<()>;
    async fn get(
        &self,
        profile_id: ProfileId,
        video_key: &VideoKey,
    ) -> RepoResult<Option<PlaybackProgress>>;
    /// Resumable, unfinished items ordered by most-recently-updated first.
    async fn list_continue_watching(
        &self,
        profile_id: ProfileId,
        limit: usize,
    ) -> RepoResult<Vec<PlaybackProgress>>;
    /// Full playback history ordered by most-recently-updated first.
    async fn list_history(
        &self,
        profile_id: ProfileId,
        limit: usize,
    ) -> RepoResult<Vec<PlaybackProgress>>;
}

/// Persistence for the per-profile incremental sync feed.
#[async_trait]
pub trait ChangeRepository: Send + Sync {
    /// Appends a change and returns it with its assigned sequence number.
    async fn append(
        &self,
        change: NewSyncChange,
        now: time::OffsetDateTime,
    ) -> RepoResult<SyncChange>;
    /// Returns changes with `sequence > after`, ascending, capped at `limit`.
    async fn list_after(
        &self,
        profile_id: ProfileId,
        after: u64,
        limit: usize,
    ) -> RepoResult<Vec<SyncChange>>;
    /// The latest sequence number for a profile (0 if none).
    async fn latest_sequence(&self, profile_id: ProfileId) -> RepoResult<u64>;
}
