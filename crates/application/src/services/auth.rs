use crate::clock::Clock;
use crate::error::{AppError, AppResult};
use crate::ports::{DeviceRepository, ProfileRepository, SessionRepository, UserRepository};
use auth::{
    generate_refresh_token, hash_password, hash_refresh_token, validate_password_strength,
    verify_password, AccessTokenEncoder,
};
use domain::{
    Device, DevicePlatform, EmailAddress, PasswordHash, Profile, ProfileId, Session, SessionId,
    User, UserId,
};
use std::sync::Arc;
use time::{Duration, OffsetDateTime};

/// Token lifetimes.
#[derive(Debug, Clone, Copy)]
pub struct AuthConfig {
    pub access_ttl: Duration,
    pub refresh_ttl: Duration,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            access_ttl: Duration::minutes(15),
            refresh_ttl: Duration::days(30),
        }
    }
}

/// Details about the device performing an authentication.
#[derive(Debug, Clone)]
pub struct DeviceInfo {
    pub platform: DevicePlatform,
    pub display_name: String,
    pub app_version: Option<String>,
}

impl Default for DeviceInfo {
    fn default() -> Self {
        Self {
            platform: DevicePlatform::Other,
            display_name: "Unknown device".to_string(),
            app_version: None,
        }
    }
}

/// Result of registering a new account.
#[derive(Debug, Clone)]
pub struct RegisterOutcome {
    pub user: User,
    pub profile: Profile,
}

/// A freshly issued token pair plus context.
#[derive(Debug, Clone)]
pub struct AuthTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub access_expires_at: OffsetDateTime,
    pub refresh_expires_at: OffsetDateTime,
    pub session_id: SessionId,
    pub user_id: UserId,
    pub profile: Profile,
}

/// The authenticated principal derived from an access token.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AuthContext {
    pub user_id: UserId,
    pub session_id: SessionId,
}

/// Use cases for registration, login, token refresh and logout.
#[derive(Clone)]
pub struct AuthService {
    users: Arc<dyn UserRepository>,
    profiles: Arc<dyn ProfileRepository>,
    sessions: Arc<dyn SessionRepository>,
    devices: Arc<dyn DeviceRepository>,
    tokens: Arc<AccessTokenEncoder>,
    clock: Arc<dyn Clock>,
    config: AuthConfig,
}

