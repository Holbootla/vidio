//! Password strength validation, hashing (Argon2id) and verification.

use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;

use crate::error::{AuthError, AuthResult};

/// Minimum accepted password length, in bytes.
pub const MIN_PASSWORD_LEN: usize = 8;

/// Maximum accepted password length, in bytes.
pub const MAX_PASSWORD_LEN: usize = 512;

/// Validate that a plaintext password meets basic strength requirements.
///
/// Returns [`AuthError::WeakPassword`] with a helpful message when the length
/// falls outside of `[MIN_PASSWORD_LEN, MAX_PASSWORD_LEN]`.
pub fn validate_password_strength(plain: &str) -> AuthResult<()> {
    let len = plain.len();
    if len < MIN_PASSWORD_LEN {
        return Err(AuthError::WeakPassword(format!(
            "password must be at least {MIN_PASSWORD_LEN} characters"
        )));
    }
    if len > MAX_PASSWORD_LEN {
        return Err(AuthError::WeakPassword(format!(
            "password must be at most {MAX_PASSWORD_LEN} characters"
        )));
    }
    Ok(())
}

/// Hash a plaintext password with Argon2id using a random salt.
///
/// The password is validated with [`validate_password_strength`] first, then
/// hashed and returned as a PHC string suitable for storage.
pub fn hash_password(plain: &str) -> AuthResult<String> {
    validate_password_strength(plain)?;

    let salt = SaltString::generate(&mut rand::rngs::OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(plain.as_bytes(), &salt)
        .map_err(|e| AuthError::Hashing(e.to_string()))?;
    Ok(hash.to_string())
}

/// Verify a plaintext password against a stored PHC hash string.
///
/// Returns `Ok(true)` when the password matches, `Ok(false)` on a genuine
/// mismatch, and [`AuthError::Hashing`] for malformed hashes or other failures.
pub fn verify_password(plain: &str, phc: &str) -> AuthResult<bool> {
    let parsed = PasswordHash::new(phc).map_err(|e| AuthError::Hashing(e.to_string()))?;
    match Argon2::default().verify_password(plain.as_bytes(), &parsed) {
        Ok(()) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(AuthError::Hashing(e.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_round_trip() {
        let phc = hash_password("correct horse battery").unwrap();
        assert!(verify_password("correct horse battery", &phc).unwrap());
    }

    #[test]
    fn wrong_password_returns_false() {
        let phc = hash_password("correct horse battery").unwrap();
        assert!(!verify_password("wrong horse battery", &phc).unwrap());
    }

    #[test]
    fn same_password_produces_different_hashes() {
        let a = hash_password("correct horse battery").unwrap();
        let b = hash_password("correct horse battery").unwrap();
        assert_ne!(a, b, "random salt should make hashes differ");
    }

    #[test]
    fn too_short_password_is_rejected() {
        let err = hash_password("short").unwrap_err();
        assert!(matches!(err, AuthError::WeakPassword(_)));
    }

    #[test]
    fn too_long_password_is_rejected() {
        let long = "a".repeat(MAX_PASSWORD_LEN + 1);
        let err = validate_password_strength(&long).unwrap_err();
        assert!(matches!(err, AuthError::WeakPassword(_)));
    }

    #[test]
    fn malformed_hash_is_an_error() {
        let err = verify_password("whatever", "not-a-phc-string").unwrap_err();
        assert!(matches!(err, AuthError::Hashing(_)));
    }
}
