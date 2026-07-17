use crate::clock::Clock;
use crate::error::{AppError, AppResult};
use crate::models::{NewSyncChange, SyncResourceKind};
use crate::ports::{AddonRepository, ChangeRepository, ProfileRepository};
use crate::services::common::authorize_profile;
use addon_protocol::Manifest;
use addon_runtime::{validate_transport_url, AddonClient, UrlPolicy};
use domain::{AddonCapabilities, AddonInstallation, InstallationId, ProfileId, UserId};
use std::sync::Arc;

/// Use cases for installing and managing a profile's add-ons.
#[derive(Clone)]
pub struct AddonService {
    addons: Arc<dyn AddonRepository>,
    profiles: Arc<dyn ProfileRepository>,
    changes: Arc<dyn ChangeRepository>,
    client: Arc<dyn AddonClient>,
    clock: Arc<dyn Clock>,
    policy: UrlPolicy,
}

impl AddonService {
    pub fn new(
        addons: Arc<dyn AddonRepository>,
        profiles: Arc<dyn ProfileRepository>,
        changes: Arc<dyn ChangeRepository>,
        client: Arc<dyn AddonClient>,
        clock: Arc<dyn Clock>,
        policy: UrlPolicy,
    ) -> Self {
        Self {
            addons,
            profiles,
            changes,
            client,
            clock,
            policy,
        }
    }

    /// Installs an add-on for a profile from its (configured) manifest URL.
    pub async fn install(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        transport_url: &str,
    ) -> AppResult<AddonInstallation> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;

        let url = validate_transport_url(transport_url, &self.policy)?;
        let body = self.client.get(&url).await?;
        let manifest = Manifest::parse(&body)
            .map_err(|e| AppError::validation(format!("invalid manifest: {e}")))?;

        if manifest.requires_configuration() {
            return Err(AppError::validation(
                "add-on requires configuration; install its configured manifest url",
            ));
        }

        if self
            .addons
            .find_by_manifest_id(profile_id, &manifest.id)
            .await?
            .is_some()
        {
            return Err(AppError::conflict(
                "add-on is already installed for this profile",
            ));
        }

        let existing = self.addons.list_by_profile(profile_id).await?;
        let priority = existing.iter().map(|a| a.priority).max().unwrap_or(-1) + 1;
        let now = self.clock.now();

        let installation = AddonInstallation {
            id: InstallationId::new(),
            profile_id,
            manifest_id: manifest.id.clone(),
            transport_url: url.to_string(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            description: manifest.description.clone(),
            enabled: true,
            priority,
            capabilities: capabilities_of(&manifest),
            manifest_snapshot: body,
            installed_at: now,
            updated_at: now,
        };
        self.addons.create(&installation).await?;
        self.record_change(&installation, false).await?;
        Ok(installation)
    }

    /// Lists a profile's add-ons in priority order.
    pub async fn list(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
    ) -> AppResult<Vec<AddonInstallation>> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        Ok(self.addons.list_by_profile(profile_id).await?)
    }

    /// Enables or disables an add-on.
    pub async fn set_enabled(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        installation_id: InstallationId,
        enabled: bool,
    ) -> AppResult<AddonInstallation> {
        let mut installation = self.owned(user_id, profile_id, installation_id).await?;
        installation.set_enabled(enabled, self.clock.now());
        self.addons.update(&installation).await?;
        self.record_change(&installation, false).await?;
        Ok(installation)
    }

    /// Removes an add-on.
    pub async fn remove(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        installation_id: InstallationId,
    ) -> AppResult<()> {
        let installation = self.owned(user_id, profile_id, installation_id).await?;
        self.addons.delete(installation_id).await?;
        self.record_change(&installation, true).await?;
        Ok(())
    }

    /// Reorders add-ons; the provided ids must be exactly the installed set.
    pub async fn reorder(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        ordered_ids: &[InstallationId],
    ) -> AppResult<Vec<AddonInstallation>> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let mut current = self.addons.list_by_profile(profile_id).await?;

        if ordered_ids.len() != current.len()
            || !current.iter().all(|a| ordered_ids.contains(&a.id))
        {
            return Err(AppError::validation(
                "reorder must include exactly the installed add-ons",
            ));
        }

        let now = self.clock.now();
        for (index, id) in ordered_ids.iter().enumerate() {
            if let Some(installation) = current.iter_mut().find(|a| a.id == *id) {
                installation.set_priority(index as i32, now);
                self.addons.update(installation).await?;
            }
        }
        Ok(self.addons.list_by_profile(profile_id).await?)
    }

    /// Re-fetches an add-on's manifest and updates the stored snapshot.
    pub async fn refresh(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        installation_id: InstallationId,
    ) -> AppResult<AddonInstallation> {
        let mut installation = self.owned(user_id, profile_id, installation_id).await?;
        let url = validate_transport_url(&installation.transport_url, &self.policy)?;
        let body = self.client.get(&url).await?;
        let manifest = Manifest::parse(&body)
            .map_err(|e| AppError::validation(format!("invalid manifest: {e}")))?;

        installation.name = manifest.name.clone();
        installation.version = manifest.version.clone();
        installation.description = manifest.description.clone();
        installation.capabilities = capabilities_of(&manifest);
        installation.manifest_snapshot = body;
        installation.updated_at = self.clock.now();
        self.addons.update(&installation).await?;
        self.record_change(&installation, false).await?;
        Ok(installation)
    }

    async fn owned(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        installation_id: InstallationId,
    ) -> AppResult<AddonInstallation> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let installation = self
            .addons
            .find_by_id(installation_id)
            .await?
            .ok_or_else(|| AppError::not_found("add-on not found"))?;
        if installation.profile_id != profile_id {
            return Err(AppError::not_found("add-on not found"));
        }
        Ok(installation)
    }

    async fn record_change(
        &self,
        installation: &AddonInstallation,
        deleted: bool,
    ) -> AppResult<()> {
        // Never include the transport url (it may embed user secrets).
        let payload = if deleted {
            serde_json::Value::Null
        } else {
            serde_json::json!({
                "id": installation.id,
                "manifest_id": installation.manifest_id,
                "name": installation.name,
                "version": installation.version,
                "enabled": installation.enabled,
                "priority": installation.priority,
            })
        };
        self.changes
            .append(
                NewSyncChange {
                    profile_id: installation.profile_id,
                    kind: SyncResourceKind::Addon,
                    key: installation.id.to_string(),
                    payload,
                    deleted,
                },
                self.clock.now(),
            )
            .await?;
        Ok(())
    }
}

/// Derives the denormalized capability summary from a manifest.
fn capabilities_of(manifest: &Manifest) -> AddonCapabilities {
    AddonCapabilities {
        resources: manifest.resource_names(),
        types: manifest.types.clone(),
        id_prefixes: manifest.id_prefixes.clone().unwrap_or_default(),
    }
}