impl AuthService {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        users: Arc<dyn UserRepository>,
        profiles: Arc<dyn ProfileRepository>,
        sessions: Arc<dyn SessionRepository>,
        devices: Arc<dyn DeviceRepository>,
        tokens: Arc<AccessTokenEncoder>,
        clock: Arc<dyn Clock>,
        config: AuthConfig,
    ) -> Self {
        Self {
            users,
            profiles,
            sessions,
            devices,
            tokens,
            clock,
            config,
        }
    }

    /// Registers a new account and its default profile.
    pub async fn register(
        &self,
        email: &str,
        password: &str,
        profile_name: Option<&str>,
    ) -> AppResult<RegisterOutcome> {
        let email = EmailAddress::parse(email)?;
        validate_password_strength(password)?;

        if self.users.find_by_email(&email).await?.is_some() {
            return Err(AppError::conflict("email is already registered"));
        }

        let now = self.clock.now();
        let hashed = hash_password(password)?;
        let user = User::register(
            UserId::new(),
            email,
            PasswordHash::from_encoded(hashed),
            now,
        );
        self.users.create(&user).await?;

        let profile = Profile::new_default(
            ProfileId::new(),
            user.id,
            profile_name.unwrap_or("Default"),
            now,
        )?;
        self.profiles.create(&profile).await?;

        Ok(RegisterOutcome { user, profile })
    }

    /// Authenticates a user and issues a new token pair.
    pub async fn login(
        &self,
        email: &str,
        password: &str,
        device: DeviceInfo,
    ) -> AppResult<AuthTokens> {
        let email = EmailAddress::parse(email)
            .map_err(|_| AppError::Unauthorized("invalid credentials".into()))?;
        let user = self
            .users
            .find_by_email(&email)
            .await?
            .ok_or_else(|| AppError::Unauthorized("invalid credentials".into()))?;

        if !verify_password(password, user.password_hash.as_str())? {
            return Err(AppError::Unauthorized("invalid credentials".into()));
        }
        if !user.can_authenticate() {
            return Err(AppError::forbidden("account is disabled"));
        }

        let profile = self.default_profile(user.id).await?;
        self.issue_session(user.id, profile, device).await
    }

    /// Rotates a refresh token, detecting reuse of already-rotated tokens.
    pub async fn refresh(&self, refresh_token: &str, device: DeviceInfo) -> AppResult<AuthTokens> {
        let hash = hash_refresh_token(refresh_token);
        let mut session = self
            .sessions
            .find_by_token_hash(&hash)
            .await?
            .ok_or_else(|| AppError::Unauthorized("invalid refresh token".into()))?;

        let now = self.clock.now();
        if !session.is_active(now) {
            // A revoked/rotated token being presented again indicates theft:
            // revoke the whole session family defensively.
            if session.revoked_at.is_some() || session.rotated_to.is_some() {
                self.sessions
                    .revoke_all_for_user(session.user_id, now)
                    .await?;
                return Err(AppError::Unauthorized(
                    "refresh token reuse detected".into(),
                ));
            }
            return Err(AppError::Unauthorized("refresh token expired".into()));
        }

        let user = self
            .users
            .find_by_id(session.user_id)
            .await?
            .ok_or_else(|| AppError::Unauthorized("invalid refresh token".into()))?;
        if !user.can_authenticate() {
            return Err(AppError::forbidden("account is disabled"));
        }

        let profile = self.default_profile(user.id).await?;

        // Mint the successor session, then link the old one to it.
        let refresh = generate_refresh_token();
        let new_session = Session {
            id: SessionId::new(),
            user_id: user.id,
            device_id: session.device_id,
            refresh_token_hash: refresh.hash,
            issued_at: now,
            expires_at: now + self.config.refresh_ttl,
            revoked_at: None,
            rotated_to: None,
        };
        self.sessions.create(&new_session).await?;
        session.rotated_to = Some(new_session.id);
        self.sessions.update(&session).await?;

        self.touch_device(session.device_id, device).await?;
        let access_token = self.tokens.issue(
            user.id.as_uuid(),
            new_session.id.as_uuid(),
            self.config.access_ttl,
            now,
        )?;

        Ok(AuthTokens {
            access_token,
            refresh_token: refresh.plaintext,
            access_expires_at: now + self.config.access_ttl,
            refresh_expires_at: new_session.expires_at,
            session_id: new_session.id,
            user_id: user.id,
            profile,
        })
    }

    /// Revokes the session associated with a refresh token (idempotent).
    pub async fn logout(&self, refresh_token: &str) -> AppResult<()> {
        let hash = hash_refresh_token(refresh_token);
        if let Some(mut session) = self.sessions.find_by_token_hash(&hash).await? {
            session.revoke(self.clock.now());
            self.sessions.update(&session).await?;
        }
        Ok(())
    }

    /// Verifies an access token statelessly, returning the principal.
    pub fn verify_access_token(&self, token: &str) -> AppResult<AuthContext> {
        let claims = self.tokens.decode(token, self.clock.now())?;
        let user_id = claims
            .sub
            .parse::<UserId>()
            .map_err(|_| AppError::Unauthorized("malformed token subject".into()))?;
        let session_id = claims
            .sid
            .parse::<SessionId>()
            .map_err(|_| AppError::Unauthorized("malformed token session".into()))?;
        Ok(AuthContext {
            user_id,
            session_id,
        })
    }

    async fn default_profile(&self, user_id: UserId) -> AppResult<Profile> {
        let profiles = self.profiles.list_by_user(user_id).await?;
        profiles
            .iter()
            .find(|p| p.is_default)
            .or_else(|| profiles.first())
            .cloned()
            .ok_or_else(|| AppError::Internal("user has no profile".into()))
    }

    async fn issue_session(
        &self,
        user_id: UserId,
        profile: Profile,
        device: DeviceInfo,
    ) -> AppResult<AuthTokens> {
        let now = self.clock.now();
        let device_record = Device {
            id: domain::DeviceId::new(),
            profile_id: profile.id,
            platform: device.platform,
            display_name: device.display_name,
            app_version: device.app_version,
            created_at: now,
            last_seen_at: now,
        };
        self.devices.upsert(&device_record).await?;

        let refresh = generate_refresh_token();
        let session = Session {
            id: SessionId::new(),
            user_id,
            device_id: device_record.id,
            refresh_token_hash: refresh.hash,
            issued_at: now,
            expires_at: now + self.config.refresh_ttl,
            revoked_at: None,
            rotated_to: None,
        };
        self.sessions.create(&session).await?;

        let access_token = self.tokens.issue(
            user_id.as_uuid(),
            session.id.as_uuid(),
            self.config.access_ttl,
            now,
        )?;

        Ok(AuthTokens {
            access_token,
            refresh_token: refresh.plaintext,
            access_expires_at: now + self.config.access_ttl,
            refresh_expires_at: session.expires_at,
            session_id: session.id,
            user_id,
            profile,
        })
    }

    async fn touch_device(&self, device_id: domain::DeviceId, device: DeviceInfo) -> AppResult<()> {
        if let Some(mut existing) = self.devices.find_by_id(device_id).await? {
            existing.last_seen_at = self.clock.now();
            existing.app_version = device.app_version.or(existing.app_version);
            self.devices.upsert(&existing).await?;
        }
        Ok(())
    }
}
