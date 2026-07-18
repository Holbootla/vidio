//! Request and response data-transfer objects.
//!
//! Response DTOs deliberately omit secret fields that live on the domain
//! entities (`User::password_hash`, `AddonInstallation::transport_url` and
//! `AddonInstallation::manifest_snapshot`), which must never be serialized.

use application::services::{AuthTokens, DeviceInfo};
use application::{AddLibraryItem, ProgressUpdate};
use domain::{
    AddonCapabilities, AddonInstallation, DeviceId, DevicePlatform, Profile, User, UserId,
    UserStatus,
};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

/// A public view of a user account (never exposes the password hash).
#[derive(Debug, Serialize)]
pub struct UserDto {
    pub id: UserId,
    pub email: String,
    pub status: String,
    #[serde(with = "time::serde::rfc3339")]
    pub created_at: OffsetDateTime,
}

impl UserDto {
    pub fn from_user(user: &User) -> Self {
        Self {
            id: user.id,
            email: user.email.as_str().to_string(),
            status: status_str(user.status).to_string(),
            created_at: user.created_at,
        }
    }
}

fn status_str(status: UserStatus) -> &'static str {
    match status {
        UserStatus::PendingVerification => "pending_verification",
        UserStatus::Active => "active",
        UserStatus::Disabled => "disabled",
    }
}

/// A public view of an installed add-on (never exposes the transport url or
/// the raw manifest snapshot).
#[derive(Debug, Serialize)]
pub struct AddonDto {
    pub id: domain::InstallationId,
    pub manifest_id: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub enabled: bool,
    pub priority: i32,
    pub capabilities: AddonCapabilities,
    #[serde(with = "time::serde::rfc3339")]
    pub installed_at: OffsetDateTime,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl AddonDto {
    pub fn from_installation(addon: &AddonInstallation) -> Self {
        Self {
            id: addon.id,
            manifest_id: addon.manifest_id.clone(),
            name: addon.name.clone(),
            version: addon.version.clone(),
            description: addon.description.clone(),
            enabled: addon.enabled,
            priority: addon.priority,
            capabilities: addon.capabilities.clone(),
            installed_at: addon.installed_at,
            updated_at: addon.updated_at,
        }
    }

    pub fn from_installations(addons: &[AddonInstallation]) -> Vec<Self> {
        addons.iter().map(Self::from_installation).collect()
    }
}

/// Registration request body.
#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub profile_name: Option<String>,
}

/// Login request body.
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub device: Option<DeviceRequest>,
}

/// Describes the device performing an authentication.
#[derive(Debug, Deserialize)]
pub struct DeviceRequest {
    pub platform: Option<String>,
    pub display_name: Option<String>,
    pub app_version: Option<String>,
}

/// Maps a device platform string to its domain enum, defaulting to `Other`.
pub fn platform_from_str(value: &str) -> DevicePlatform {
    match value.to_ascii_lowercase().as_str() {
        "web" => DevicePlatform::Web,
        "android" => DevicePlatform::Android,
        "ios" => DevicePlatform::Ios,
        "macos" => DevicePlatform::Macos,
        "windows" => DevicePlatform::Windows,
        "linux" => DevicePlatform::Linux,
        "tizen" => DevicePlatform::Tizen,
        _ => DevicePlatform::Other,
    }
}

impl DeviceRequest {
    /// Converts the request into the application-level [`DeviceInfo`].
    pub fn into_device_info(self) -> DeviceInfo {
        DeviceInfo {
            platform: self
                .platform
                .as_deref()
                .map(platform_from_str)
                .unwrap_or(DevicePlatform::Other),
            display_name: self
                .display_name
                .unwrap_or_else(|| "Unknown device".to_string()),
            app_version: self.app_version,
        }
    }
}

/// Resolves an optional device request into [`DeviceInfo`], using defaults.
pub fn device_info(device: Option<DeviceRequest>) -> DeviceInfo {
    device
        .map(DeviceRequest::into_device_info)
        .unwrap_or_default()
}

/// Refresh request body.
#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

/// Logout request body.
#[derive(Debug, Deserialize)]
pub struct LogoutRequest {
    pub refresh_token: String,
}

/// Profile rename request body.
#[derive(Debug, Deserialize)]
pub struct RenameProfileRequest {
    pub name: String,
}

/// Add-on install request body.
#[derive(Debug, Deserialize)]
pub struct InstallAddonRequest {
    pub transport_url: String,
}

/// Add-on patch request body.
#[derive(Debug, Deserialize)]
pub struct PatchAddonRequest {
    pub enabled: Option<bool>,
}

/// Add-on reorder request body.
#[derive(Debug, Deserialize)]
pub struct ReorderAddonsRequest {
    pub order: Vec<uuid::Uuid>,
}

/// Library add request body.
#[derive(Debug, Deserialize)]
pub struct AddLibraryRequest {
    pub content_type: String,
    pub content_id: String,
    pub manifest_id: String,
    pub name: String,
    pub poster: Option<String>,
    pub meta_snapshot: Option<String>,
}

impl From<AddLibraryRequest> for AddLibraryItem {
    fn from(req: AddLibraryRequest) -> Self {
        AddLibraryItem {
            content_type: req.content_type,
            content_id: req.content_id,
            manifest_id: req.manifest_id,
            name: req.name,
            poster: req.poster,
            meta_snapshot: req.meta_snapshot,
        }
    }
}

/// Playback progress request body.
#[derive(Debug, Deserialize)]
pub struct ProgressRequest {
    pub content_type: String,
    pub video_id: String,
    pub media_id: String,
    pub manifest_id: String,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub watched: Option<bool>,
    pub device_id: Option<uuid::Uuid>,
}

impl From<ProgressRequest> for ProgressUpdate {
    fn from(req: ProgressRequest) -> Self {
        ProgressUpdate {
            content_type: req.content_type,
            video_id: req.video_id,
            media_id: req.media_id,
            manifest_id: req.manifest_id,
            position_secs: req.position_secs,
            duration_secs: req.duration_secs,
            watched: req.watched,
            device_id: req.device_id.map(DeviceId::from_uuid),
        }
    }
}

/// The token pair and profile returned by login/refresh.
#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub token_type: String,
    #[serde(with = "time::serde::rfc3339")]
    pub access_expires_at: OffsetDateTime,
    pub refresh_token: String,
    #[serde(with = "time::serde::rfc3339")]
    pub refresh_expires_at: OffsetDateTime,
    pub profile: Profile,
}

impl AuthResponse {
    pub fn from_tokens(tokens: AuthTokens) -> Self {
        Self {
            access_token: tokens.access_token,
            token_type: "Bearer".to_string(),
            access_expires_at: tokens.access_expires_at,
            refresh_token: tokens.refresh_token,
            refresh_expires_at: tokens.refresh_expires_at,
            profile: tokens.profile,
        }
    }
}

/// Response body for registration.
#[derive(Debug, Serialize)]
pub struct RegisterResponse {
    pub user: UserDto,
    pub profile: Profile,
}
