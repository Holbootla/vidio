use crate::error::{AppError, AppResult};
use crate::ports::ProfileRepository;
use domain::{Profile, ProfileId, UserId};
use std::sync::Arc;

/// Loads a profile and verifies it belongs to the given user.
///
/// Returns [`AppError::NotFound`] when the profile does not exist and
/// [`AppError::Forbidden`] when it belongs to a different user.
pub(crate) async fn authorize_profile(
    profiles: &Arc<dyn ProfileRepository>,
    user_id: UserId,
    profile_id: ProfileId,
) -> AppResult<Profile> {
    let profile = profiles
        .find_by_id(profile_id)
        .await?
        .ok_or_else(|| AppError::not_found("profile not found"))?;
    if profile.user_id != user_id {
        return Err(AppError::forbidden("profile does not belong to user"));
    }
    Ok(profile)
}
