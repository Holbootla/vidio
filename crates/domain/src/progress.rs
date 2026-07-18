use crate::error::{DomainError, DomainResult};
use crate::ids::{DeviceId, ProfileId};
use crate::media::{MediaKey, VideoKey};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

/// Fraction of a video that must be watched for it to auto-complete.
pub const COMPLETION_THRESHOLD: f64 = 0.9;

/// Materialized playback progress for a single video within a profile.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct PlaybackProgress {
    pub profile_id: ProfileId,
    pub video_key: VideoKey,
    /// The owning media item (movie or series) for grouping.
    pub media_key: MediaKey,
    pub position_secs: f64,
    pub duration_secs: f64,
    pub watched: bool,
    /// Monotonic revision incremented on every accepted update.
    pub revision: u64,
    pub last_device_id: Option<DeviceId>,
    #[serde(with = "time::serde::rfc3339")]
    pub updated_at: OffsetDateTime,
}

impl PlaybackProgress {
    pub fn new(
        profile_id: ProfileId,
        video_key: VideoKey,
        media_key: MediaKey,
        now: OffsetDateTime,
    ) -> Self {
        Self {
            profile_id,
            video_key,
            media_key,
            position_secs: 0.0,
            duration_secs: 0.0,
            watched: false,
            revision: 0,
            last_device_id: None,
            updated_at: now,
        }
    }

    /// Applies a progress update, returning an error on invalid input.
    ///
    /// The video is marked watched when explicitly requested or when the
    /// position crosses [`COMPLETION_THRESHOLD`] of a known duration.
    pub fn record(
        &mut self,
        position_secs: f64,
        duration_secs: f64,
        mark_watched: Option<bool>,
        device_id: Option<DeviceId>,
        now: OffsetDateTime,
    ) -> DomainResult<()> {
        if !position_secs.is_finite() || position_secs < 0.0 {
            return Err(DomainError::validation(
                "position must be a non-negative finite number",
            ));
        }
        if !duration_secs.is_finite() || duration_secs < 0.0 {
            return Err(DomainError::validation(
                "duration must be a non-negative finite number",
            ));
        }
        if duration_secs > 0.0 && position_secs > duration_secs + 1.0 {
            return Err(DomainError::validation("position must not exceed duration"));
        }

        self.position_secs = position_secs;
        self.duration_secs = duration_secs;
        self.watched = match mark_watched {
            Some(explicit) => explicit,
            None => {
                let auto =
                    duration_secs > 0.0 && position_secs / duration_secs >= COMPLETION_THRESHOLD;
                self.watched || auto
            }
        };
        self.last_device_id = device_id;
        self.revision += 1;
        self.updated_at = now;
        Ok(())
    }

    /// Progress as a fraction in `[0, 1]`; zero when duration is unknown.
    pub fn ratio(&self) -> f64 {
        if self.duration_secs <= 0.0 {
            return 0.0;
        }
        (self.position_secs / self.duration_secs).clamp(0.0, 1.0)
    }

    /// True when there is meaningful, resumable progress (not finished).
    pub fn is_in_progress(&self) -> bool {
        !self.watched && self.position_secs > 0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn progress() -> PlaybackProgress {
        let video = VideoKey::from_content(&MediaType::Movie, "a", "tt1").unwrap();
        let media = MediaKey::from_content(&MediaType::Movie, "a", "tt1").unwrap();
        PlaybackProgress::new(ProfileId::new(), video, media, OffsetDateTime::UNIX_EPOCH)
    }

    use crate::media::MediaType;

    #[test]
    fn record_updates_position_and_revision() {
        let mut p = progress();
        p.record(300.0, 1000.0, None, None, OffsetDateTime::UNIX_EPOCH)
            .unwrap();
        assert_eq!(p.position_secs, 300.0);
        assert_eq!(p.revision, 1);
        assert!(p.is_in_progress());
        assert!((p.ratio() - 0.3).abs() < 1e-9);
    }

    #[test]
    fn auto_marks_watched_past_threshold() {
        let mut p = progress();
        p.record(950.0, 1000.0, None, None, OffsetDateTime::UNIX_EPOCH)
            .unwrap();
        assert!(p.watched);
        assert!(!p.is_in_progress());
    }

    #[test]
    fn explicit_flag_overrides_auto() {
        let mut p = progress();
        p.record(950.0, 1000.0, Some(false), None, OffsetDateTime::UNIX_EPOCH)
            .unwrap();
        assert!(!p.watched);
        p.record(10.0, 1000.0, Some(true), None, OffsetDateTime::UNIX_EPOCH)
            .unwrap();
        assert!(p.watched);
    }

    #[test]
    fn rejects_invalid_values() {
        let mut p = progress();
        assert!(p
            .record(-1.0, 100.0, None, None, OffsetDateTime::UNIX_EPOCH)
            .is_err());
        assert!(p
            .record(f64::NAN, 100.0, None, None, OffsetDateTime::UNIX_EPOCH)
            .is_err());
        assert!(p
            .record(500.0, 100.0, None, None, OffsetDateTime::UNIX_EPOCH)
            .is_err());
    }

    #[test]
    fn unknown_duration_has_zero_ratio() {
        let mut p = progress();
        p.record(120.0, 0.0, None, None, OffsetDateTime::UNIX_EPOCH)
            .unwrap();
        assert_eq!(p.ratio(), 0.0);
        assert!(p.is_in_progress());
    }
}
