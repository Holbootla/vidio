use serde::{Deserialize, Serialize};

/// A subtitle track for an item or stream.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Subtitle {
    pub id: String,
    pub url: String,
    /// Language code (ISO 639-1/2/3 as provided by the add-on).
    pub lang: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_subtitle() {
        let raw = r#"{"id":"1","url":"https://x/s.srt","lang":"eng"}"#;
        let s: Subtitle = serde_json::from_str(raw).unwrap();
        assert_eq!(s.lang, "eng");
    }
}
