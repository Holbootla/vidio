use crate::error::{RuntimeError, RuntimeResult};
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
use url::{Host, Url};

/// Policy governing which add-on destinations are permitted.
#[derive(Debug, Clone)]
pub struct UrlPolicy {
    /// When true, private/loopback destinations and plain HTTP are allowed.
    /// Intended only for local development and tests — never in production.
    pub allow_private_networks: bool,
}

impl Default for UrlPolicy {
    fn default() -> Self {
        Self {
            allow_private_networks: false,
        }
    }
}

impl UrlPolicy {
    pub fn secure() -> Self {
        Self {
            allow_private_networks: false,
        }
    }

    pub fn permissive() -> Self {
        Self {
            allow_private_networks: true,
        }
    }
}

/// Hostnames that must never be contacted (metadata/service endpoints).
const BLOCKED_HOST_SUFFIXES: [&str; 4] = [".localhost", ".local", ".internal", ".lan"];
const BLOCKED_HOSTNAMES: [&str; 2] = ["localhost", "metadata.google.internal"];

/// Parses and statically validates an add-on transport URL.
///
/// Static validation covers scheme, embedded credentials, and IP-literal
/// destinations. Domain names are resolved and re-checked at fetch time (see
/// [`resolve_allowed_addrs`]) to also defend against DNS-based SSRF.
pub fn validate_transport_url(raw: &str, policy: &UrlPolicy) -> RuntimeResult<Url> {
    let url = Url::parse(raw.trim()).map_err(|e| RuntimeError::InvalidUrl(e.to_string()))?;
    guard_url(&url, policy)?;
    Ok(url)
}

/// Applies static SSRF guards to a URL (also used per redirect hop).
pub fn guard_url(url: &Url, policy: &UrlPolicy) -> RuntimeResult<()> {
    let scheme = url.scheme();
    let https = scheme == "https";
    let http = scheme == "http";
    if !(https || (http && policy.allow_private_networks)) {
        return Err(RuntimeError::Blocked(
            "only https transport is allowed".into(),
        ));
    }

    if !url.username().is_empty() || url.password().is_some() {
        return Err(RuntimeError::Blocked(
            "credentials in url are not allowed".into(),
        ));
    }

    let host = url
        .host()
        .ok_or_else(|| RuntimeError::InvalidUrl("url is missing a host".into()))?;

    match host {
        Host::Ipv4(ip) => {
            if !policy.allow_private_networks && ipv4_disallowed(&ip) {
                return Err(RuntimeError::Blocked(format!(
                    "disallowed ipv4 address: {ip}"
                )));
            }
        }
        Host::Ipv6(ip) => {
            if !policy.allow_private_networks && ipv6_disallowed(&ip) {
                return Err(RuntimeError::Blocked(format!(
                    "disallowed ipv6 address: {ip}"
                )));
            }
        }
        Host::Domain(domain) => {
            if !policy.allow_private_networks && is_blocked_hostname(domain) {
                return Err(RuntimeError::Blocked(format!(
                    "disallowed hostname: {domain}"
                )));
            }
        }
    }
    Ok(())
}

fn is_blocked_hostname(domain: &str) -> bool {
    let host = domain.trim_end_matches('.').to_ascii_lowercase();
    if BLOCKED_HOSTNAMES.contains(&host.as_str()) {
        return true;
    }
    BLOCKED_HOST_SUFFIXES
        .iter()
        .any(|suffix| host.ends_with(suffix))
}

/// Returns true when an IPv4 address must not be contacted.
pub fn ipv4_disallowed(ip: &Ipv4Addr) -> bool {
    ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_documentation()
        || ip.is_unspecified()
        || ip.is_multicast()
        || is_shared_cgnat(ip)
        || is_reserved(ip)
}

// 100.64.0.0/10 — carrier-grade NAT shared address space.
fn is_shared_cgnat(ip: &Ipv4Addr) -> bool {
    let o = ip.octets();
    o[0] == 100 && (64..=127).contains(&o[1])
}

// 240.0.0.0/4 — reserved for future use.
fn is_reserved(ip: &Ipv4Addr) -> bool {
    ip.octets()[0] >= 240
}

/// Returns true when an IPv6 address must not be contacted.
pub fn ipv6_disallowed(ip: &Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        return ipv4_disallowed(&v4);
    }
    ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        || is_unique_local_v6(ip)
        || is_link_local_v6(ip)
}

// fc00::/7 — unique local addresses.
fn is_unique_local_v6(ip: &Ipv6Addr) -> bool {
    (ip.segments()[0] & 0xfe00) == 0xfc00
}

// fe80::/10 — link-local unicast.
fn is_link_local_v6(ip: &Ipv6Addr) -> bool {
    (ip.segments()[0] & 0xffc0) == 0xfe80
}

fn ip_disallowed(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => ipv4_disallowed(&v4),
        IpAddr::V6(v6) => ipv6_disallowed(&v6),
    }
}

