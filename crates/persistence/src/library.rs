//! In-memory [`LibraryRepository`] adapter.

use std::collections::HashMap;
use std::sync::RwLock;

use application::ports::LibraryRepository;
use application::RepoError;
use async_trait::async_trait;
use domain::{LibraryEntry, MediaKey, ProfileId};

type RepoResult<T> = Result<T, RepoError>;

/// Thread-safe, in-memory library store keyed by `(profile, media)`.
#[derive(Debug, Default)]
pub struct InMemoryLibraryRepository {
    entries: RwLock<HashMap<(ProfileId, MediaKey), LibraryEntry>>,
}

impl InMemoryLibraryRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl LibraryRepository for InMemoryLibraryRepository {
    async fn upsert(&self, entry: &LibraryEntry) -> RepoResult<()> {
        let mut entries = self.entries.write().expect("library store lock poisoned");
        entries.insert((entry.profile_id, entry.media_key.clone()), entry.clone());
        Ok(())
    }

    async fn get(
        &self,
        profile_id: ProfileId,
        media_key: &MediaKey,
    ) -> RepoResult<Option<LibraryEntry>> {
        let entries = self.entries.read().expect("library store lock poisoned");
        Ok(entries.get(&(profile_id, media_key.clone())).cloned())
    }

    async fn list(
        &self,
        profile_id: ProfileId,
        include_removed: bool,
    ) -> RepoResult<Vec<LibraryEntry>> {
        let entries = self.entries.read().expect("library store lock poisoned");
        let mut result: Vec<LibraryEntry> = entries
            .values()
            .filter(|entry| entry.profile_id == profile_id)
            .filter(|entry| include_removed || !entry.removed)
            .cloned()
            .collect();
        result.sort_by_key(|entry| std::cmp::Reverse(entry.updated_at));
        Ok(result)
    }
}
