//! Shared test harness wiring services to in-memory repositories.
#![allow(dead_code)]

use addon_runtime::{MockAddonClient, UrlPolicy};
use application::services::AuthConfig;
use application::{
    AddonService, AuthService, DiscoveryConfig, DiscoveryService, FixedClock, LibraryService,
    PlaybackService, ProfileService, ProgressService, SyncService,
};
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

    pub fn discovery(&self) -> DiscoveryService {
        DiscoveryService::new(
            self.repos.addons.clone(),
            self.repos.profiles.clone(),
            self.addon_client.clone(),
            DiscoveryConfig::default(),
        )
    }

    pub fn playback(&self) -> PlaybackService {
        PlaybackService::new(
            self.repos.addons.clone(),
            self.repos.profiles.clone(),
            self.addon_client.clone(),
            DiscoveryConfig::default(),
        )
    }

    pub fn library(&self) -> LibraryService {
        LibraryService::new(
            self.repos.library.clone(),
            self.repos.profiles.clone(),
            self.repos.changes.clone(),
            Arc::new(self.clock.clone()),
        )
    }

    pub fn progress(&self) -> ProgressService {
        ProgressService::new(
            self.repos.progress.clone(),
            self.repos.profiles.clone(),
            self.repos.changes.clone(),
            Arc::new(self.clock.clone()),
        )
    }

    pub fn sync(&self) -> SyncService {
        SyncService::new(self.repos.changes.clone(), self.repos.profiles.clone())
    }
}

impl Default for Harness {
    fn default() -> Self {
        Self::new()
    }
}
