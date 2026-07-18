//! In-memory [`ProfileRepository`] adapter.

use std::collections::HashMap;
use std::sync::RwLock;

use application::ports::ProfileRepository;
use application::RepoError;
use async_trait::async_trait;
use domain::{Profile, ProfileId, UserId};

type RepoResult<T> = Result<T, RepoError>;

/// Thread-safe, in-memory store of viewing profiles keyed by [`ProfileId`].
#[derive(Debug, Default)]
pub struct InMemoryProfileRepository {
    profiles: RwLock<HashMap<ProfileId, Profile>>,
}

impl InMemoryProfileRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl ProfileRepository for InMemoryProfileRepository {
    async fn create(&self, profile: &Profile) -> RepoResult<()> {
        let mut profiles = self.profiles.write().expect("profile store lock poisoned");
        if profiles.contains_key(&profile.id) {
            return Err(RepoError::Conflict(format!(
                "profile with id {} already exists",
                profile.id
            )));
        }
        profiles.insert(profile.id, profile.clone());
        Ok(())
    }

    async fn find_by_id(&self, id: ProfileId) -> RepoResult<Option<Profile>> {
        let profiles = self.profiles.read().expect("profile store lock poisoned");
        Ok(profiles.get(&id).cloned())
    }

    async fn list_by_user(&self, user_id: UserId) -> RepoResult<Vec<Profile>> {
        let profiles = self.profiles.read().expect("profile store lock poisoned");
        let mut result: Vec<Profile> = profiles
            .values()
            .filter(|profile| profile.user_id == user_id)
            .cloned()
            .collect();
        result.sort_by_key(|profile| profile.created_at);
        Ok(result)
    }

    async fn update(&self, profile: &Profile) -> RepoResult<()> {
        let mut profiles = self.profiles.write().expect("profile store lock poisoned");
        if !profiles.contains_key(&profile.id) {
            return Err(RepoError::NotFound);
        }
        profiles.insert(profile.id, profile.clone());
        Ok(())
    }
}