/// Resolves a host to socket addresses and validates every resolved IP.
///
/// If resolution yields any disallowed address the whole request is rejected
/// (conservative), which prevents DNS rebinding to internal ranges.
pub async fn resolve_allowed_addrs(
    host: &str,
    port: u16,
    policy: &UrlPolicy,
) -> RuntimeResult<Vec<SocketAddr>> {
    if policy.allow_private_networks {
        // In permissive mode we still resolve so callers get addresses, but we
        // do not reject private ranges.
        let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host, port))
            .await
            .map_err(|e| RuntimeError::Dns(e.to_string()))?
            .collect();
        if addrs.is_empty() {
            return Err(RuntimeError::Dns("no addresses resolved".into()));
        }
        return Ok(addrs);
    }

    let addrs: Vec<SocketAddr> = tokio::net::lookup_host((host, port))
        .await
        .map_err(|e| RuntimeError::Dns(e.to_string()))?
        .collect();
    if addrs.is_empty() {
        return Err(RuntimeError::Dns("no addresses resolved".into()));
    }
    for addr in &addrs {
        if ip_disallowed(addr.ip()) {
            return Err(RuntimeError::Blocked(format!(
                "host resolves to a disallowed address: {}",
                addr.ip()
            )));
        }
    }
    Ok(addrs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_public_https_url() {
        let url = validate_transport_url(
            "https://addon.example.com/manifest.json",
            &UrlPolicy::secure(),
        );
        assert!(url.is_ok());
    }

    #[test]
    fn rejects_non_https() {
        assert!(validate_transport_url(
            "http://addon.example.com/manifest.json",
            &UrlPolicy::secure()
        )
        .is_err());
        assert!(validate_transport_url("ftp://addon.example.com/x", &UrlPolicy::secure()).is_err());
    }

    #[test]
    fn permissive_allows_http_and_localhost() {
        let p = UrlPolicy::permissive();
        assert!(validate_transport_url("http://127.0.0.1:8080/manifest.json", &p).is_ok());
        assert!(validate_transport_url("http://localhost:3000/manifest.json", &p).is_ok());
    }

    #[test]
    fn rejects_embedded_credentials() {
        assert!(validate_transport_url(
            "https://user:pass@addon.example.com/m.json",
            &UrlPolicy::secure()
        )
        .is_err());
        assert!(validate_transport_url(
            "https://user@addon.example.com/m.json",
            &UrlPolicy::secure()
        )
        .is_err());
    }

    #[test]
    fn rejects_private_and_loopback_ipv4_literals() {
        let p = UrlPolicy::secure();
        for host in [
            "https://127.0.0.1/m.json",
            "https://10.0.0.5/m.json",
            "https://192.168.1.1/m.json",
            "https://172.16.0.1/m.json",
            "https://169.254.169.254/m.json", // cloud metadata
            "https://100.64.1.1/m.json",      // CGNAT
            "https://0.0.0.0/m.json",
            "https://255.255.255.255/m.json",
            "https://240.0.0.1/m.json",
        ] {
            assert!(
                validate_transport_url(host, &p).is_err(),
                "expected {host} to be blocked"
            );
        }
    }

    #[test]
    fn accepts_public_ipv4_literal() {
        assert!(validate_transport_url("https://8.8.8.8/m.json", &UrlPolicy::secure()).is_ok());
    }

    #[test]
    fn rejects_private_ipv6_literals() {
        let p = UrlPolicy::secure();
        for host in [
            "https://[::1]/m.json",              // loopback
            "https://[::]/m.json",               // unspecified
            "https://[fc00::1]/m.json",          // unique local
            "https://[fe80::1]/m.json",          // link local
            "https://[::ffff:127.0.0.1]/m.json", // mapped loopback
            "https://[::ffff:10.0.0.1]/m.json",  // mapped private
        ] {
            assert!(
                validate_transport_url(host, &p).is_err(),
                "expected {host} to be blocked"
            );
        }
    }

    #[test]
    fn accepts_public_ipv6_literal() {
        assert!(validate_transport_url(
            "https://[2001:4860:4860::8888]/m.json",
            &UrlPolicy::secure()
        )
        .is_ok());
    }

    #[test]
    fn rejects_internal_hostnames() {
        let p = UrlPolicy::secure();
        for host in [
            "https://localhost/m.json",
            "https://metadata.google.internal/m.json",
            "https://foo.internal/m.json",
            "https://printer.local/m.json",
        ] {
            assert!(
                validate_transport_url(host, &p).is_err(),
                "expected {host} to be blocked"
            );
        }
    }

    #[tokio::test]
    async fn resolves_public_host() {
        // localhost resolves to loopback and must be rejected under secure policy.
        let result = resolve_allowed_addrs("localhost", 443, &UrlPolicy::secure()).await;
        assert!(result.is_err());
        // Under permissive policy the same resolution succeeds.
        let ok = resolve_allowed_addrs("localhost", 443, &UrlPolicy::permissive()).await;
        assert!(ok.is_ok());
    }
}
