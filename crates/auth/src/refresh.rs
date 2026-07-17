//! Opaque refresh tokens.
//!
//! A refresh token consists of a random plaintext value handed to the client
//! and a deterministic SHA-256 hash stored server-side. Because the hash is
//! deterministic, database lookups can be performed by hashing the presented
//! plaintext and matching against the stored hash column.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use rand::RngCore as _;
use sha2::{Digest, Sha256};

/// Number of random bytes backing a refresh token's plaintext.
const REFRESH_TOKEN_BYTES: usize = 32;

/// A freshly generated refresh token: the `plaintext` is returned to the
/// client while the `hash` is persisted server-side.
pub struct RefreshToken {
    /// URL-safe base64 (no padding) encoded random value given to the client.
    pub plaintext: String,
    /// Deterministic SHA-256 hex hash of the plaintext, stored server-side.
    pub hash: String,
}

/// Generate a new refresh token from 32 bytes of cryptographically secure
/// randomness.
pub fn generate_refresh_token() -> RefreshToken {
    let mut bytes = [0u8; REFRESH_TOKEN_BYTES];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    let plaintext = URL_SAFE_NO_PAD.encode(bytes);
    let hash = hash_refresh_token(&plaintext);
    RefreshToken { plaintext, hash }
}

/// Compute the deterministic lowercase-hex SHA-256 hash of a refresh token's
/// plaintext. The same plaintext always yields the same hash.
pub fn hash_refresh_token(plaintext: &str) -> String {
    let digest = Sha256::digest(plaintext.as_bytes());
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        use std::fmt::Write as _;
        let _ = write!(out, "{byte:02x}");
    }
    out
}

/// Verify a presented refresh token plaintext against an expected stored hash.
///
/// In practice, lookups are performed by hashing the plaintext and querying the
/// database for the matching hash; this helper compares the recomputed hash to
/// the expected value.
pub fn verify_refresh_token(plaintext: &str, expected_hash: &str) -> bool {
    hash_refresh_token(plaintext) == expected_hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_is_deterministic() {
        let a = hash_refresh_token("some-token-value");
        let b = hash_refresh_token("some-token-value");
        assert_eq!(a, b);
        assert_eq!(a.len(), 64, "sha-256 hex is 64 chars");
    }

    #[test]
    fn generated_token_verifies() {
        let token = generate_refresh_token();
        assert_eq!(token.hash, hash_refresh_token(&token.plaintext));
        assert!(verify_refresh_token(&token.plaintext, &token.hash));
    }

    #[test]
    fn wrong_plaintext_is_rejected() {
        let token = generate_refresh_token();
        assert!(!verify_refresh_token("not-the-token", &token.hash));
    }

    #[test]
    fn distinct_tokens_are_generated() {
        let a = generate_refresh_token();
        let b = generate_refresh_token();
        assert_ne!(a.plaintext, b.plaintext);
        assert_ne!(a.hash, b.hash);
    }
}
