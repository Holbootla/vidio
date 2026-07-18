use crate::error::{ProtocolError, ProtocolResult};
use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS, NON_ALPHANUMERIC};
use url::{Position, Url};

/// Characters encoded within a path segment (id). Sub-delimiters such as `:`
/// are intentionally preserved because add-on ids like `tt0944947:1:1` rely on
/// literal colons.
const PATH_SEGMENT: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'?')
    .add(b'/')
    .add(b'<')
    .add(b'>')
    .add(b'`')
    .add(b'{')
    .add(b'}')
    .add(b'\\')
    .add(b'^')
    .add(b'|');

/// A request for a resource from an add-on, per the Stremio protocol path
/// scheme `/{resource}/{type}/{id}(/{extraArgs}).json`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResourceRequest {
    pub resource: String,
    pub content_type: String,
    pub id: String,
    /// Ordered extra arguments (e.g. `search`, `skip`, `genre`).
    pub extra: Vec<(String, String)>,
}

impl ResourceRequest {
    pub fn new(
        resource: impl Into<String>,
        content_type: impl Into<String>,
        id: impl Into<String>,
    ) -> Self {
        Self {
            resource: resource.into(),
            content_type: content_type.into(),
            id: id.into(),
            extra: Vec::new(),
        }
    }

    /// Adds an extra argument, returning `self` for chaining.
    pub fn with_extra(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.extra.push((key.into(), value.into()));
        self
    }

    /// Builds the relative resource path (already percent-encoded).
    pub fn to_path(&self) -> ProtocolResult<String> {
        if self.resource.is_empty() || self.content_type.is_empty() || self.id.is_empty() {
            return Err(ProtocolError::InvalidRequest(
                "resource, type and id are required".into(),
            ));
        }
        let resource = encode_segment(&self.resource);
        let content_type = encode_segment(&self.content_type);
        let id = encode_segment(&self.id);

        if self.extra.is_empty() {
            return Ok(format!("{resource}/{content_type}/{id}.json"));
        }

        let extra = self
            .extra
            .iter()
            .map(|(k, v)| format!("{}={}", encode_component(k), encode_component(v)))
            .collect::<Vec<_>>()
            .join("&");
        Ok(format!("{resource}/{content_type}/{id}/{extra}.json"))
    }

    /// Builds the absolute request URL against an add-on transport URL.
    ///
    /// The transport URL's trailing `manifest.json` (or last path segment) is
    /// treated as the base directory, matching the protocol's relative layout.
    pub fn to_url(&self, transport_url: &Url) -> ProtocolResult<Url> {
        if transport_url.cannot_be_a_base() {
            return Err(ProtocolError::InvalidTransportUrl(
                "transport url cannot be a base".into(),
            ));
        }
        let origin = &transport_url[..Position::BeforePath];
        let base_dir = base_directory(transport_url.path());
        let relative = self.to_path()?;
        let full = format!("{origin}{base_dir}{relative}");
        Url::parse(&full).map_err(|e| ProtocolError::InvalidTransportUrl(e.to_string()))
    }
}

/// Returns the directory portion of a path (up to and including the final `/`).
fn base_directory(path: &str) -> &str {
    match path.rfind('/') {
        Some(idx) => &path[..=idx],
        None => "/",
    }
}

fn encode_segment(value: &str) -> String {
    utf8_percent_encode(value, PATH_SEGMENT).to_string()
}

fn encode_component(value: &str) -> String {
    utf8_percent_encode(value, NON_ALPHANUMERIC).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn transport() -> Url {
        Url::parse("https://addon.example.com/manifest.json").unwrap()
    }

    #[test]
    fn builds_simple_stream_url() {
        let req = ResourceRequest::new("stream", "movie", "tt1254207");
        let url = req.to_url(&transport()).unwrap();
        assert_eq!(
            url.as_str(),
            "https://addon.example.com/stream/movie/tt1254207.json"
        );
    }

    #[test]
    fn preserves_colons_in_episode_ids() {
        let req = ResourceRequest::new("stream", "series", "tt0944947:1:1");
        let url = req.to_url(&transport()).unwrap();
        assert_eq!(
            url.as_str(),
            "https://addon.example.com/stream/series/tt0944947:1:1.json"
        );
    }

    #[test]
    fn encodes_extra_arguments() {
        let req = ResourceRequest::new("catalog", "movie", "top")
            .with_extra("search", "game of thrones")
            .with_extra("skip", "100");
        let path = req.to_path().unwrap();
        assert_eq!(
            path,
            "catalog/movie/top/search=game%20of%20thrones&skip=100.json"
        );
    }

    #[test]
    fn respects_nested_base_directory() {
        let transport = Url::parse("https://host.example/sub/dir/manifest.json").unwrap();
        let req = ResourceRequest::new("meta", "movie", "tt1");
        let url = req.to_url(&transport).unwrap();
        assert_eq!(
            url.as_str(),
            "https://host.example/sub/dir/meta/movie/tt1.json"
        );
    }

    #[test]
    fn handles_root_transport_path() {
        let transport = Url::parse("https://host.example/manifest.json").unwrap();
        let req = ResourceRequest::new("catalog", "movie", "top");
        let url = req.to_url(&transport).unwrap();
        assert_eq!(url.as_str(), "https://host.example/catalog/movie/top.json");
    }

    #[test]
    fn rejects_empty_fields() {
        let req = ResourceRequest::new("", "movie", "id");
        assert!(req.to_path().is_err());
    }

    #[test]
    fn encodes_slash_in_id_within_single_segment() {
        let req = ResourceRequest::new("meta", "movie", "a/b");
        let path = req.to_path().unwrap();
        assert_eq!(path, "meta/movie/a%2Fb.json");
    }
}
