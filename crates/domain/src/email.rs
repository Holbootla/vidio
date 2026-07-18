use crate::error::{DomainError, DomainResult};
use serde::{Deserialize, Serialize};
use std::fmt;

/// A validated, normalized email address.
///
/// Validation is intentionally pragmatic (not full RFC 5322): the goal is to
/// reject obviously malformed input while normalizing case so lookups are
/// stable. Deliverability is confirmed separately via a verification email.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize)]
#[serde(transparent)]
pub struct EmailAddress(String);

impl EmailAddress {
    /// Parses and normalizes an email address (trimmed, lowercased).
    pub fn parse(raw: impl AsRef<str>) -> DomainResult<Self> {
        let trimmed = raw.as_ref().trim();
        if trimmed.is_empty() {
            return Err(DomainError::validation("email must not be empty"));
        }
        if trimmed.len() > 254 {
            return Err(DomainError::validation(
                "email must be at most 254 characters",
            ));
        }
        if trimmed.chars().any(char::is_whitespace) {
            return Err(DomainError::validation("email must not contain whitespace"));
        }

        let (local, domain) = trimmed
            .split_once('@')
            .ok_or_else(|| DomainError::validation("email must contain '@'"))?;

        if local.is_empty() || local.len() > 64 {
            return Err(DomainError::validation("email local part is invalid"));
        }
        if domain.is_empty()
            || !domain.contains('.')
            || domain.starts_with('.')
            || domain.ends_with('.')
        {
            return Err(DomainError::validation("email domain is invalid"));
        }
        if domain.contains("..") {
            return Err(DomainError::validation("email domain has empty label"));
        }
        if trimmed.matches('@').count() != 1 {
            return Err(DomainError::validation(
                "email must contain exactly one '@'",
            ));
        }

        Ok(Self(trimmed.to_ascii_lowercase()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn into_string(self) -> String {
        self.0
    }
}

impl fmt::Display for EmailAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for EmailAddress {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        EmailAddress::parse(raw).map_err(serde::de::Error::custom)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_and_normalizes_valid_addresses() {
        let email = EmailAddress::parse("  Alice.Example+tag@Example.COM ").unwrap();
        assert_eq!(email.as_str(), "alice.example+tag@example.com");
    }

    #[test]
    fn rejects_invalid_addresses() {
        for invalid in [
            "",
            "no-at-sign",
            "@example.com",
            "user@",
            "user@nodot",
            "user@.com",
            "user@com.",
            "user@ex..com",
            "two@@example.com",
            "has space@example.com",
        ] {
            assert!(
                EmailAddress::parse(invalid).is_err(),
                "expected {invalid:?} to be rejected"
            );
        }
    }

    #[test]
    fn deserializes_with_validation() {
        let ok: EmailAddress = serde_json::from_str("\"User@Example.com\"").unwrap();
        assert_eq!(ok.as_str(), "user@example.com");
        assert!(serde_json::from_str::<EmailAddress>("\"invalid\"").is_err());
    }
}
