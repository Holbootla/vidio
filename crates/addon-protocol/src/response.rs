use crate::meta::{Meta, MetaPreview};
use crate::stream::Stream;
use crate::subtitle::Subtitle;
use serde::{Deserialize, Serialize};

/// Response body for a `catalog` request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CatalogResponse {
    #[serde(default)]
    pub metas: Vec<MetaPreview>,
}

/// Response body for a `meta` request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MetaResponse {
    pub meta: Meta,
}

/// Response body for a `stream` request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StreamsResponse {
    #[serde(default)]
    pub streams: Vec<Stream>,
}

/// Response body for a `subtitles` request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SubtitlesResponse {
    #[serde(default)]
    pub subtitles: Vec<Subtitle>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_response_parses() {
        let raw = r#"{"metas":[{"id":"tt1","type":"movie","name":"A"}]}"#;
        let r: CatalogResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(r.metas.len(), 1);
    }

    #[test]
    fn streams_response_defaults_to_empty() {
        let r: StreamsResponse = serde_json::from_str("{}").unwrap();
        assert!(r.streams.is_empty());
    }

    #[test]
    fn subtitles_response_parses() {
        let raw = r#"{"subtitles":[{"id":"1","url":"https://x/s.srt","lang":"en"}]}"#;
        let r: SubtitlesResponse = serde_json::from_str(raw).unwrap();
        assert_eq!(r.subtitles.len(), 1);
    }
}
