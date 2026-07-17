use crate::error::AppResult;
use crate::fanout::{fanout, FanoutJob};
use crate::ports::{AddonRepository, ProfileRepository};
use crate::services::common::authorize_profile;
use crate::services::discovery::{AddonWarning, DiscoveryConfig};
use addon_protocol::{
    Manifest, ResourceRequest, Stream, StreamKind, StreamsResponse, Subtitle, SubtitlesResponse,
};
use addon_runtime::AddonClient;
use domain::{InstallationId, Profile, ProfileId, UserId};
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Arc;
use url::Url;

/// A normalized playback source with provenance and capability flags.
#[derive(Debug, Clone, Serialize)]
pub struct ResolvedStream {
    pub installation_id: InstallationId,
    pub addon_name: String,
    pub kind: String,
    pub is_web_ready: bool,
    /// Whether the initial backend can deliver this source to clients.
    pub supported: bool,
    pub stream: Stream,
}

/// A subtitle track with provenance.
#[derive(Debug, Clone, Serialize)]
pub struct ResolvedSubtitle {
    pub installation_id: InstallationId,
    pub addon_name: String,
    pub subtitle: Subtitle,
}

/// Resolved streams plus non-fatal add-on warnings.
#[derive(Debug, Clone, Serialize)]
pub struct StreamResolution {
    pub streams: Vec<ResolvedStream>,
    pub warnings: Vec<AddonWarning>,
}

/// Resolved subtitles plus non-fatal add-on warnings.
#[derive(Debug, Clone, Serialize)]
pub struct SubtitleResolution {
    pub subtitles: Vec<ResolvedSubtitle>,
    pub warnings: Vec<AddonWarning>,
}

struct AddonTag {
    index: usize,
    installation_id: InstallationId,
    addon_name: String,
}

/// Resolves streams and subtitles for playback across a profile's add-ons.
#[derive(Clone)]
pub struct PlaybackService {
    addons: Arc<dyn AddonRepository>,
    profiles: Arc<dyn ProfileRepository>,
    client: Arc<dyn AddonClient>,
    config: DiscoveryConfig,
}

impl PlaybackService {
    pub fn new(
        addons: Arc<dyn AddonRepository>,
        profiles: Arc<dyn ProfileRepository>,
        client: Arc<dyn AddonClient>,
        config: DiscoveryConfig,
    ) -> Self {
        Self {
            addons,
            profiles,
            client,
            config,
        }
    }

    /// Resolves all playable streams for a video across capable add-ons.
    pub async fn resolve_streams(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        content_type: &str,
        video_id: &str,
    ) -> AppResult<StreamResolution> {
        let profile = authorize_profile(&self.profiles, user_id, profile_id).await?;
        let jobs = self
            .build_jobs("stream", profile_id, content_type, video_id, &[])
            .await?;
        let results = fanout(Arc::clone(&self.client), jobs, self.config.max_concurrency).await;

        let mut collected: Vec<(usize, ResolvedStream)> = Vec::new();
        let mut warnings = Vec::new();
        let mut seen_urls: HashSet<String> = HashSet::new();

        for (tag, result) in results {
            match result {
                Ok(body) => match serde_json::from_str::<StreamsResponse>(&body) {
                    Ok(response) => {
                        for (offset, stream) in response.streams.into_iter().enumerate() {
                            if let Some(resolved) =
                                self.normalize_stream(&tag, stream, &profile, &mut seen_urls)
                            {
                                collected.push((tag.index * 1000 + offset, resolved));
                            }
                        }
                    }
                    Err(e) => warnings.push(warn(&tag, format!("invalid stream response: {e}"))),
                },
                Err(e) => warnings.push(warn(&tag, e.to_string())),
            }
        }

        collected.sort_by_key(|(order, _)| *order);
        let streams = collected.into_iter().map(|(_, s)| s).collect();
        Ok(StreamResolution { streams, warnings })
    }

    /// Resolves subtitle tracks for an item across capable add-ons.
    pub async fn resolve_subtitles(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        content_type: &str,
        id: &str,
    ) -> AppResult<SubtitleResolution> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let jobs = self
            .build_jobs("subtitles", profile_id, content_type, id, &[])
            .await?;
        let results = fanout(Arc::clone(&self.client), jobs, self.config.max_concurrency).await;

        let mut collected: Vec<(usize, ResolvedSubtitle)> = Vec::new();
        let mut warnings = Vec::new();
        let mut seen_urls: HashSet<String> = HashSet::new();

        for (tag, result) in results {
            match result {
                Ok(body) => match serde_json::from_str::<SubtitlesResponse>(&body) {
                    Ok(response) => {
                        for (offset, subtitle) in response.subtitles.into_iter().enumerate() {
                            if seen_urls.insert(subtitle.url.clone()) {
                                collected.push((
                                    tag.index * 1000 + offset,
                                    ResolvedSubtitle {
                                        installation_id: tag.installation_id,
                                        addon_name: tag.addon_name.clone(),
                                        subtitle,
                                    },
                                ));
                            }
                        }
                    }
                    Err(e) => warnings.push(warn(&tag, format!("invalid subtitle response: {e}"))),
                },
                Err(e) => warnings.push(warn(&tag, e.to_string())),
            }
        }

        collected.sort_by_key(|(order, _)| *order);
        let subtitles = collected.into_iter().map(|(_, s)| s).collect();
        Ok(SubtitleResolution {
            subtitles,
            warnings,
        })
    }

    fn normalize_stream(
        &self,
        tag: &AddonTag,
        stream: Stream,
        profile: &Profile,
        seen_urls: &mut HashSet<String>,
    ) -> Option<ResolvedStream> {
        let kind = stream.kind();

        // Respect the user's preference to hide P2P sources.
        if profile.preferences.hide_p2p_streams && kind == StreamKind::Torrent {
            return None;
        }

        // Deduplicate identical direct URLs across add-ons.
        if let Some(url) = &stream.url {
            if !seen_urls.insert(url.clone()) {
                return None;
            }
        }

        Some(ResolvedStream {
            installation_id: tag.installation_id,
            addon_name: tag.addon_name.clone(),
            kind: kind.as_str().to_string(),
            is_web_ready: stream.is_web_ready(),
            supported: kind.is_supported(),
            stream,
        })
    }

    async fn build_jobs(
        &self,
        resource: &str,
        profile_id: ProfileId,
        content_type: &str,
        id: &str,
        extra: &[(String, String)],
    ) -> AppResult<Vec<FanoutJob<AddonTag>>> {
        let installations = self.addons.list_by_profile(profile_id).await?;
        let mut jobs = Vec::new();
        let mut index = 0usize;

        for installation in installations.iter().filter(|a| a.enabled) {
            let Ok(manifest) = Manifest::parse(&installation.manifest_snapshot) else {
                continue;
            };
            if !manifest.handles(resource, content_type, Some(id)) {
                continue;
            }
            let Ok(transport) = Url::parse(&installation.transport_url) else {
                continue;
            };
            let mut request = ResourceRequest::new(resource, content_type, id);
            for (key, value) in extra {
                request = request.with_extra(key, value);
            }
            let Ok(url) = request.to_url(&transport) else {
                continue;
            };
            jobs.push(FanoutJob {
                tag: AddonTag {
                    index,
                    installation_id: installation.id,
                    addon_name: installation.name.clone(),
                },
                url,
            });
            index += 1;
        }
        Ok(jobs)
    }
}

fn warn(tag: &AddonTag, message: String) -> AddonWarning {
    AddonWarning {
        installation_id: tag.installation_id,
        addon_name: tag.addon_name.clone(),
        message,
    }
}
