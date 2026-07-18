use std::sync::{Arc, Mutex};
use time::OffsetDateTime;

/// Abstracts the current time so services can be tested deterministically.
pub trait Clock: Send + Sync {
    fn now(&self) -> OffsetDateTime;
}

/// A [`Clock`] backed by the system wall clock (UTC).
#[derive(Debug, Default, Clone, Copy)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> OffsetDateTime {
        OffsetDateTime::now_utc()
    }
}

/// A controllable [`Clock`] for tests; time only advances when told to.
#[derive(Debug, Clone)]
pub struct FixedClock {
    inner: Arc<Mutex<OffsetDateTime>>,
}

impl FixedClock {
    pub fn new(start: OffsetDateTime) -> Self {
        Self {
            inner: Arc::new(Mutex::new(start)),
        }
    }

    pub fn advance(&self, by: time::Duration) {
        let mut guard = self.inner.lock().unwrap();
        *guard += by;
    }
}

impl Clock for FixedClock {
    fn now(&self) -> OffsetDateTime {
        *self.inner.lock().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use time::Duration;

    #[test]
    fn fixed_clock_advances() {
        let clock = FixedClock::new(OffsetDateTime::UNIX_EPOCH);
        assert_eq!(clock.now(), OffsetDateTime::UNIX_EPOCH);
        clock.advance(Duration::seconds(60));
        assert_eq!(
            clock.now(),
            OffsetDateTime::UNIX_EPOCH + Duration::seconds(60)
        );
    }
}
