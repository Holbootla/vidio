//! Stremio-compatible add-on protocol types and request/response handling.
//!
//! This crate models the [Stremio add-on protocol](https://stremio.github.io/stremio-addon-sdk/protocol.html):
//! manifests, the `catalog`/`meta`/`stream`/`subtitles` resources, request URL
//! construction and capability-based routing. It performs no I/O.

#![forbid(unsafe_code)]

pub mod error;
pub mod manifest;
pub mod meta;
pub mod request;
pub mod response;
pub mod stream;
pub mod subtitle;

pub use error::{ProtocolError, ProtocolResult};
pub use manifest::{
    CatalogDefinition, CatalogExtra, Manifest, ManifestBehaviorHints, ResolvedResource, Resource,
};
pub use meta::{Meta, MetaPreview, Video};
pub use request::ResourceRequest;
pub use response::{CatalogResponse, MetaResponse, StreamsResponse, SubtitlesResponse};
pub use stream::{ProxyHeaders, Stream, StreamBehaviorHints, StreamKind};
pub use subtitle::Subtitle;

/// Canonical resource names defined by the protocol.
pub mod resource_names {
    pub const CATALOG: &str = "catalog";
    pub const META: &str = "meta";
    pub const STREAM: &str = "stream";
    pub const SUBTITLES: &str = "subtitles";
    pub const ADDON_CATALOG: &str = "addon_catalog";
}
