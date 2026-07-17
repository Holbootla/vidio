//! In-memory [`SessionRepository`] adapter.

use std::collections::HashMap;
use std::sync::RwLock;

use application::ports::SessionRepository;
use application::RepoError;
use async_trait::async_trait;
use domain::{Session, SessionId, UserId};

type RepoResult<T> = Result<T, RepoError>;

/// Thread-safe, in-memory store of refresh-token sessions keyed by [`SessionId`].
#[derive(Debug, Default)]
pub struct InMemorySessionRepository {
    sessions: RwLock<HashMap<SessionId, Session>>,
}

impl InMemorySessionRepository {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl SessionRepository for InMemorySessionRepository {
    async fn create(&self, session: &Session) -> RepoResult<()> {
        let mut sessions = self.sessions.write().expect("session store lock poisoned");
        if sessions.contains_key(&session.id) {
            return Err(RepoError::Conflict(format!(
                "session with id {} already exists",
                session.id
            )));
        }
        if sessions
            .values()
            .any(|existing| existing.refresh_token_hash == session.refresh_token_hash)
        {
            return Err(RepoError::Conflict(
                "session with the same refresh token hash already exists".to_string(),
            ));
        }
        sessions.insert(session.id, session.clone());
        Ok(())
    }

    async fn find_by_id(&self, id: SessionId) -> RepoResult<Option<Session>> {
        let sessions = self.sessions.read().expect("session store lock poisoned");
        Ok(sessions.get(&id).cloned())
    }

    async fn find_by_token_hash(&self, token_hash: &str) -> RepoResult<Option<Session>> {
        let sessions = self.sessions.read().expect("session store lock poisoned");
        Ok(sessions
            .values()
            .find(|session| session.refresh_token_hash == token_hash)
            .cloned())
    }

    async fn update(&self, session: &Session) -> RepoResult<()> {
        let mut sessions = self.sessions.write().expect("session store lock poisoned");
        if !sessions.contains_key(&session.id) {
            return Err(RepoError::NotFound);
        }
        sessions.insert(session.id, session.clone());
        Ok(())
    }

    async fn revoke_all_for_user(
        &self,
        user_id: UserId,
        now: time::OffsetDateTime,
    ) -> RepoResult<()> {
        let mut sessions = self.sessions.write().expect("session store lock poisoned");
        for session in sessions.values_mut() {
            if session.user_id == user_id && session.revoked_at.is_none() {
                session.revoked_at = Some(now);
            }
        }
        Ok(())
    }
}
