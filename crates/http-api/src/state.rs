//! Shared application state and its construction.

use std::sync::Arc;

use application::ports::{
    AddonRepository, ChangeRepository, DeviceRepository, LibraryRepository, ProfileRepository,
    ProgressRepository, SessionRepository, UserRepository,
};
use application::services::{
    AddonService, AuthConfig, AuthService, DiscoveryService, LibraryService, PlaybackService,
    ProfileService, ProgressService, SyncService,
};
use application::{Clock, DiscoveryConfig};
use auth::AccessTokenEncoder;

/// Static configuration required to build the [`AppState`].
pub struct ApiConfig {
    pub access_token_secret: Vec<u8>,
    pub auth: AuthConfig,
    pub discovery: DiscoveryConfig,
    pub addon_policy: addon_runtime::UrlPolicy,
}

/// Cheaply-cloneable bundle of every use-case service, shared by all handlers.
#[derive(Clone)]
pub struct AppState {
    pub auth: AuthService,
    pub profiles: ProfileService,
    pub addons: AddonService,
    pub discovery: DiscoveryService,
    pub playback: PlaybackService,
    pub library: LibraryService,
    pub progress: ProgressService,
    pub sync: SyncService,
    pub users: Arc<dyn UserRepository>,
}

impl AppState {
    /// Wires every service from the shared repositories, add-on client and clock.
    pub fn new(
        repos: &persistence::InMemoryRepositories,
        client: Arc<dyn addon_runtime::AddonClient>,
        clock: Arc<dyn Clock>,
        config: ApiConfig,
    ) -> Self {
        let tokens = Arc::new(AccessTokenEncoder::new(&config.access_token_secret));

        let users: Arc<dyn UserRepository> = repos.users.clone();
        let profiles: Arc<dyn ProfileRepository> = repos.profiles.clone();
        let devices: Arc<dyn DeviceRepository> = repos.devices.clone();
        let sessions: Arc<dyn SessionRepository> = repos.sessions.clone();
        let addons: Arc<dyn AddonRepository> = repos.addons.clone();
        let library: Arc<dyn LibraryRepository> = repos.library.clone();
        let progress: Arc<dyn ProgressRepository> = repos.progress.clone();
        let changes: Arc<dyn ChangeRepository> = repos.changes.clone();

        let auth = AuthService::new(
            users.clone(),
            profiles.clone(),
            sessions.clone(),
            devices.clone(),
            tokens,
            clock.clone(),
            config.auth,
        );
        let profile_service = ProfileService::new(profiles.clone(), changes.clone(), clock.clone());
        let addon_service = AddonService::new(
            addons.clone(),
            profiles.clone(),
            changes.clone(),
            client.clone(),
            clock.clone(),
            config.addon_policy,
        );
        let discovery = DiscoveryService::new(
            addons.clone(),
            profiles.clone(),
            client.clone(),
            config.discovery,
        );
        let playback =
            PlaybackService::new(addons.clone(), profiles.clone(), client, config.discovery);
        let library_service =
            LibraryService::new(library, profiles.clone(), changes.clone(), clock.clone());
        let progress_service =
            ProgressService::new(progress, profiles.clone(), changes.clone(), clock);
        let sync = SyncService::new(changes, profiles);

        Self {
            auth,
            profiles: profile_service,
            addons: addon_service,
            discovery,
            playback,
            library: library_service,
            progress: progress_service,
            sync,
            users,
        }
    }
}
