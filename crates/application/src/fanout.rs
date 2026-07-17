use addon_runtime::{AddonClient, RuntimeResult};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::task::JoinSet;
use url::Url;

/// A single add-on request with a caller-supplied correlation tag.
pub struct FanoutJob<T> {
    pub tag: T,
    pub url: Url,
}

/// Fetches many add-on URLs concurrently with a bounded degree of parallelism.
///
/// Each result is paired with its job tag so callers can restore ordering. A
/// failing or panicking request never aborts the others; failures are returned
/// as `Err` values (panics are dropped with the tag lost, which cannot happen
/// for the pure I/O closure used here).
pub async fn fanout<T>(
    client: Arc<dyn AddonClient>,
    jobs: Vec<FanoutJob<T>>,
    max_concurrency: usize,
) -> Vec<(T, RuntimeResult<String>)>
where
    T: Send + 'static,
{
    let semaphore = Arc::new(Semaphore::new(max_concurrency.max(1)));
    let mut set: JoinSet<(T, RuntimeResult<String>)> = JoinSet::new();

    for job in jobs {
        let client = Arc::clone(&client);
        let semaphore = Arc::clone(&semaphore);
        set.spawn(async move {
            let _permit = semaphore
                .acquire_owned()
                .await
                .expect("semaphore is never closed");
            let result = client.get(&job.url).await;
            (job.tag, result)
        });
    }

    let mut results = Vec::new();
    while let Some(joined) = set.join_next().await {
        if let Ok(pair) = joined {
            results.push(pair);
        }
    }
    results
}

#[cfg(test)]
mod tests {
    use super::*;
    use addon_runtime::MockAddonClient;

    #[tokio::test]
    async fn fetches_all_jobs_and_preserves_tags() {
        let client = MockAddonClient::new();
        client.insert("https://a.example/manifest.json", "A");
        client.insert("https://b.example/manifest.json", "B");
        let client: Arc<dyn AddonClient> = Arc::new(client);

        let jobs = vec![
            FanoutJob {
                tag: 0usize,
                url: Url::parse("https://a.example/manifest.json").unwrap(),
            },
            FanoutJob {
                tag: 1usize,
                url: Url::parse("https://b.example/manifest.json").unwrap(),
            },
            FanoutJob {
                tag: 2usize,
                url: Url::parse("https://missing.example/x.json").unwrap(),
            },
        ];
        let mut results = fanout(client, jobs, 4).await;
        results.sort_by_key(|(tag, _)| *tag);

        assert_eq!(results[0].1.as_deref().unwrap(), "A");
        assert_eq!(results[1].1.as_deref().unwrap(), "B");
        assert!(results[2].1.is_err());
    }
}
