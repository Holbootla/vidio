use crate::email::EmailAddress;
use crate::error::{DomainError, DomainResult};
use crate::ids::UserId;
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

/// Lifecycle status of a user account.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserStatus {
    /// Registered but email not yet verified.
    PendingVerification,
    /// Active account in good standing.
    Active,
    /// Disabled by the user or an administrator.
    Disabled,
}

/// An opaque, already-hashed password credential.
///
/// The domain never sees plaintext passwords; hashing is performed by the auth
/// layer and only the resulting encoded hash is stored here.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct PasswordHash(String);

impl PasswordHash {
    pub fn from_encoded(hash: impl Into<String>) -> Self {
        Self(hash.into())
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// A user account: the authentication and ownership root.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct User {
    pub id: UserId,
    pub email: EmailAddress,
    pub password_hash: PasswordHash,
    pub status: UserStatus,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl User {
    /// Creates a new, unverified user.
    pub fn register(
        id: UserId,
        email: EmailAddress,
        password_hash: PasswordHash,
        now: OffsetDateTime,
    ) -> Self {
        Self {
            id,
            email,
            password_hash,
            status: UserStatus::PendingVerification,
            created_at: now,
            updated_at: now,
        }
    }

    /// Transitions a pending account to active after email verification.
    pub fn verify(&mut self, now: OffsetDateTime) -> DomainResult<()> {
        match self.status {
            UserStatus::PendingVerification => {
                self.status = UserStatus::Active;
                self.updated_at = now;
                Ok(())
            }
            UserStatus::Active => Ok(()),
            UserStatus::Disabled => Err(DomainError::invalid_transition(
                "cannot verify a disabled account",
            )),
        }
    }

    /// Returns true when the account may authenticate.
    pub fn can_authenticate(&self) -> bool {
        matches!(
            self.status,
            UserStatus::Active | UserStatus::PendingVerification
        )
    }

    /// Replaces the stored password hash.
    pub fn set_password_hash(&mut self, hash: PasswordHash, now: OffsetDateTime) {
        self.password_hash = hash;
        self.updated_at = now;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> User {
        User::register(
            UserId::new(),
            EmailAddress::parse("user@example.com").unwrap(),
            PasswordHash::from_encoded("hash"),
            OffsetDateTime::UNIX_EPOCH,
        )
    }

    #[test]
    fn new_user_is_pending_and_can_authenticate() {
        let user = sample();
        assert_eq!(user.status, UserStatus::PendingVerification);
        assert!(user.can_authenticate());
    }

    #[test]
    fn verification_activates_and_is_idempotent() {
        let mut user = sample();
        user.verify(OffsetDateTime::UNIX_EPOCH).unwrap();
        assert_eq!(user.status, UserStatus::Active);
        user.verify(OffsetDateTime::UNIX_EPOCH).unwrap();
        assert_eq!(user.status, UserStatus::Active);
    }

    #[test]
    fn disabled_account_cannot_authenticate_or_verify() {
        let mut user = sample();
        user.status = UserStatus::Disabled;
        assert!(!user.can_authenticate());
        assert!(user.verify(OffsetDateTime::UNIX_EPOCH).is_err());
    }
}
