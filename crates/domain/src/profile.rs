use crate::error::{DomainError, DomainResult};
use crate::ids::{ProfileId, UserId};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

/// User-tunable preferences that sync across a profile's devices.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProfilePreferences {
    /// BCP-47 UI locale, e.g. `en-US`.
    #[serde(default = "default_locale")]
    pub locale: String,
    /// Preferred subtitle languages, most-preferred first (ISO 639 codes).
    #[serde(default)]
    pub subtitle_languages: Vec<String>,
    /// Preferred audio/stream languages, most-preferred first.
    #[serde(default)]
    pub audio_languages: Vec<String>,
    /// Preferred stream qualities, most-preferred first, e.g. `["1080p","720p"]`.
    #[serde(default)]
    pub preferred_qualities: Vec<String>,
    /// Whether to hide streams flagged as P2P.
    #[serde(default)]
    pub hide_p2p_streams: bool,
}

fn default_locale() -> String {
    "en-US".to_string()
}

impl Default for ProfilePreferences {
    fn default() -> Self {
        Self {
            locale: default_locale(),
            subtitle_languages: Vec::new(),
            audio_languages: Vec::new(),
            preferred_qualities: Vec::new(),
            hide_p2p_streams: false,
        }
    }
}

/// A viewing profile: the unit that owns add-ons, library and preferences.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Profile {
    pub id: ProfileId,
    pub user_id: UserId,
    pub name: String,
    pub is_default: bool,
    pub preferences: ProfilePreferences,
    /// Monotonic version bumped on every mutation, used for optimistic sync.
    pub version: u64,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl Profile {
    /// Maximum length for a profile display name.
    pub const MAX_NAME_LEN: usize = 60;

    /// Creates the default profile for a newly registered user.
    pub fn new_default(
        id: ProfileId,
        user_id: UserId,
        name: impl Into<String>,
        now: OffsetDateTime,
    ) -> DomainResult<Self> {
        let name = Self::validate_name(name.into())?;
        Ok(Self {
            id,
            user_id,
            name,
            is_default: true,
            preferences: ProfilePreferences::default(),
            version: 1,
            created_at: now,
            updated_at: now,
        })
    }

    fn validate_name(name: String) -> DomainResult<String> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Err(DomainError::validation("profile name must not be empty"));
        }
        if trimmed.chars().count() > Self::MAX_NAME_LEN {
            return Err(DomainError::validation("profile name is too long"));
        }
        Ok(trimmed.to_string())
    }

    /// Renames the profile and bumps its version.
    pub fn rename(&mut self, name: impl Into<String>, now: OffsetDateTime) -> DomainResult<()> {
        self.name = Self::validate_name(name.into())?;
        self.touch(now);
        Ok(())
    }

    /// Replaces preferences and bumps the version.
    pub fn set_preferences(&mut self, preferences: ProfilePreferences, now: OffsetDateTime) {
        self.preferences = preferences;
        self.touch(now);
    }

    /// Bumps the sync version and updates the timestamp.
    pub fn touch(&mut self, now: OffsetDateTime) {
        self.version += 1;
        self.updated_at = now;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn profile() -> Profile {
        Profile::new_default(
            ProfileId::new(),
            UserId::new(),
            "Main",
            OffsetDateTime::UNIX_EPOCH,
        )
        .unwrap()
    }

    #[test]
    fn default_profile_starts_at_version_one() {
        let p = profile();
        assert!(p.is_default);
        assert_eq!(p.version, 1);
        assert_eq!(p.preferences, ProfilePreferences::default());
    }

    #[test]
    fn rename_validates_and_bumps_version() {
        let mut p = profile();
        p.rename("  Living Room  ", OffsetDateTime::UNIX_EPOCH)
            .unwrap();
        assert_eq!(p.name, "Living Room");
        assert_eq!(p.version, 2);
        assert!(p.rename("", OffsetDateTime::UNIX_EPOCH).is_err());
        assert!(p
            .rename("x".repeat(61), OffsetDateTime::UNIX_EPOCH)
            .is_err());
    }

    #[test]
    fn preferences_default_locale() {
        assert_eq!(ProfilePreferences::default().locale, "en-US");
    }
}
