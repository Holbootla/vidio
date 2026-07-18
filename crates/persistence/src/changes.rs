//! In-memory [`ChangeRepository`] adapter.

use std::sync::RwLock;

use application::ports::ChangeRepository;
use application::RepoError;
use application::{NewSyncChange, SyncChange};
use async_trait::async_trait;
use domain::ProfileId;

type RepoResult<T> = Result<T, RepoError>;

/// Thread-safe, in-memory append-only sync feed.
///
/// Sequence numbers are assigned per profile: the first change for a profile is
/// `1` and each subsequent change increments the profile's maximum sequence.
#[derive(Debug, Default)]
pub struct InMemoryChangeRepository {
    changes: RwLock<Vec<SyncChange>>,
}

impl InMemoryChangeRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl ChangeRepository for InMemoryChangeRepository {
    async fn append(
        &self,
        change: NewSyncChange,
        now: time::OffsetDateTime,
    ) -> RepoResult<SyncChange> {
        let mut changes = self.changes.write().expect("change store lock poisoned");
        let sequence = changes
            .iter()
            .filter(|existing| existing.profile_id == change.profile_id)
            .map(|existing| existing.sequence)
            .max()
            .unwrap_or(0)
            + 1;
        let stored = SyncChange {
            sequence,
            profile_id: change.profile_id,
            kind: change.kind,
            key: change.key,
            payload: change.payload,
            deleted: change.deleted,
            created_at: now,
        };
        changes.push(stored.clone());
        Ok(stored)
    }

    async fn list_after(
        &self,
        profile_id: ProfileId,
        after: u64,
        limit: usize,
    ) -> RepoResult<Vec<SyncChange>> {
        let changes = self.changes.read().expect("change store lock poisoned");
        let mut result: Vec<SyncChange> = changes
            .iter()
            .filter(|change| change.profile_id == profile_id && change.sequence > after)
            .cloned()
            .collect();
        result.sort_by_key(|change| change.sequence);
        result.truncate(limit);
        Ok(result)
    }

    async fn latest_sequence(&self, profile_id: ProfileId) -> RepoResult<u64> {
        let changes = self.changes.read().expect("change store lock poisoned");
        Ok(changes
            .iter()
            .filter(|change| change.profile_id == profile_id)
            .map(|change| change.sequence)
            .max()
            .unwrap_or(0))
    }
}
