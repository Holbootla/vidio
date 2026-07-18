use domain::ProfileId;
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

/// The kind of profile-scoped resource a sync change refers to.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncResourceKind {
    Preferences,
    Addon,
    Library,
    Progress,
}

/// A change to append to a profile's incremental sync feed.
#[derive(Debug, Clone, PartialEq)]
pub struct NewSyncChange {
    pub profile_id: ProfileId,
    pub kind: SyncResourceKind,
    /// Stable key of the changed entity (media key, video key, installation id).
    pub key: String,
    /// Serialized snapshot of the entity after the change (or null on delete).
    pub payload: serde_json::Value,
    pub deleted: bool,
}

/// A persisted, sequenced change in a profile's sync feed.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SyncChange {
    /// Monotonic per-profile sequence number assigned on append.
    pub sequence: u64,
    pub profile_id: ProfileId,
    pub kind: SyncResourceKind,
    pub key: String,
    pub payload: serde_json::Value,
    pub deleted: bool,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}
