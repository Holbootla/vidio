//! In-memory [`DeviceRepository`] adapter.

use std::collections::HashMap;
use std::sync::RwLock;

use application::ports::DeviceRepository;
use application::RepoError;
use async_trait::async_trait;
use domain::{Device, DeviceId, ProfileId};

type RepoResult<T> = Result<T, RepoError>;

/// Thread-safe, in-memory store of devices keyed by [`DeviceId`].
#[derive(Debug, Default)]
pub struct InMemoryDeviceRepository {
    devices: RwLock<HashMap<DeviceId, Device>>,
}

impl InMemoryDeviceRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl DeviceRepository for InMemoryDeviceRepository {
    async fn upsert(&self, device: &Device) -> RepoResult<()> {
        let mut devices = self.devices.write().expect("device store lock poisoned");
        devices.insert(device.id, device.clone());
        Ok(())
    }

    async fn find_by_id(&self, id: DeviceId) -> RepoResult<Option<Device>> {
        let devices = self.devices.read().expect("device store lock poisoned");
        Ok(devices.get(&id).cloned())
    }

    async fn list_by_profile(&self, profile_id: ProfileId) -> RepoResult<Vec<Device>> {
        let devices = self.devices.read().expect("device store lock poisoned");
        let mut result: Vec<Device> = devices
            .values()
            .filter(|device| device.profile_id == profile_id)
            .cloned()
            .collect();
        result.sort_by_key(|device| device.created_at);
        Ok(result)
    }

    async fn delete(&self, id: DeviceId) -> RepoResult<()> {
        let mut devices = self.devices.write().expect("device store lock poisoned");
        devices.remove(&id);
        Ok(())
    }
}
