//! In-memory [`UserRepository`] adapter.

use std::collections::HashMap;
use std::sync::RwLock;

use application::ports::UserRepository;
use application::RepoError;
use async_trait::async_trait;
use domain::{EmailAddress, User, UserId};

type RepoResult<T> = Result<T, RepoError>;

/// Thread-safe, in-memory store of user accounts keyed by [`UserId`].
#[derive(Debug, Default)]
pub struct InMemoryUserRepository {
    users: RwLock<HashMap<UserId, User>>,
}

impl InMemoryUserRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl UserRepository for InMemoryUserRepository {
    async fn create(&self, user: &User) -> RepoResult<()> {
        let mut users = self.users.write().expect("user store lock poisoned");
        if users.contains_key(&user.id) {
            return Err(RepoError::Conflict(format!(
                "user with id {} already exists",
                user.id
            )));
        }
        if users.values().any(|existing| existing.email == user.email) {
            return Err(RepoError::Conflict(format!(
                "user with email {} already exists",
                user.email
            )));
        }
        users.insert(user.id, user.clone());
        Ok(())
    }

    async fn find_by_id(&self, id: UserId) -> RepoResult<Option<User>> {
        let users = self.users.read().expect("user store lock poisoned");
        Ok(users.get(&id).cloned())
    }

    async fn find_by_email(&self, email: &EmailAddress) -> RepoResult<Option<User>> {
        let users = self.users.read().expect("user store lock poisoned");
        Ok(users.values().find(|user| &user.email == email).cloned())
    }

    async fn update(&self, user: &User) -> RepoResult<()> {
        let mut users = self.users.write().expect("user store lock poisoned");
        if !users.contains_key(&user.id) {
            return Err(RepoError::NotFound);
        }
        users.insert(user.id, user.clone());
        Ok(())
    }
}
