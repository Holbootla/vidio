use crate::ids::ProfileId;
use crate::media::{MediaKey, MediaType};
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;

/// An entry in a profile's personal library.
///
/// A soft `removed` flag is kept (rather than deleting) so that removals can be
/// propagated to other devices through the incremental sync feed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LibraryEntry {
    pub profile_id: ProfileId,
    pub media_key: MediaKey,
    pub media_type: MediaType,
    pub name: String,
    pub poster: Option<String>,
    /// Raw meta preview JSON snapshot so the library renders without add-ons.
    pub meta_snapshot: Option<String>,
    pub removed: bool,
    pub added_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

impl LibraryEntry {
    pub fn new(
        profile_id: ProfileId,
        media_key: MediaKey,
        media_type: MediaType,
        name: impl Into<String>,
        now: OffsetDateTime,
    ) -> Self {
        Self {
            profile_id,
            media_key,
            media_type,
            name: name.into(),
            poster: None,
            meta_snapshot: None,
            removed: false,
            added_at: now,
            updated_at: now,
        }
    }

    pub fn mark_removed(&mut self, now: OffsetDateTime) {
        self.removed = true;
        self.updated_at = now;
    }

    pub fn restore(&mut self, now: OffsetDateTime) {
        self.removed = false;
        self.updated_at = now;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remove_and_restore_toggle_flag() {
        let key = MediaKey::from_content(&MediaType::Movie, "a", "tt1").unwrap();
        let mut entry = LibraryEntry::new(
            ProfileId::new(),
            key,
            MediaType::Movie,
            "Film",
            OffsetDateTime::UNIX_EPOCH,
        );
        assert!(!entry.removed);
        entry.mark_removed(OffsetDateTime::UNIX_EPOCH);
        assert!(entry.removed);
        entry.restore(OffsetDateTime::UNIX_EPOCH);
        assert!(!entry.removed);
    }
}
