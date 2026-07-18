//! Authentication primitives: password hashing, access and refresh tokens.
//!
//! This crate provides pure, dependency-light building blocks for
//! authentication. It performs no database access and no HTTP work; callers are
//! expected to wire these primitives into their own storage and transport
//! layers.
#![forbid(unsafe_code)]

pub mod error;
pub mod password;
pub mod refresh;
pub mod tokens;

pub use error::{AuthError, AuthResult};
pub use password::{
    hash_password, validate_password_strength, verify_password, MAX_PASSWORD_LEN, MIN_PASSWORD_LEN,
};
pub use refresh::{generate_refresh_token, hash_refresh_token, verify_refresh_token, RefreshToken};
pub use tokens::{AccessClaims, AccessTokenEncoder};
