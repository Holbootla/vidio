//! Stateless HS256 JWT access tokens.

use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation};

use crate::error::{AuthError, AuthResult};

/// Claims embedded in an access token.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct AccessClaims {
    /// Subject: the user id this token authenticates.
    pub sub: String,
    /// Session id this token belongs to.
    pub sid: String,
    /// Issued-at, as a Unix timestamp (seconds).
    pub iat: i64,
    /// Expiry, as a Unix timestamp (seconds).
    pub exp: i64,
    /// Unique token id, allowing individual tokens to be identified.
    pub jti: String,
}

/// Encodes and decodes [`AccessClaims`] using a symmetric HS256 key.
pub struct AccessTokenEncoder {
    encoding: EncodingKey,
    decoding: DecodingKey,
    validation: Validation,
}

impl AccessTokenEncoder {
    /// Build an encoder from a shared secret.
    pub fn new(secret: &[u8]) -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.leeway = 0;
        validation.validate_exp = true;
        Self {
            encoding: EncodingKey::from_secret(secret),
            decoding: DecodingKey::from_secret(secret),
            validation,
        }
    }

    /// Issue a signed access token valid for `ttl` starting at `now`.
    pub fn issue(
        &self,
        user_id: uuid::Uuid,
        session_id: uuid::Uuid,
        ttl: time::Duration,
        now: time::OffsetDateTime,
    ) -> AuthResult<String> {
        let claims = AccessClaims {
            sub: user_id.to_string(),
            sid: session_id.to_string(),
            iat: now.unix_timestamp(),
            exp: (now + ttl).unix_timestamp(),
            jti: uuid::Uuid::new_v4().to_string(),
        };
        jsonwebtoken::encode(&Header::new(Algorithm::HS256), &claims, &self.encoding)
            .map_err(|_| AuthError::TokenInvalid)
    }

    /// Decode and validate a token, returning its claims.
    ///
    /// Expired tokens yield [`AuthError::TokenExpired`]; any other failure
    /// (bad signature, malformed token, etc.) yields [`AuthError::TokenInvalid`].
    pub fn decode(&self, token: &str, now: time::OffsetDateTime) -> AuthResult<AccessClaims> {
        match jsonwebtoken::decode::<AccessClaims>(token, &self.decoding, &self.validation) {
            Ok(data) => {
                if data.claims.exp < now.unix_timestamp() {
                    return Err(AuthError::TokenExpired);
                }
                Ok(data.claims)
            }
            Err(e) => match e.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => Err(AuthError::TokenExpired),
                _ => Err(AuthError::TokenInvalid),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encoder() -> AccessTokenEncoder {
        AccessTokenEncoder::new(b"super-secret-signing-key")
    }

    #[test]
    fn issue_then_decode_round_trip() {
        let enc = encoder();
        let user = uuid::Uuid::new_v4();
        let session = uuid::Uuid::new_v4();
        let now = time::OffsetDateTime::now_utc();

        let token = enc
            .issue(user, session, time::Duration::minutes(15), now)
            .unwrap();
        let claims = enc.decode(&token, now).unwrap();

        assert_eq!(claims.sub, user.to_string());
        assert_eq!(claims.sid, session.to_string());
        assert!(claims.exp > claims.iat);
    }

    #[test]
    fn expired_token_via_negative_ttl_is_rejected() {
        let enc = encoder();
        let now = time::OffsetDateTime::now_utc();
        let token = enc
            .issue(
                uuid::Uuid::new_v4(),
                uuid::Uuid::new_v4(),
                time::Duration::seconds(-10),
                now,
            )
            .unwrap();
        let err = enc.decode(&token, now).unwrap_err();
        assert!(matches!(err, AuthError::TokenExpired));
    }

    #[test]
    fn expired_token_via_future_now_is_rejected() {
        let enc = encoder();
        let now = time::OffsetDateTime::now_utc();
        let token = enc
            .issue(
                uuid::Uuid::new_v4(),
                uuid::Uuid::new_v4(),
                time::Duration::seconds(30),
                now,
            )
            .unwrap();
        let far_future = now + time::Duration::days(365);
        let err = enc.decode(&token, far_future).unwrap_err();
        assert!(matches!(err, AuthError::TokenExpired));
    }

    #[test]
    fn token_from_different_secret_is_invalid() {
        let enc = encoder();
        let other = AccessTokenEncoder::new(b"a-completely-different-key");
        let now = time::OffsetDateTime::now_utc();
        let token = enc
            .issue(
                uuid::Uuid::new_v4(),
                uuid::Uuid::new_v4(),
                time::Duration::minutes(15),
                now,
            )
            .unwrap();
        let err = other.decode(&token, now).unwrap_err();
        assert!(matches!(err, AuthError::TokenInvalid));
    }
}
