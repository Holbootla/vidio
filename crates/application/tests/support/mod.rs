//! Shared test harness wiring services to in-memory repositories.
#![allow(dead_code)]

use addon_runtime::{MockAddonClient, UrlPolicy};
use application::services::AuthConfig;
use application::{AddonService, AuthService, FixedClock, ProfileService};
use auth::AccessTokenEncoder;
use persistence::InMemoryRepositories;
use std::sync::Arc;
use time::OffsetDateTime;

pub struct Harness {
    pub repos: InMemoryRepositories,
    pub clock: FixedClock,
    pub tokens: Arc<AccessTokenEncoder>,
    pub addon_client: Arc<MockAddonClient>,
}

impl Harness {
    pub fn new() -> Self {
        Self {
            repos: InMemoryRepositories::new(),
            clock: FixedClock::new(OffsetDateTime::UNIX_EPOCH),
            tokens: Arc::new(AccessTokenEncoder::new(b"0123456789abcdef0123456789abcdef")),
            addon_client: Arc::new(MockAddonClient::new()),
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

    pub fn profile(&self) -> ProfileService {
        ProfileService::new(
            self.repos.profiles.clone(),
            self.repos.changes.clone(),
            Arc::new(self.clock.clone()),
        )
    }

    pub fn addon(&self) -> AddonService {
        AddonService::new(
            self.repos.addons.clone(),
            self.repos.profiles.clone(),
            self.repos.changes.clone(),
            self.addon_client.clone(),
            Arc::new(self.clock.clone()),
            UrlPolicy::secure(),
        )
    }
}

impl Default for Harness {
    fn default() -> Self {
        Self::new()
    }
}
