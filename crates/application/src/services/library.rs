use crate::clock::Clock;
use crate::error::AppResult;
use crate::models::{NewSyncChange, SyncResourceKind};
use crate::ports::{ChangeRepository, LibraryRepository, ProfileRepository};
use crate::services::common::authorize_profile;
use domain::{LibraryEntry, MediaKey, MediaType, ProfileId, UserId};
use std::sync::Arc;

/// Input describing an item to add to the library.
#[derive(Debug, Clone)]
pub struct AddLibraryItem {
    pub content_type: String,
    pub content_id: String,
    /// Manifest id of the source add-on (required for add-on-scoped ids).
    pub manifest_id: String,
    pub name: String,
    pub poster: Option<String>,
    pub meta_snapshot: Option<String>,
}

/// Use cases for a profile's personal library.
#[derive(Clone)]
pub struct LibraryService {
    library: Arc<dyn LibraryRepository>,
    profiles: Arc<dyn ProfileRepository>,
    changes: Arc<dyn ChangeRepository>,
    clock: Arc<dyn Clock>,
}

impl LibraryService {
    pub fn new(
        library: Arc<dyn LibraryRepository>,
        profiles: Arc<dyn ProfileRepository>,
        changes: Arc<dyn ChangeRepository>,
        clock: Arc<dyn Clock>,
    ) -> Self {
        Self {
            library,
            profiles,
            changes,
            clock,
        }
    }

    /// Adds (or restores/updates) an item in the library.
    pub async fn add(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        item: AddLibraryItem,
    ) -> AppResult<LibraryEntry> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let media_type = MediaType::from(item.content_type.as_str());
        let media_key = MediaKey::from_content(&media_type, &item.manifest_id, &item.content_id)?;
        let now = self.clock.now();

        let mut entry = self
            .library
            .get(profile_id, &media_key)
            .await?
            .unwrap_or_else(|| {
                LibraryEntry::new(
                    profile_id,
                    media_key.clone(),
                    media_type.clone(),
                    item.name.clone(),
                    now,
                )
            });

        entry.removed = false;
        entry.name = item.name;
        entry.poster = item.poster;
        entry.meta_snapshot = item.meta_snapshot;
        entry.updated_at = now;

        self.library.upsert(&entry).await?;
        self.record_change(&entry, false).await?;
        Ok(entry)
    }

    /// Lists the active (non-removed) library entries.
    pub async fn list(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
    ) -> AppResult<Vec<LibraryEntry>> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        Ok(self.library.list(profile_id, false).await?)
    }

    /// Soft-removes an item from the library (idempotent).
    pub async fn remove(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        media_key: &MediaKey,
    ) -> AppResult<()> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        if let Some(mut entry) = self.library.get(profile_id, media_key).await? {
            if !entry.removed {
                entry.mark_removed(self.clock.now());
                self.library.upsert(&entry).await?;
                self.record_change(&entry, true).await?;
            }
        }
        Ok(())
    }

    async fn record_change(&self, entry: &LibraryEntry, deleted: bool) -> AppResult<()> {
        let payload = if deleted {
            serde_json::Value::Null
        } else {
            serde_json::json!({
                "media_key": entry.media_key,
                "type": entry.media_type,
                "name": entry.name,
                "poster": entry.poster,
            })
        };
        self.changes
            .append(
                NewSyncChange {
                    profile_id: entry.profile_id,
                    kind: SyncResourceKind::Library,
                    key: entry.media_key.to_string(),
                    payload,
                    deleted,
                },
                self.clock.now(),
            )
            .await?;
        Ok(())
    }
}
