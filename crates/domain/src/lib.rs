//! Domain layer: pure entities, value objects and errors with no I/O.
//!
//! This crate is the shared vocabulary for the whole backend. It has no
//! dependency on databases, HTTP or the add-on protocol, which keeps its
//! invariants easy to test and reason about.

#![forbid(unsafe_code)]

pub mod addon;
pub mod email;
pub mod error;
pub mod ids;
pub mod library;
pub mod media;
pub mod profile;
pub mod progress;
pub mod session;
pub mod user;

pub use addon::{AddonCapabilities, AddonInstallation};
pub use email::EmailAddress;
pub use error::{DomainError, DomainResult};
pub use ids::{DeviceId, InstallationId, ProfileId, SessionId, UserId};
pub use library::LibraryEntry;
pub use media::{MediaKey, MediaType, VideoKey};
pub use profile::{Profile, ProfilePreferences};
pub use progress::PlaybackProgress;
pub use session::{Device, DevicePlatform, Session};
pub use user::{PasswordHash, User, UserStatus};
