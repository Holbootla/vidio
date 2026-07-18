use crate::error::{DomainError, DomainResult};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// A content type as used by the Stremio add-on protocol.
///
/// The standard set is enumerated for ergonomics; unknown types round-trip
/// through [`MediaType::Other`] so future add-on types are not lost.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(from = "String", into = "String")]
pub enum MediaType {
    Movie,
    Series,
    Channel,
    Tv,
    Music,
    Radio,
    Podcast,
    Other(String),
}

impl MediaType {
    pub fn as_str(&self) -> &str {
        match self {
            MediaType::Movie => "movie",
            MediaType::Series => "series",
            MediaType::Channel => "channel",
            MediaType::Tv => "tv",
            MediaType::Music => "music",
            MediaType::Radio => "radio",
            MediaType::Podcast => "podcast",
            MediaType::Other(other) => other,
        }
    }
}

impl From<String> for MediaType {
    fn from(value: String) -> Self {
        match value.as_str() {
            "movie" => MediaType::Movie,
            "series" => MediaType::Series,
            "channel" => MediaType::Channel,
            "tv" => MediaType::Tv,
            "music" => MediaType::Music,
            "radio" => MediaType::Radio,
            "podcast" => MediaType::Podcast,
            _ => MediaType::Other(value),
        }
    }
}

impl From<&str> for MediaType {
    fn from(value: &str) -> Self {
        MediaType::from(value.to_string())
    }
}

impl From<MediaType> for String {
    fn from(value: MediaType) -> Self {
        value.as_str().to_string()
    }
}

impl fmt::Display for MediaType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// The namespace a content id lives in, used to deduplicate across add-ons.
///
/// IMDb ids (prefixed `tt`) and Kitsu ids are shared identifier spaces, so two
/// add-ons returning the same IMDb id refer to the same title. Any other id is
/// scoped to the add-on that produced it to avoid false merges.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum IdNamespace {
    Imdb,
    Kitsu,
    Addon,
}

fn classify(content_id: &str) -> IdNamespace {
    if content_id.starts_with("tt") {
        IdNamespace::Imdb
    } else if content_id.starts_with("kitsu:") {
        IdNamespace::Kitsu
    } else {
        IdNamespace::Addon
    }
}

/// A canonical, stable key identifying a piece of media across add-ons.
///
/// Canonical forms:
/// - IMDb: `movie:imdb:tt1254207`
/// - Kitsu: `series:kitsu:anime:1`
/// - Add-on scoped: `series:addon:{manifest_id}:{media_id}`
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct MediaKey(String);

impl MediaKey {
    /// Builds a canonical media key from an add-on result.
    ///
    /// Shared identifier namespaces (IMDb, Kitsu) ignore the `manifest_id` so
    /// identical content from different add-ons collapses to one key.
    pub fn from_content(
        media_type: &MediaType,
        manifest_id: &str,
        content_id: &str,
    ) -> DomainResult<Self> {
        let content_id = content_id.trim();
        if content_id.is_empty() {
            return Err(DomainError::validation("content id must not be empty"));
        }
        let key = match classify(content_id) {
            IdNamespace::Imdb => format!("{}:imdb:{}", media_type.as_str(), content_id),
            IdNamespace::Kitsu => {
                let rest = content_id.trim_start_matches("kitsu:");
                format!("{}:kitsu:{}", media_type.as_str(), rest)
            }
            IdNamespace::Addon => {
                let manifest_id = manifest_id.trim();
                if manifest_id.is_empty() {
                    return Err(DomainError::validation(
                        "manifest id is required for add-on scoped media",
                    ));
                }
                format!(
                    "{}:addon:{}:{}",
                    media_type.as_str(),
                    manifest_id,
                    content_id
                )
            }
        };
        Ok(Self(key))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn into_string(self) -> String {
        self.0
    }
}

impl fmt::Display for MediaKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl FromStr for MediaKey {
    type Err = DomainError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s.split(':').count() < 3 {
            return Err(DomainError::validation("malformed media key"));
        }
        Ok(Self(s.to_string()))
    }
}

