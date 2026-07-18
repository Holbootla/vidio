//! Add-on runtime: SSRF-safe URL validation and the add-on HTTP client.
//!
//! The runtime is the only place the backend talks to third-party add-ons. It
//! enforces strict destination policies (HTTPS only, no embedded credentials,
//! no private/loopback/metadata targets, DNS-rebinding protection), applies
//! timeouts and response-size limits, and validates each redirect hop.

#![forbid(unsafe_code)]

pub mod client;
pub mod error;
pub mod security;

pub use client::{AddonClient, AddonClientConfig, HttpAddonClient};
pub use error::{RuntimeError, RuntimeResult};
pub use security::{
    guard_url, ipv4_disallowed, ipv6_disallowed, resolve_allowed_addrs, validate_transport_url,
    UrlPolicy,
};

#[cfg(feature = "mock")]
pub use client::MockAddonClient;
