//! Shared test harness wiring services to in-memory repositories.
#![allow(dead_code)]

use application::services::AuthConfig;
use application::{AuthService, FixedClock};
use auth::AccessTokenEncoder;
use persistence::InMemoryRepositories;
use std::sync::Arc;
use time::OffsetDateTime;

pub struct Harness {
    pub repos: InMemoryRepositories,
    pub clock: FixedClock,
    pub tokens: Arc<AccessTokenEncoder>,
}

impl Harness {
    pub fn new() -> Self {
        Self {
            repos: InMemoryRepositories::new(),
            clock: FixedClock::new(OffsetDateTime::UNIX_EPOCH),
            tokens: Arc::new(AccessTokenEncoder::new(b"0123456789abcdef0123456789abcdef")),
        }
    }

    pub fn auth(&self) -> AuthService {
        AuthService::new(
            self.repos.users.clone(),
            self.repos.profiles.clone(),
            self.repos.sessions.clone(),
            self.repos.devices.clone(),
            self.tokens.clone(),
            Arc::new(self.clock.clone()),
            AuthConfig::default(),
        )
    }
}

impl Default for Harness {
    fn default() -> Self {
        Self::new()
    }
}
