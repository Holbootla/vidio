//! HTTP route handlers wiring the use-case services to Axum.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{delete, get, patch, post, put};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};

use domain::{InstallationId, MediaKey, ProfileId};

use crate::dto::{
    device_info, AddLibraryRequest, AddonDto, AuthResponse, InstallAddonRequest, LoginRequest,
    LogoutRequest, PatchAddonRequest, ProgressRequest, RefreshRequest, RegisterRequest,
    RegisterResponse, RenameProfileRequest, ReorderAddonsRequest, UserDto,
};
use crate::error::ApiResult;
use crate::extract::AuthUser;
use crate::state::AppState;
use application::AppError;

/// Assembles all routes into a [`Router`] parameterized by [`AppState`].
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/v1/auth/register", post(register))
        .route("/v1/auth/login", post(login))
        .route("/v1/auth/refresh", post(refresh))
        .route("/v1/auth/logout", post(logout))
        .route("/v1/me", get(me))
        .route("/v1/profiles", get(list_profiles))
        .route("/v1/profiles/{profile_id}", get(get_profile))
        .route("/v1/profiles/{profile_id}", patch(rename_profile))
        .route(
            "/v1/profiles/{profile_id}/preferences",
            get(get_preferences).put(put_preferences),
        )
        .route(
            "/v1/profiles/{profile_id}/addons",
            get(list_addons).post(install_addon),
        )
        .route(
            "/v1/profiles/{profile_id}/addons/reorder",
            post(reorder_addons),
        )
        .route(
            "/v1/profiles/{profile_id}/addons/{installation_id}",
            patch(patch_addon).delete(remove_addon),
        )
        .route(
            "/v1/profiles/{profile_id}/addons/{installation_id}/refresh",
            post(refresh_addon),
        )
        .route("/v1/profiles/{profile_id}/home", get(home))
        .route("/v1/profiles/{profile_id}/search", get(search))
        .route(
            "/v1/profiles/{profile_id}/meta/{content_type}/{id}",
            get(meta),
        )
        .route(
            "/v1/profiles/{profile_id}/streams/{content_type}/{video_id}",
            get(streams),
        )
        .route(
            "/v1/profiles/{profile_id}/subtitles/{content_type}/{id}",
            get(subtitles),
        )
        .route("/v1/profiles/{profile_id}/progress", put(put_progress))
        .route(
            "/v1/profiles/{profile_id}/continue-watching",
            get(continue_watching),
        )
        .route("/v1/profiles/{profile_id}/history", get(history))
        .route(
            "/v1/profiles/{profile_id}/library",
            get(list_library).post(add_library),
        )
        .route(
            "/v1/profiles/{profile_id}/library/{*media_key}",
            delete(remove_library),
        )
        .route("/v1/profiles/{profile_id}/sync", get(sync))
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
}

