use crate::error::{ProtocolError, ProtocolResult};
use serde::{Deserialize, Serialize};

/// A resource entry in a manifest, either a bare name or an object with
/// per-resource `types`/`idPrefixes` overrides.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Resource {
    Short(String),
    Full(FullResource),
}

/// The object form of a [`Resource`] with optional overrides.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullResource {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub types: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id_prefixes: Option<Vec<String>>,
}

impl Resource {
    pub fn name(&self) -> &str {
        match self {
            Resource::Short(name) => name,
            Resource::Full(full) => &full.name,
        }
    }
}

/// A single extra property a catalog supports (e.g. `search`, `skip`, `genre`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogExtra {
    pub name: String,
    #[serde(default)]
    pub is_required: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options_limit: Option<u32>,
}

/// A catalog offered by an add-on, shown on the Board/Discover/Search.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CatalogDefinition {
    #[serde(rename = "type")]
    pub content_type: String,
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub extra: Vec<CatalogExtra>,
}

impl CatalogDefinition {
    /// True if the catalog declares support for the named extra property.
    pub fn supports_extra(&self, name: &str) -> bool {
        self.extra.iter().any(|e| e.name == name)
    }

    /// True if every required extra is satisfied by the provided keys.
    pub fn required_extras_satisfied<'a, I>(&self, provided: I) -> bool
    where
        I: IntoIterator<Item = &'a str>,
    {
        let provided: Vec<&str> = provided.into_iter().collect();
        self.extra
            .iter()
            .filter(|e| e.is_required)
            .all(|e| provided.contains(&e.name.as_str()))
    }
}

/// Optional behavior hints declared at the manifest level.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestBehaviorHints {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub adult: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub p2p: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub configurable: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub configuration_required: Option<bool>,
}

/// A parsed Stremio-compatible add-on manifest.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub id: String,
    pub version: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub resources: Vec<Resource>,
    #[serde(default)]
    pub types: Vec<String>,
    #[serde(default)]
    pub catalogs: Vec<CatalogDefinition>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id_prefixes: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub background: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logo: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub contact_email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub behavior_hints: Option<ManifestBehaviorHints>,
}

/// The effective routing constraints for one resource, after merging manifest
/// defaults with any per-resource overrides.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedResource {
    pub name: String,
    pub types: Vec<String>,
    pub id_prefixes: Vec<String>,
}

impl Manifest {
    /// Parses a manifest from raw JSON, validating required invariants.
    pub fn parse(raw: &str) -> ProtocolResult<Self> {
        let manifest: Manifest = serde_json::from_str(raw)?;
        manifest.validate()?;
        Ok(manifest)
    }

    /// Validates structural invariants required by the protocol.
    pub fn validate(&self) -> ProtocolResult<()> {
        if self.id.trim().is_empty() {
            return Err(ProtocolError::InvalidManifest(
                "manifest id is required".into(),
            ));
        }
        if self.name.trim().is_empty() {
            return Err(ProtocolError::InvalidManifest(
                "manifest name is required".into(),
            ));
        }
        if self.version.trim().is_empty() {
            return Err(ProtocolError::InvalidManifest(
                "manifest version is required".into(),
            ));
        }
        if self.resources.is_empty() {
            return Err(ProtocolError::InvalidManifest(
                "manifest must declare at least one resource".into(),
            ));
        }
        Ok(())
    }

    /// Distinct resource names served by this add-on.
    pub fn resource_names(&self) -> Vec<String> {
        let mut names: Vec<String> = self
            .resources
            .iter()
            .map(|r| r.name().to_string())
            .collect();
        names.sort();
        names.dedup();
        names
    }

    /// Resolves the effective constraints for a named resource, if served.
    pub fn resolve_resource(&self, name: &str) -> Option<ResolvedResource> {
        let entry = self.resources.iter().find(|r| r.name() == name)?;
        let (types, id_prefixes) = match entry {
            Resource::Short(_) => (
                self.types.clone(),
                self.id_prefixes.clone().unwrap_or_default(),
            ),
            Resource::Full(full) => (
                full.types.clone().unwrap_or_else(|| self.types.clone()),
                full.id_prefixes
                    .clone()
                    .or_else(|| self.id_prefixes.clone())
                    .unwrap_or_default(),
            ),
        };
        Some(ResolvedResource {
            name: name.to_string(),
            types,
            id_prefixes,
        })
    }

