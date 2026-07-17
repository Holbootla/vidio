use crate::ids::{DeviceId, ProfileId, SessionId, UserId};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

/// The platform a device runs on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DevicePlatform {
    Web,
    Android,
    Ios,
    Macos,
    Windows,
    Linux,
    Tizen,
    Other,
}

/// A device bound to a profile, used to scope sessions and sync.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Device {
    pub id: DeviceId,
    pub profile_id: ProfileId,
    pub platform: DevicePlatform,
    pub display_name: String,
    pub app_version: Option<String>,
    pub created_at: OffsetDateTime,
    pub last_seen_at: OffsetDateTime,
}

/// A refresh-token session. Only the hash of the refresh token is stored so a
/// database leak cannot be used to mint access tokens.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Session {
    pub id: SessionId,
    pub user_id: UserId,
    pub device_id: DeviceId,
    /// SHA-256 hash (hex) of the opaque refresh token.
    pub refresh_token_hash: String,
    pub issued_at: OffsetDateTime,
    pub expires_at: OffsetDateTime,
    pub revoked_at: Option<OffsetDateTime>,
    /// Set when this session's token was rotated, pointing to the successor.
    pub rotated_to: Option<SessionId>,
}

impl Session {
    /// Returns true if the session can still be used at `now`.
    pub fn is_active(&self, now: OffsetDateTime) -> bool {
        self.revoked_at.is_none() && self.rotated_to.is_none() && now < self.expires_at
    }

    /// Marks the session revoked.
    pub fn revoke(&mut self, now: OffsetDateTime) {
        if self.revoked_at.is_none() {
            self.revoked_at = Some(now);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::Duration;

    fn session(now: OffsetDateTime) -> Session {
        Session {
            id: SessionId::new(),
            user_id: UserId::new(),
            device_id: DeviceId::new(),
            refresh_token_hash: "hash".to_string(),
            issued_at: now,
            expires_at: now + Duration::days(30),
            revoked_at: None,
            rotated_to: None,
        }
    }

    #[test]
    fn active_until_expiry() {
        let now = OffsetDateTime::UNIX_EPOCH;
        let s = session(now);
        assert!(s.is_active(now));
        assert!(!s.is_active(now + Duration::days(31)));
    }

    #[test]
    fn revoked_or_rotated_is_inactive() {
        let now = OffsetDateTime::UNIX_EPOCH;
        let mut s = session(now);
        s.revoke(now);
        assert!(!s.is_active(now));

        let mut r = session(now);
        r.rotated_to = Some(SessionId::new());
        assert!(!r.is_active(now));
    }
}
