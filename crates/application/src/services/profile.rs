use crate::clock::Clock;
use crate::error::AppResult;
use crate::models::{NewSyncChange, SyncResourceKind};
use crate::ports::{ChangeRepository, ProfileRepository};
use crate::services::common::authorize_profile;
use domain::{Profile, ProfileId, ProfilePreferences, UserId};
use std::sync::Arc;

/// Use cases for managing profiles and their preferences.
#[derive(Clone)]
pub struct ProfileService {
    profiles: Arc<dyn ProfileRepository>,
    changes: Arc<dyn ChangeRepository>,
    clock: Arc<dyn Clock>,
}

impl ProfileService {
    pub fn new(
        profiles: Arc<dyn ProfileRepository>,
        changes: Arc<dyn ChangeRepository>,
        clock: Arc<dyn Clock>,
    ) -> Self {
        Self {
            profiles,
            changes,
            clock,
        }
    }

    /// Lists all profiles owned by a user.
    pub async fn list(&self, user_id: UserId) -> AppResult<Vec<Profile>> {
        Ok(self.profiles.list_by_user(user_id).await?)
    }

    /// Fetches a single owned profile.
    pub async fn get(&self, user_id: UserId, profile_id: ProfileId) -> AppResult<Profile> {
        authorize_profile(&self.profiles, user_id, profile_id).await
    }

    /// Renames a profile.
    pub async fn rename(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        name: &str,
    ) -> AppResult<Profile> {
        let mut profile = authorize_profile(&self.profiles, user_id, profile_id).await?;
        profile.rename(name, self.clock.now())?;
        self.profiles.update(&profile).await?;
        self.record_change(&profile).await?;
        Ok(profile)
    }

    /// Replaces a profile's preferences.
    pub async fn update_preferences(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        preferences: ProfilePreferences,
    ) -> AppResult<Profile> {
        let mut profile = authorize_profile(&self.profiles, user_id, profile_id).await?;
        profile.set_preferences(preferences, self.clock.now());
        self.profiles.update(&profile).await?;
        self.record_change(&profile).await?;
        Ok(profile)
    }

    async fn record_change(&self, profile: &Profile) -> AppResult<()> {
        let payload = serde_json::json!({
            "name": profile.name,
            "preferences": profile.preferences,
            "version": profile.version,
        });
        self.changes
            .append(
                NewSyncChange {
                    profile_id: profile.id,
                    kind: SyncResourceKind::Preferences,
                    key: "profile".to_string(),
                    payload,
                    deleted: false,
                },
                self.clock.now(),
            )
            .await?;
        Ok(())
    }
}