    /// Returns true if this add-on can serve the given resource request.
    ///
    /// Implements the protocol filtering rule: the resource must be declared,
    /// its type must match, and any declared id prefixes must match the id.
    pub fn handles(&self, resource: &str, content_type: &str, content_id: Option<&str>) -> bool {
        let Some(resolved) = self.resolve_resource(resource) else {
            return false;
        };
        if !resolved.types.is_empty() && !resolved.types.iter().any(|t| t == content_type) {
            return false;
        }
        match content_id {
            Some(id) if !resolved.id_prefixes.is_empty() => {
                resolved.id_prefixes.iter().any(|p| id.starts_with(p))
            }
            _ => true,
        }
    }

    /// Whether the add-on requires configuration before it can be installed.
    pub fn requires_configuration(&self) -> bool {
        self.behavior_hints
            .as_ref()
            .and_then(|h| h.configuration_required)
            .unwrap_or(false)
    }

    /// Whether the add-on may serve P2P (e.g. BitTorrent) content.
    pub fn is_p2p(&self) -> bool {
        self.behavior_hints
            .as_ref()
            .and_then(|h| h.p2p)
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MINIMAL: &str = r#"{
        "id": "org.myexampleaddon",
        "version": "1.0.0",
        "name": "simple Big Buck Bunny example",
        "types": ["movie"],
        "catalogs": [{"type": "movie", "id": "bbbcatalog"}],
        "resources": [
            "catalog",
            {"name": "stream", "types": ["movie"], "idPrefixes": ["tt"]}
        ]
    }"#;

    #[test]
    fn parses_official_minimal_example() {
        let m = Manifest::parse(MINIMAL).unwrap();
        assert_eq!(m.id, "org.myexampleaddon");
        assert_eq!(m.resource_names(), vec!["catalog", "stream"]);
        assert_eq!(m.catalogs.len(), 1);
    }

    #[test]
    fn short_resource_inherits_manifest_defaults() {
        let m = Manifest::parse(MINIMAL).unwrap();
        let catalog = m.resolve_resource("catalog").unwrap();
        assert_eq!(catalog.types, vec!["movie"]);
    }

    #[test]
    fn full_resource_overrides_apply() {
        let m = Manifest::parse(MINIMAL).unwrap();
        let stream = m.resolve_resource("stream").unwrap();
        assert_eq!(stream.id_prefixes, vec!["tt"]);
    }

    #[test]
    fn handles_filters_by_type_and_prefix() {
        let m = Manifest::parse(MINIMAL).unwrap();
        assert!(m.handles("stream", "movie", Some("tt1254207")));
        assert!(!m.handles("stream", "series", Some("tt1254207")));
        assert!(!m.handles("stream", "movie", Some("custom1")));
        assert!(!m.handles("meta", "movie", Some("tt1254207")));
    }

    #[test]
    fn validation_rejects_missing_fields() {
        assert!(
            Manifest::parse(r#"{"id":"","version":"1","name":"n","resources":["catalog"]}"#)
                .is_err()
        );
        assert!(Manifest::parse(r#"{"id":"x","version":"1","name":"n","resources":[]}"#).is_err());
    }

    #[test]
    fn catalog_extra_requirements() {
        let raw = r#"{
            "id":"x","version":"1","name":"n","types":["movie"],
            "resources":["catalog"],
            "catalogs":[{"type":"movie","id":"top","name":"Top","extra":[
                {"name":"search","isRequired":true},{"name":"skip","isRequired":false}
            ]}]
        }"#;
        let m = Manifest::parse(raw).unwrap();
        let catalog = &m.catalogs[0];
        assert!(catalog.supports_extra("search"));
        assert!(catalog.required_extras_satisfied(["search"]));
        assert!(!catalog.required_extras_satisfied(["skip"]));
    }

    #[test]
    fn behavior_hints_parse() {
        let raw = r#"{
            "id":"x","version":"1","name":"n","resources":["stream"],
            "behaviorHints":{"p2p":true,"configurationRequired":true}
        }"#;
        let m = Manifest::parse(raw).unwrap();
        assert!(m.is_p2p());
        assert!(m.requires_configuration());
    }

    #[test]
    fn round_trips_through_json() {
        let m = Manifest::parse(MINIMAL).unwrap();
        let json = serde_json::to_string(&m).unwrap();
        let reparsed = Manifest::parse(&json).unwrap();
        assert_eq!(m, reparsed);
    }
}