async fn health() -> impl IntoResponse {
    Json(HealthResponse { status: "ok" })
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> ApiResult<(StatusCode, Json<RegisterResponse>)> {
    let outcome = state
        .auth
        .register(&body.email, &body.password, body.profile_name.as_deref())
        .await?;
    let response = RegisterResponse {
        user: UserDto::from_user(&outcome.user),
        profile: outcome.profile,
    };
    Ok((StatusCode::CREATED, Json(response)))
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> ApiResult<Json<AuthResponse>> {
    let tokens = state
        .auth
        .login(&body.email, &body.password, device_info(body.device))
        .await?;
    Ok(Json(AuthResponse::from_tokens(tokens)))
}

async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> ApiResult<Json<AuthResponse>> {
    let tokens = state
        .auth
        .refresh(&body.refresh_token, Default::default())
        .await?;
    Ok(Json(AuthResponse::from_tokens(tokens)))
}

async fn logout(
    State(state): State<AppState>,
    Json(body): Json<LogoutRequest>,
) -> ApiResult<StatusCode> {
    state.auth.logout(&body.refresh_token).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Account / profiles
// ---------------------------------------------------------------------------

async fn me(State(state): State<AppState>, AuthUser(ctx): AuthUser) -> ApiResult<Json<UserDto>> {
    let user = state
        .users
        .find_by_id(ctx.user_id)
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::not_found("user not found"))?;
    Ok(Json(UserDto::from_user(&user)))
}

async fn list_profiles(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
) -> ApiResult<Json<Vec<domain::Profile>>> {
    let profiles = state.profiles.list(ctx.user_id).await?;
    Ok(Json(profiles))
}

async fn get_profile(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
) -> ApiResult<Json<domain::Profile>> {
    let profile = state
        .profiles
        .get(ctx.user_id, ProfileId::from_uuid(profile_id))
        .await?;
    Ok(Json(profile))
}

async fn rename_profile(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
    Json(body): Json<RenameProfileRequest>,
) -> ApiResult<Json<domain::Profile>> {
    let profile = state
        .profiles
        .rename(ctx.user_id, ProfileId::from_uuid(profile_id), &body.name)
        .await?;
    Ok(Json(profile))
}

async fn get_preferences(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
) -> ApiResult<Json<domain::ProfilePreferences>> {
    let profile = state
        .profiles
        .get(ctx.user_id, ProfileId::from_uuid(profile_id))
        .await?;
    Ok(Json(profile.preferences))
}

async fn put_preferences(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
    Json(preferences): Json<domain::ProfilePreferences>,
) -> ApiResult<Json<domain::Profile>> {
    let profile = state
        .profiles
        .update_preferences(ctx.user_id, ProfileId::from_uuid(profile_id), preferences)
        .await?;
    Ok(Json(profile))
}

// ---------------------------------------------------------------------------
// Add-ons
// ---------------------------------------------------------------------------

async fn list_addons(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
) -> ApiResult<Json<Vec<AddonDto>>> {
    let addons = state
        .addons
        .list(ctx.user_id, ProfileId::from_uuid(profile_id))
        .await?;
    Ok(Json(AddonDto::from_installations(&addons)))
}

async fn install_addon(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
    Json(body): Json<InstallAddonRequest>,
) -> ApiResult<(StatusCode, Json<AddonDto>)> {
    let addon = state
        .addons
        .install(
            ctx.user_id,
            ProfileId::from_uuid(profile_id),
            &body.transport_url,
        )
        .await?;
    Ok((
        StatusCode::CREATED,
        Json(AddonDto::from_installation(&addon)),
    ))
}

async fn patch_addon(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path((profile_id, installation_id)): Path<(uuid::Uuid, uuid::Uuid)>,
    Json(body): Json<PatchAddonRequest>,
) -> ApiResult<Json<AddonDto>> {
    let profile_id = ProfileId::from_uuid(profile_id);
    let installation_id = InstallationId::from_uuid(installation_id);
    let addon = match body.enabled {
        Some(enabled) => {
            state
                .addons
                .set_enabled(ctx.user_id, profile_id, installation_id, enabled)
                .await?
        }
        None => {
            let addons = state.addons.list(ctx.user_id, profile_id).await?;
            addons
                .into_iter()
                .find(|a| a.id == installation_id)
                .ok_or_else(|| AppError::not_found("add-on not found"))?
        }
    };
    Ok(Json(AddonDto::from_installation(&addon)))
}

async fn remove_addon(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path((profile_id, installation_id)): Path<(uuid::Uuid, uuid::Uuid)>,
) -> ApiResult<StatusCode> {
    state
        .addons
        .remove(
            ctx.user_id,
            ProfileId::from_uuid(profile_id),
            InstallationId::from_uuid(installation_id),
        )
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn refresh_addon(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path((profile_id, installation_id)): Path<(uuid::Uuid, uuid::Uuid)>,
) -> ApiResult<Json<AddonDto>> {
    let addon = state
        .addons
        .refresh(
            ctx.user_id,
            ProfileId::from_uuid(profile_id),
            InstallationId::from_uuid(installation_id),
        )
        .await?;
    Ok(Json(AddonDto::from_installation(&addon)))
}

async fn reorder_addons(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
    Json(body): Json<ReorderAddonsRequest>,
) -> ApiResult<Json<Vec<AddonDto>>> {
    let ordered: Vec<InstallationId> = body
        .order
        .into_iter()
        .map(InstallationId::from_uuid)
        .collect();
    let addons = state
        .addons
        .reorder(ctx.user_id, ProfileId::from_uuid(profile_id), &ordered)
        .await?;
    Ok(Json(AddonDto::from_installations(&addons)))
}

// ---------------------------------------------------------------------------
// Discovery / playback
// ---------------------------------------------------------------------------

async fn home(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
) -> ApiResult<Json<application::DiscoveryResponse>> {
    let response = state
        .discovery
        .home(ctx.user_id, ProfileId::from_uuid(profile_id))
        .await?;
    Ok(Json(response))
}

#[derive(Debug, Deserialize)]
struct SearchQuery {
    q: String,
}

async fn search(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
    Query(query): Query<SearchQuery>,
) -> ApiResult<Json<application::DiscoveryResponse>> {
    let response = state
        .discovery
        .search(ctx.user_id, ProfileId::from_uuid(profile_id), &query.q)
        .await?;
    Ok(Json(response))
}

async fn meta(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path((profile_id, content_type, id)): Path<(uuid::Uuid, String, String)>,
) -> ApiResult<Json<addon_protocol::Meta>> {
    let meta = state
        .discovery
        .resolve_meta(
            ctx.user_id,
            ProfileId::from_uuid(profile_id),
            &content_type,
            &id,
        )
        .await?;
    Ok(Json(meta))
}

async fn streams(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path((profile_id, content_type, video_id)): Path<(uuid::Uuid, String, String)>,
) -> ApiResult<Json<application::StreamResolution>> {
    let resolution = state
        .playback
        .resolve_streams(
            ctx.user_id,
            ProfileId::from_uuid(profile_id),
            &content_type,
            &video_id,
        )
        .await?;
    Ok(Json(resolution))
}

async fn subtitles(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path((profile_id, content_type, id)): Path<(uuid::Uuid, String, String)>,
) -> ApiResult<Json<application::SubtitleResolution>> {
    let resolution = state
        .playback
        .resolve_subtitles(
            ctx.user_id,
            ProfileId::from_uuid(profile_id),
            &content_type,
            &id,
        )
        .await?;
    Ok(Json(resolution))
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

async fn put_progress(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
    Json(body): Json<ProgressRequest>,
) -> ApiResult<Json<domain::PlaybackProgress>> {
    let progress = state
        .progress
        .update(ctx.user_id, ProfileId::from_uuid(profile_id), body.into())
        .await?;
    Ok(Json(progress))
}

async fn continue_watching(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
) -> ApiResult<Json<Vec<domain::PlaybackProgress>>> {
    let items = state
        .progress
        .continue_watching(ctx.user_id, ProfileId::from_uuid(profile_id), 50)
        .await?;
    Ok(Json(items))
}

async fn history(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
) -> ApiResult<Json<Vec<domain::PlaybackProgress>>> {
    let items = state
        .progress
        .history(ctx.user_id, ProfileId::from_uuid(profile_id), 100)
        .await?;
    Ok(Json(items))
}

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

async fn list_library(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
) -> ApiResult<Json<Vec<domain::LibraryEntry>>> {
    let entries = state
        .library
        .list(ctx.user_id, ProfileId::from_uuid(profile_id))
        .await?;
    Ok(Json(entries))
}

async fn add_library(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
    Json(body): Json<AddLibraryRequest>,
) -> ApiResult<(StatusCode, Json<domain::LibraryEntry>)> {
    let entry = state
        .library
        .add(ctx.user_id, ProfileId::from_uuid(profile_id), body.into())
        .await?;
    Ok((StatusCode::CREATED, Json(entry)))
}

async fn remove_library(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path((profile_id, media_key)): Path<(uuid::Uuid, String)>,
) -> ApiResult<StatusCode> {
    let media_key = media_key
        .parse::<MediaKey>()
        .map_err(|_| AppError::validation("malformed media key"))?;
    state
        .library
        .remove(ctx.user_id, ProfileId::from_uuid(profile_id), &media_key)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct SyncQuery {
    #[serde(default)]
    after: u64,
    #[serde(default = "default_sync_limit")]
    limit: usize,
}

fn default_sync_limit() -> usize {
    100
}

async fn sync(
    State(state): State<AppState>,
    AuthUser(ctx): AuthUser,
    Path(profile_id): Path<uuid::Uuid>,
    Query(query): Query<SyncQuery>,
) -> ApiResult<Json<application::SyncPage>> {
    let page = state
        .sync
        .pull(
            ctx.user_id,
            ProfileId::from_uuid(profile_id),
            query.after,
            query.limit,
        )
        .await?;
    Ok(Json(page))
}
