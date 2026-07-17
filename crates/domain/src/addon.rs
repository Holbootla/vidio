use crate::ids::{InstallationId, ProfileId};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

/// A summary of an add-on's declared capabilities, derived from its manifest.
///
/// This is a denormalized, protocol-agnostic view used for fast request
/// routing without re-parsing the full manifest on every request.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct AddonCapabilities {
    /// Resource names the add-on serves, e.g. `catalog`, `meta`, `stream`.
    pub resources: Vec<String>,
    /// Content types the add-on serves, e.g. `movie`, `series`.
    pub types: Vec<String>,
    /// Id prefixes the add-on handles, e.g. `tt`. Empty means "any".
    pub id_prefixes: Vec<String>,
}

impl AddonCapabilities {
    pub fn supports_resource(&self, resource: &str) -> bool {
        self.resources.iter().any(|r| r == resource)
    }

    pub fn supports_type(&self, media_type: &str) -> bool {
        self.types.iter().any(|t| t == media_type)
    }

    /// Returns true if the add-on may handle the given content id. When no id
    /// prefixes are declared the add-on is considered to accept any id.
    pub fn matches_id_prefix(&self, content_id: &str) -> bool {
        self.id_prefixes.is_empty() || self.id_prefixes.iter().any(|p| content_id.starts_with(p))
    }

    /// Returns true when the add-on can serve `resource` for `media_type`/`content_id`.
    pub fn can_serve(&self, resource: &str, media_type: &str, content_id: Option<&str>) -> bool {
        if !self.supports_resource(resource) || !self.supports_type(media_type) {
            return false;
        }
        match content_id {
            Some(id) => self.matches_id_prefix(id),
            None => true,
        }
    }
}

/// An add-on installed for a specific profile.
///
/// `transport_url` is the fully-configured `manifest.json` URL and may embed
/// user secrets; persistence adapters encrypt it at rest and it must never be
/// logged. `manifest_snapshot` holds the raw manifest JSON captured at install
/// or last refresh.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AddonInstallation {
    pub id: InstallationId,
    pub profile_id: ProfileId,
    pub manifest_id: String,
    pub transport_url: String,
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub enabled: bool,
    /// Sort order; lower values are queried first.
    pub priority: i32,
    pub capabilities: AddonCapabilities,
    pub manifest_snapshot: String,
    pub installed_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

impl AddonInstallation {
    pub fn set_enabled(&mut self, enabled: bool, now: OffsetDateTime) {
        self.enabled = enabled;
        self.updated_at = now;
    }

    pub fn set_priority(&mut self, priority: i32, now: OffsetDateTime) {
        self.priority = priority;
        self.updated_at = now;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn caps() -> AddonCapabilities {
        AddonCapabilities {
            resources: vec!["catalog".into(), "stream".into()],
            types: vec!["movie".into()],
            id_prefixes: vec!["tt".into()],
        }
    }

    #[test]
    fn can_serve_respects_resource_type_and_prefix() {
        let c = caps();
        assert!(c.can_serve("stream", "movie", Some("tt1254207")));
        assert!(!c.can_serve("meta", "movie", Some("tt1254207")));
        assert!(!c.can_serve("stream", "series", Some("tt1254207")));
        assert!(!c.can_serve("stream", "movie", Some("custom1")));
    }

    #[test]
    fn empty_prefixes_match_any_id() {
        let mut c = caps();
        c.id_prefixes.clear();
        assert!(c.can_serve("stream", "movie", Some("anything")));
    }

    #[test]
    fn catalog_requests_without_id_are_allowed() {
        assert!(caps().can_serve("catalog", "movie", None));
    }
}
