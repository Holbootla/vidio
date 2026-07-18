use serde::{Deserialize, Serialize};

/// A summarized catalog item (a card on the Board/Discover/Search grids).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaPreview {
    pub id: String,
    #[serde(rename = "type")]
    pub content_type: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub poster: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub poster_shape: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_info: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imdb_rating: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub genres: Vec<String>,
}

/// A single playable video belonging to a meta item (e.g. a series episode).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Video {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub released: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub season: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub episode: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub overview: Option<String>,
}

/// Detailed metadata for an item, used to render its Details page.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    pub id: String,
    #[serde(rename = "type")]
    pub content_type: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub poster: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_info: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub imdb_rating: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub genres: Vec<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub videos: Vec<Video>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn meta_preview_parses_minimal() {
        let raw = r#"{"id":"tt1254207","type":"movie","name":"Big Buck Bunny",
            "poster":"https://example/p.jpg"}"#;
        let preview: MetaPreview = serde_json::from_str(raw).unwrap();
        assert_eq!(preview.id, "tt1254207");
        assert_eq!(preview.content_type, "movie");
        assert!(preview.genres.is_empty());
    }

    #[test]
    fn meta_parses_series_with_videos() {
        let raw = r#"{"id":"tt0944947","type":"series","name":"GoT","videos":[
            {"id":"tt0944947:1:1","title":"Winter Is Coming","season":1,"episode":1}
        ]}"#;
        let meta: Meta = serde_json::from_str(raw).unwrap();
        assert_eq!(meta.videos.len(), 1);
        assert_eq!(meta.videos[0].season, Some(1));
    }
}
