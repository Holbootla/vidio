use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

/// Declares a strongly-typed, time-ordered identifier newtype over [`Uuid`].
///
/// Using distinct types prevents accidentally passing, e.g., a `UserId` where a
/// `ProfileId` is expected. New identifiers are generated as UUIDv7 so they are
/// sortable by creation time, which is friendly to database indexes.
macro_rules! define_id {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
        #[serde(transparent)]
        pub struct $name(Uuid);

        impl $name {
            /// Generates a new time-ordered identifier (UUIDv7).
            #[allow(clippy::new_without_default)]
            pub fn new() -> Self {
                Self(Uuid::now_v7())
            }

            /// Wraps an existing [`Uuid`].
            pub const fn from_uuid(id: Uuid) -> Self {
                Self(id)
            }

            /// Returns the inner [`Uuid`].
            pub const fn as_uuid(&self) -> Uuid {
                self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl FromStr for $name {
            type Err = uuid::Error;
            fn from_str(s: &str) -> Result<Self, Self::Err> {
                Ok(Self(Uuid::parse_str(s)?))
            }
        }

        impl From<Uuid> for $name {
            fn from(id: Uuid) -> Self {
                Self(id)
            }
        }
    };
}

define_id!(
    /// Identifies a user account.
    UserId
);
define_id!(
    /// Identifies a viewing profile owned by a user.
    ProfileId
);
define_id!(
    /// Identifies a device bound to a profile.
    DeviceId
);
define_id!(
    /// Identifies a refresh-token session.
    SessionId
);
define_id!(
    /// Identifies an installed add-on for a profile.
    InstallationId
);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_ids_are_unique_and_ordered() {
        let a = UserId::new();
        let b = UserId::new();
        assert_ne!(a, b);
        // UUIDv7 is time-ordered: the later id sorts after the earlier one.
        assert!(a < b);
    }

    #[test]
    fn round_trips_through_string() {
        let id = ProfileId::new();
        let parsed: ProfileId = id.to_string().parse().unwrap();
        assert_eq!(id, parsed);
    }

    #[test]
    fn serializes_transparently_as_plain_uuid_string() {
        let id = DeviceId::from_uuid(Uuid::nil());
        let json = serde_json::to_string(&id).unwrap();
        assert_eq!(json, "\"00000000-0000-0000-0000-000000000000\"");
    }

    #[test]
    fn distinct_id_types_do_not_unify() {
        // This is a compile-time guarantee; here we just assert the API exists.
        let user = UserId::new();
        let profile = ProfileId::new();
        assert_ne!(user.as_uuid(), profile.as_uuid());
    }
}
