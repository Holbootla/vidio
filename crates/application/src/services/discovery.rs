use crate::error::{AppError, AppResult};
use crate::fanout::{fanout, FanoutJob};
use crate::ports::{AddonRepository, ProfileRepository};
use crate::services::common::authorize_profile;
use addon_protocol::{CatalogResponse, Manifest, Meta, MetaResponse, ResourceRequest};
use addon_runtime::AddonClient;
use domain::{InstallationId, ProfileId, UserId};
use serde::Serialize;
use std::sync::Arc;
use url::Url;

/// Tuning for discovery aggregation.
#[derive(Debug, Clone, Copy)]
pub struct DiscoveryConfig {
    pub max_concurrency: usize,
    pub max_items_per_row: usize,
}

impl Default for DiscoveryConfig {
    fn default() -> Self {
        Self {
            max_concurrency: 8,
            max_items_per_row: 100,
        }
    }
}

/// A non-fatal problem contacting a single add-on.
#[derive(Debug, Clone, Serialize)]
pub struct AddonWarning {
    pub installation_id: InstallationId,
    pub addon_name: String,
    pub message: String,
}

/// A catalog row aggregated from a single add-on catalog.
#[derive(Debug, Clone, Serialize)]
pub struct CatalogRow {
    pub installation_id: InstallationId,
    pub addon_name: String,
    pub catalog_id: String,
    pub content_type: String,
    pub title: String,
    pub items: Vec<addon_protocol::MetaPreview>,
}

/// Aggregated catalogs plus any add-on warnings.
#[derive(Debug, Clone, Serialize)]
pub struct DiscoveryResponse {
    pub rows: Vec<CatalogRow>,
    pub warnings: Vec<AddonWarning>,
}

struct CatalogTag {
    index: usize,
    installation_id: InstallationId,
    addon_name: String,
    catalog_id: String,
    content_type: String,
    title: String,
}

/// Aggregates catalogs, search and metadata across a profile's add-ons.
#[derive(Clone)]
pub struct DiscoveryService {
    addons: Arc<dyn AddonRepository>,
    profiles: Arc<dyn ProfileRepository>,
    client: Arc<dyn AddonClient>,
    config: DiscoveryConfig,
}

impl DiscoveryService {
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

    /// Aggregates all default (no required-extra) catalogs for the home board.
    pub async fn home(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
    ) -> AppResult<DiscoveryResponse> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let jobs = self.build_catalog_jobs(profile_id, None).await?;
        Ok(self.run_catalog_jobs(jobs).await)
    }

    /// Searches all search-capable catalogs for a query string.
    pub async fn search(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        query: &str,
    ) -> AppResult<DiscoveryResponse> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let query = query.trim();
        if query.is_empty() {
            return Err(AppError::validation("search query must not be empty"));
        }
        let jobs = self.build_catalog_jobs(profile_id, Some(query)).await?;
        Ok(self.run_catalog_jobs(jobs).await)
    }

    /// Resolves detailed metadata for an item from the first capable add-on.
    pub async fn resolve_meta(
        &self,
        user_id: UserId,
        profile_id: ProfileId,
        content_type: &str,
        id: &str,
    ) -> AppResult<Meta> {
        authorize_profile(&self.profiles, user_id, profile_id).await?;
        let installations = self.addons.list_by_profile(profile_id).await?;

        for installation in installations.iter().filter(|a| a.enabled) {
            let Ok(manifest) = Manifest::parse(&installation.manifest_snapshot) else {
                continue;
            };
            if !manifest.handles("meta", content_type, Some(id)) {
                continue;
            }
            let Ok(transport) = Url::parse(&installation.transport_url) else {
                continue;
            };
            let request = ResourceRequest::new("meta", content_type, id);
            let Ok(url) = request.to_url(&transport) else {
                continue;
            };
            if let Ok(body) = self.client.get(&url).await {
                if let Ok(parsed) = serde_json::from_str::<MetaResponse>(&body) {
                    return Ok(parsed.meta);
                }
            }
        }
        Err(AppError::not_found(
            "no add-on could provide metadata for this item",
        ))
    }

    async fn build_catalog_jobs(
        &self,
        profile_id: ProfileId,
        search: Option<&str>,
    ) -> AppResult<Vec<FanoutJob<CatalogTag>>> {
        let installations = self.addons.list_by_profile(profile_id).await?;
        let mut jobs = Vec::new();
        let mut index = 0usize;

        for installation in installations.iter().filter(|a| a.enabled) {
            let Ok(manifest) = Manifest::parse(&installation.manifest_snapshot) else {
                continue;
            };
            if !manifest.resource_names().iter().any(|r| r == "catalog") {
                continue;
            }
            let Ok(transport) = Url::parse(&installation.transport_url) else {
                continue;
            };

            for catalog in &manifest.catalogs {
                let mut request =
                    ResourceRequest::new("catalog", &catalog.content_type, &catalog.id);
                match search {
                    Some(query) => {
                        if !catalog.supports_extra("search") {
                            continue;
                        }
                        request = request.with_extra("search", query);
                    }
                    None => {
                        // Skip catalogs that cannot be loaded without extra input.
                        if !catalog.required_extras_satisfied(std::iter::empty()) {
                            continue;
                        }
                    }
                }
                let Ok(url) = request.to_url(&transport) else {
                    continue;
                };
                let title = catalog
                    .name
                    .clone()
                    .unwrap_or_else(|| format!("{} · {}", installation.name, catalog.content_type));
                jobs.push(FanoutJob {
                    tag: CatalogTag {
                        index,
                        installation_id: installation.id,
                        addon_name: installation.name.clone(),
                        catalog_id: catalog.id.clone(),
                        content_type: catalog.content_type.clone(),
                        title,
                    },
                    url,
                });
                index += 1;
            }
        }
        Ok(jobs)
    }

    async fn run_catalog_jobs(&self, jobs: Vec<FanoutJob<CatalogTag>>) -> DiscoveryResponse {
        let results = fanout(Arc::clone(&self.client), jobs, self.config.max_concurrency).await;

        let mut rows_with_index: Vec<(usize, CatalogRow)> = Vec::new();
        let mut warnings = Vec::new();

        for (tag, result) in results {
            match result {
                Ok(body) => match serde_json::from_str::<CatalogResponse>(&body) {
                    Ok(mut catalog) => {
                        catalog.metas.truncate(self.config.max_items_per_row);
                        if catalog.metas.is_empty() {
                            continue;
                        }
                        rows_with_index.push((
                            tag.index,
                            CatalogRow {
                                installation_id: tag.installation_id,
                                addon_name: tag.addon_name,
                                catalog_id: tag.catalog_id,
                                content_type: tag.content_type,
                                title: tag.title,
                                items: catalog.metas,
                            },
                        ));
                    }
                    Err(e) => warnings.push(AddonWarning {
                        installation_id: tag.installation_id,
                        addon_name: tag.addon_name,
                        message: format!("invalid catalog response: {e}"),
                    }),
                },
                Err(e) => warnings.push(AddonWarning {
                    installation_id: tag.installation_id,
                    addon_name: tag.addon_name,
                    message: e.to_string(),
                }),
            }
        }

        rows_with_index.sort_by_key(|(index, _)| *index);
        let rows = rows_with_index.into_iter().map(|(_, row)| row).collect();
        DiscoveryResponse { rows, warnings }
    }
}
