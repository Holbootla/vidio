//! In-memory [`ProgressRepository`] adapter.

use std::collections::HashMap;
use std::sync::RwLock;

use application::ports::ProgressRepository;
use application::RepoError;
use async_trait::async_trait;
use domain::{PlaybackProgress, ProfileId, VideoKey};

type RepoResult<T> = Result<T, RepoError>;

/// Thread-safe, in-memory playback-progress store keyed by `(profile, video)`.
#[derive(Debug, Default)]
pub struct InMemoryProgressRepository {
    entries: RwLock<HashMap<(ProfileId, VideoKey), PlaybackProgress>>,
}

impl InMemoryProgressRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl ProgressRepository for InMemoryProgressRepository {
    async fn upsert(&self, progress: &PlaybackProgress) -> RepoResult<()> {
        let mut entries = self.entries.write().expect("progress store lock poisoned");
        entries.insert(
            (progress.profile_id, progress.video_key.clone()),
            progress.clone(),
        );
        Ok(())
    }

    async fn get(
        &self,
        profile_id: ProfileId,
        video_key: &VideoKey,
    ) -> RepoResult<Option<PlaybackProgress>> {
        let entries = self.entries.read().expect("progress store lock poisoned");
        Ok(entries.get(&(profile_id, video_key.clone())).cloned())
    }

    async fn list_continue_watching(
        &self,
        profile_id: ProfileId,
        limit: usize,
    ) -> RepoResult<Vec<PlaybackProgress>> {
        let entries = self.entries.read().expect("progress store lock poisoned");
        let mut result: Vec<PlaybackProgress> = entries
            .values()
            .filter(|progress| progress.profile_id == profile_id && progress.is_in_progress())
            .cloned()
            .collect();
        result.sort_by_key(|progress| std::cmp::Reverse(progress.updated_at));
        result.truncate(limit);
        Ok(result)
    }

    async fn list_history(
        &self,
        profile_id: ProfileId,
        limit: usize,
    ) -> RepoResult<Vec<PlaybackProgress>> {
        let entries = self.entries.read().expect("progress store lock poisoned");
        let mut result: Vec<PlaybackProgress> = entries
            .values()
            .filter(|progress| progress.profile_id == profile_id)
            .cloned()
            .collect();
        result.sort_by_key(|progress| std::cmp::Reverse(progress.updated_at));
        result.truncate(limit);
        Ok(result)
    }
}