/// A canonical key identifying a single playable video (movie or episode).
///
/// For single-video items the video key mirrors the media key. For episodes the
/// add-on video id (e.g. `tt0944947:1:1`) is used to remain stable per episode.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct VideoKey(String);

impl VideoKey {
    pub fn from_content(
        media_type: &MediaType,
        manifest_id: &str,
        video_id: &str,
    ) -> DomainResult<Self> {
        let video_id = video_id.trim();
        if video_id.is_empty() {
            return Err(DomainError::validation("video id must not be empty"));
        }
        let key = match classify(video_id) {
            IdNamespace::Imdb => format!("{}:imdb:{}", media_type.as_str(), video_id),
            IdNamespace::Kitsu => {
                let rest = video_id.trim_start_matches("kitsu:");
                format!("{}:kitsu:{}", media_type.as_str(), rest)
            }
            IdNamespace::Addon => {
                let manifest_id = manifest_id.trim();
                if manifest_id.is_empty() {
                    return Err(DomainError::validation(
                        "manifest id is required for add-on scoped video",
                    ));
                }
                format!("{}:addon:{}:{}", media_type.as_str(), manifest_id, video_id)
            }
        };
        Ok(Self(key))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn into_string(self) -> String {
        self.0
    }
}

impl fmt::Display for VideoKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl FromStr for VideoKey {
    type Err = DomainError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s.split(':').count() < 3 {
            return Err(DomainError::validation("malformed video key"));
        }
        Ok(Self(s.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imdb_ids_collapse_across_addons() {
        let a = MediaKey::from_content(&MediaType::Movie, "addon.one", "tt1254207").unwrap();
        let b = MediaKey::from_content(&MediaType::Movie, "addon.two", "tt1254207").unwrap();
        assert_eq!(a, b);
        assert_eq!(a.as_str(), "movie:imdb:tt1254207");
    }

    #[test]
    fn addon_ids_are_scoped_per_addon() {
        let a = MediaKey::from_content(&MediaType::Series, "addon.one", "custom1").unwrap();
        let b = MediaKey::from_content(&MediaType::Series, "addon.two", "custom1").unwrap();
        assert_ne!(a, b);
        assert_eq!(a.as_str(), "series:addon:addon.one:custom1");
    }

    #[test]
    fn kitsu_ids_collapse_across_addons() {
        let a = MediaKey::from_content(&MediaType::Series, "addon.one", "kitsu:anime:1").unwrap();
        let b = MediaKey::from_content(&MediaType::Series, "addon.two", "kitsu:anime:1").unwrap();
        assert_eq!(a, b);
        assert_eq!(a.as_str(), "series:kitsu:anime:1");
    }

    #[test]
    fn addon_scoped_requires_manifest_id() {
        assert!(MediaKey::from_content(&MediaType::Movie, "  ", "custom1").is_err());
        assert!(MediaKey::from_content(&MediaType::Movie, "", "").is_err());
    }

    #[test]
    fn video_key_for_episode_is_stable() {
        let key = VideoKey::from_content(&MediaType::Series, "addon.one", "tt0944947:1:1").unwrap();
        assert_eq!(key.as_str(), "series:imdb:tt0944947:1:1");
    }

    #[test]
    fn media_key_round_trips_and_rejects_malformed() {
        let key = MediaKey::from_content(&MediaType::Movie, "a", "tt1").unwrap();
        assert_eq!(MediaKey::from_str(key.as_str()).unwrap(), key);
        assert!(MediaKey::from_str("nope").is_err());
    }

    #[test]
    fn media_type_round_trips_unknown_values() {
        let custom: MediaType = "book".into();
        assert_eq!(custom, MediaType::Other("book".to_string()));
        assert_eq!(custom.as_str(), "book");
        let json = serde_json::to_string(&custom).unwrap();
        assert_eq!(json, "\"book\"");
    }
}
