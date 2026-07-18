# syntax=docker/dockerfile:1

# Rust version must match rust-toolchain.toml.
ARG RUST_VERSION=1.97.1

# --- Base with cargo-chef for dependency layer caching ---------------------
FROM rust:${RUST_VERSION}-slim-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

# --- Plan the dependency graph --------------------------------------------
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# --- Build dependencies (cached) then the application ----------------------
FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Compiles and caches all third-party dependencies. This layer is only
# invalidated when the dependency set changes, keeping rebuilds fast.
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --bin vidio-api --bin vidio-worker

# --- Minimal runtime image -------------------------------------------------
FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
# Run as an unprivileged user.
RUN useradd --system --uid 10001 --create-home --home-dir /home/vidio vidio

COPY --from=builder /app/target/release/vidio-api /usr/local/bin/vidio-api
COPY --from=builder /app/target/release/vidio-worker /usr/local/bin/vidio-worker

USER vidio
ENV VIDIO_BIND_ADDR=0.0.0.0:8080 \
    RUST_LOG=info
EXPOSE 8080

# The API serves /health; the worker has no HTTP server (the check is skipped
# for it via the process command override in fly.toml / compose).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:8080/health" || exit 1

# Default to the API; override with `vidio-worker` to run the worker.
CMD ["vidio-api"]
