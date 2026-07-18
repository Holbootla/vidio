use crate::error::AppResult;
use crate::models::SyncChange;
use crate::ports::{ChangeRepository, ProfileRepository};
use crate::services::common::authorize_profile;
use domain::{ProfileId, UserId};
use serde::Serialize;
use std::sync::Arc;

/// A page of the incremental sync feed.
#[derive(Debug, Clone, Serialize)]
pub struct SyncPage {
    pub changes: Vec<SyncChange>,
    /// The latest sequence known for the profile (clients persist this as their cursor).
    pub latest_sequence: u64,
    /// True when more changes exist beyond this page.
    pub has_more: bool,
}

/// Serves the per-profile incremental change feed to devices.
#[derive(Clone)]
pub struct SyncService {
    changes: Arc<dyn ChangeRepository>,
    profiles: Arc<dyn ProfileRepository>,
}

impl SyncService {
    pub fn new(changes: Arc<dyn ChangeRepository>, profiles: Arc<dyn ProfileRepository>) -> Self {
        Self { changes, profiles }
    }

    /// Returns changes after the client's cursor, up to `limit`.
    pub async fn pull(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        after: u64,
        limit: usize,
    ) -> AppResult<SyncPage> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let limit = limit.clamp(1, 500);
        let changes = self.changes.list_after(profile_id, after, limit).await?;
        let latest_sequence = self.changes.latest_sequence(profile_id).await?;
        let has_more = changes
            .last()
            .map(|c| c.sequence < latest_sequence)
            .unwrap_or(false);
        Ok(SyncPage {
            changes,
            latest_sequence,
            has_more,
        })
    }
}
