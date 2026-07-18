//! In-memory [`AddonRepository`] adapter.

use std::collections::HashMap;
use std::sync::RwLock;

use application::ports::AddonRepository;
use application::RepoError;
use async_trait::async_trait;
use domain::{AddonInstallation, InstallationId, ProfileId};

type RepoResult<T> = Result<T, RepoError>;

/// Thread-safe, in-memory store of add-on installations keyed by [`InstallationId`].
#[derive(Debug, Default)]
pub struct InMemoryAddonRepository {
    installations: RwLock<HashMap<InstallationId, AddonInstallation>>,
}

impl InMemoryAddonRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl AddonRepository for InMemoryAddonRepository {
    async fn create(&self, installation: &AddonInstallation) -> RepoResult<()> {
        let mut installations = self
            .installations
            .write()
            .expect("addon store lock poisoned");
        if installations.contains_key(&installation.id) {
            return Err(RepoError::Conflict(format!(
                "addon installation with id {} already exists",
                installation.id
            )));
        }
        installations.insert(installation.id, installation.clone());
        Ok(())
    }

    async fn find_by_id(&self, id: InstallationId) -> RepoResult<Option<AddonInstallation>> {
        let installations = self
            .installations
            .read()
            .expect("addon store lock poisoned");
        Ok(installations.get(&id).cloned())
    }

    async fn list_by_profile(&self, profile_id: ProfileId) -> RepoResult<Vec<AddonInstallation>> {
        let installations = self
            .installations
            .read()
            .expect("addon store lock poisoned");
        let mut result: Vec<AddonInstallation> = installations
            .values()
            .filter(|installation| installation.profile_id == profile_id)
            .cloned()
            .collect();
        result.sort_by(|a, b| {
            a.priority
                .cmp(&b.priority)
                .then_with(|| a.installed_at.cmp(&b.installed_at))
        });
        Ok(result)
    }

    async fn find_by_manifest_id(
        &self,
        profile_id: ProfileId,
        manifest_id: &str,
    ) -> RepoResult<Option<AddonInstallation>> {
        let installations = self
            .installations
            .read()
            .expect("addon store lock poisoned");
        Ok(installations
            .values()
            .find(|installation| {
                installation.profile_id == profile_id && installation.manifest_id == manifest_id
            })
            .cloned())
    }

    async fn update(&self, installation: &AddonInstallation) -> RepoResult<()> {
        let mut installations = self
            .installations
            .write()
            .expect("addon store lock poisoned");
        if !installations.contains_key(&installation.id) {
            return Err(RepoError::NotFound);
        }
        installations.insert(installation.id, installation.clone());
        Ok(())
    }

    async fn delete(&self, id: InstallationId) -> RepoResult<()> {
        let mut installations = self
            .installations
            .write()
            .expect("addon store lock poisoned");
        installations.remove(&id);
        Ok(())
    }
}
