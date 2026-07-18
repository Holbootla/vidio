//! Use-case services orchestrating domain logic over repository ports.

pub mod addon;
pub mod auth;
mod common;
pub mod discovery;
pub mod library;
pub mod playback;
pub mod profile;
pub mod progress;
pub mod sync;

pub use addon::AddonService;
pub use auth::{AuthConfig, AuthContext, AuthService, AuthTokens, DeviceInfo, RegisterOutcome};
pub use discovery::{
    AddonWarning, CatalogRow, DiscoveryConfig, DiscoveryResponse, DiscoveryService,
};
pub use library::{AddLibraryItem, LibraryService};
pub use playback::{
    PlaybackService, ResolvedStream, ResolvedSubtitle, StreamResolution, SubtitleResolution,
};
pub use profile::ProfileService;
pub use progress::{ProgressService, ProgressUpdate};
pub use sync::{SyncPage, SyncService};
