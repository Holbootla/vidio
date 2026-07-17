use crate::clock::Clock;
use crate::error::AppResult;
use crate::models::{NewSyncChange, SyncResourceKind};
use crate::ports::{ChangeRepository, ProfileRepository, ProgressRepository};
use crate::services::common::authorize_profile;
use domain::{DeviceId, MediaKey, MediaType, PlaybackProgress, ProfileId, UserId, VideoKey};
use std::sync::Arc;

/// Input describing a playback progress update.
#[derive(Debug, Clone)]
pub struct ProgressUpdate {
    pub content_type: String,
    /// The playable video id (equals the media id for single-video items).
    pub video_id: String,
    /// The owning media (movie/series) id used for grouping.
    pub media_id: String,
    pub manifest_id: String,
    pub position_secs: f64,
    pub duration_secs: f64,
    /// Explicit watched flag; when `None`, completion is inferred by threshold.
    pub watched: Option<bool>,
    pub device_id: Option<DeviceId>,
}

/// Use cases for playback progress, continue-watching and history.
#[derive(Clone)]
pub struct ProgressService {
    progress: Arc<dyn ProgressRepository>,
    profiles: Arc<dyn ProfileRepository>,
    changes: Arc<dyn ChangeRepository>,
    clock: Arc<dyn Clock>,
}

impl ProgressService {
    pub fn new(
        progress: Arc<dyn ProgressRepository>,
        profiles: Arc<dyn ProfileRepository>,
        changes: Arc<dyn ChangeRepository>,
        clock: Arc<dyn Clock>,
    ) -> Self {
        Self {
            progress,
            profiles,
            changes,
            clock,
        }
    }

    /// Records a playback progress update.
    pub async fn update(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        update: ProgressUpdate,
    ) -> AppResult<PlaybackProgress> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let media_type = MediaType::from(update.content_type.as_str());
        let video_key = VideoKey::from_content(&media_type, &update.manifest_id, &update.video_id)?;
        let media_key = MediaKey::from_content(&media_type, &update.manifest_id, &update.media_id)?;
        let now = self.clock.now();

        let mut progress = self
            .progress
            .get(profile_id, &video_key)
            .await?
            .unwrap_or_else(|| {
                PlaybackProgress::new(profile_id, video_key.clone(), media_key.clone(), now)
            });

        progress.record(
            update.position_secs,
            update.duration_secs,
            update.watched,
            update.device_id,
            now,
        )?;

        self.progress.upsert(&progress).await?;
        self.record_change(&progress).await?;
        Ok(progress)
    }

    /// Returns resumable, unfinished items, most recent first.
    pub async fn continue_watching(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        limit: usize,
    ) -> AppResult<Vec<PlaybackProgress>> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        Ok(self
            .progress
            .list_continue_watching(profile_id, limit)
            .await?)
    }

    /// Returns playback history, most recent first.
    pub async fn history(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        limit: usize,
    ) -> AppResult<Vec<PlaybackProgress>> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        Ok(self.progress.list_history(profile_id, limit).await?)
    }

    async fn record_change(&self, progress: &PlaybackProgress) -> AppResult<()> {
        let payload = serde_json::json!({
            "video_key": progress.video_key,
            "media_key": progress.media_key,
            "position_secs": progress.position_secs,
            "duration_secs": progress.duration_secs,
            "watched": progress.watched,
            "revision": progress.revision,
        });
        self.changes
            .append(
                NewSyncChange {
                    profile_id: progress.profile_id,
                    kind: SyncResourceKind::Progress,
                    key: progress.video_key.to_string(),
                    payload,
                    deleted: false,
                },
                self.clock.now(),
            )
            .await?;
        Ok(())
    }
}
