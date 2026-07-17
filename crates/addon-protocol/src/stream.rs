use crate::subtitle::Subtitle;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// HTTP headers a client should apply when fetching a proxied stream.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProxyHeaders {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request: Option<BTreeMap<String, String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response: Option<BTreeMap<String, String>>,
}

/// Behavior hints controlling how a stream is played.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamBehaviorHints {
    /// True when the URL cannot be played directly in a browser (non-HTTPS or
    /// non-MP4); such streams require a local streaming server/proxy.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub not_web_ready: Option<bool>,
    /// Streams sharing a `bingeGroup` are auto-selected for binge watching.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub binge_group: Option<String>,
    /// ISO 3166-1 alpha-3 (lowercase) country codes the stream is limited to.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub country_whitelist: Vec<String>,
    /// Headers to apply to the request; requires `not_web_ready = true`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proxy_headers: Option<ProxyHeaders>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub video_size: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filename: Option<String>,
}

/// A playable source for an item, as returned by a `stream` resource.
///
/// Exactly one delivery field is normally set: `url` (direct/HLS/DASH),
/// `info_hash` (+`file_idx`) for BitTorrent, `yt_id` for YouTube, or
/// `external_url` to open elsewhere.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Stream {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub yt_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub info_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_idx: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub external_url: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub sources: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub subtitles: Vec<Subtitle>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub behavior_hints: Option<StreamBehaviorHints>,
}

/// The delivery mechanism a [`Stream`] uses.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamKind {
    /// A direct HTTP(S) URL (may be progressive, HLS or DASH).
    Url,
    /// A YouTube video id.
    YouTube,
    /// A BitTorrent info hash.
    Torrent,
    /// An external URL to be opened outside the player.
    External,
    /// No recognizable delivery field.
    Unknown,
}

impl Stream {
    /// Classifies the stream's delivery mechanism.
    pub fn kind(&self) -> StreamKind {
        if self.url.is_some() {
            StreamKind::Url
        } else if self.info_hash.is_some() {
            StreamKind::Torrent
        } else if self.yt_id.is_some() {
            StreamKind::YouTube
        } else if self.external_url.is_some() {
            StreamKind::External
        } else {
            StreamKind::Unknown
        }
    }

    /// True when the client must run a local proxy to apply request headers.
    pub fn requires_proxy(&self) -> bool {
        self.behavior_hints
            .as_ref()
            .and_then(|h| h.proxy_headers.as_ref())
            .is_some()
    }

    /// True when the stream is playable directly in a browser: an HTTPS URL not
    /// flagged `not_web_ready`.
    pub fn is_web_ready(&self) -> bool {
        let Some(url) = self.url.as_deref() else {
            return false;
        };
        if !url.starts_with("https://") {
            return false;
        }
        let not_web_ready = self
            .behavior_hints
            .as_ref()
            .and_then(|h| h.not_web_ready)
            .unwrap_or(false);
        !not_web_ready
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_direct_url_stream() {
        let s: Stream = serde_json::from_str(r#"{"url":"https://x/v.mp4"}"#).unwrap();
        assert_eq!(s.kind(), StreamKind::Url);
        assert!(s.is_web_ready());
    }

    #[test]
    fn classifies_torrent_stream() {
        let s: Stream = serde_json::from_str(r#"{"infoHash":"abc","fileIdx":0}"#).unwrap();
        assert_eq!(s.kind(), StreamKind::Torrent);
        assert!(!s.is_web_ready());
    }

    #[test]
    fn parses_proxy_headers_and_behavior_hints() {
        let raw = r#"{"url":"https://x/v.m3u8","behaviorHints":{
            "notWebReady":true,
            "proxyHeaders":{"request":{"Referer":"https://x/"}}
        }}"#;
        let s: Stream = serde_json::from_str(raw).unwrap();
        assert!(s.requires_proxy());
        assert!(!s.is_web_ready());
        let hints = s.behavior_hints.unwrap();
        assert_eq!(
            hints.proxy_headers.unwrap().request.unwrap()["Referer"],
            "https://x/"
        );
    }

    #[test]
    fn http_url_is_not_web_ready() {
        let s: Stream = serde_json::from_str(r#"{"url":"http://x/v.mp4"}"#).unwrap();
        assert!(!s.is_web_ready());
    }

    #[test]
    fn unknown_when_no_delivery_field() {
        let s: Stream = serde_json::from_str(r#"{"name":"x"}"#).unwrap();
        assert_eq!(s.kind(), StreamKind::Unknown);
    }
}
