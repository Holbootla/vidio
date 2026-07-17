//! Application layer: repository ports and use-case services.
//!
//! This layer orchestrates the domain and add-on protocol to implement the
//! product's use cases. It depends on repository *ports* (traits) rather than
//! concrete storage, keeping business logic testable and storage-agnostic.

#![forbid(unsafe_code)]

pub mod clock;
pub mod error;
pub mod fanout;
pub mod models;
pub mod ports;
pub mod services;

pub use clock::{Clock, FixedClock, SystemClock};
pub use error::{AppError, AppResult, RepoError};
pub use models::{NewSyncChange, SyncChange, SyncResourceKind};
pub use services::{
    AddonService, AddonWarning, AuthConfig, AuthContext, AuthService, AuthTokens, CatalogRow,
    DeviceInfo, DiscoveryConfig, DiscoveryResponse, DiscoveryService, PlaybackService,
    ProfileService, RegisterOutcome, ResolvedStream, ResolvedSubtitle, StreamResolution,
    SubtitleResolution,
};
