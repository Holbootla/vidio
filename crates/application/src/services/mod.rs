//! Use-case services orchestrating domain logic over repository ports.

pub mod auth;

pub use auth::{AuthConfig, AuthContext, AuthService, AuthTokens, DeviceInfo, RegisterOutcome};
