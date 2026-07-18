# Deploying Vidio Web

Production image uses Next.js `standalone` output (see `next.config.ts`).

## Build image

```bash
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com \
  -t vidio-web:latest \
  ./vidio-web
```

## Run container

```bash
docker run --rm -p 3000:3000 \
  -e VIDIO_API_BASE_URL=https://api.example.com \
  -e VIDIO_REFRESH_COOKIE_NAME=vidio_refresh_token \
  vidio-web:latest
```

Health check: `GET /` (or configure upstream to probe port 3000).

## Required environment

| Variable                    | Scope        | Notes                                                     |
| --------------------------- | ------------ | --------------------------------------------------------- |
| `VIDIO_API_BASE_URL`        | Server (BFF) | Rust API base URL; never expose refresh tokens to browser |
| `NEXT_PUBLIC_API_BASE_URL`  | Build arg    | Public API URL compiled into the browser bundle           |
| `VIDIO_REFRESH_COOKIE_NAME` | Server       | Defaults to `vidio_refresh_token`                         |
| `NODE_ENV`                  | Server       | `production` in image                                     |

## Security

- Refresh tokens are **httpOnly**, `SameSite=Strict`, `Secure` in production, path `/api/auth`.
- Access tokens live in memory only (Zustand); lost on full reload → BFF refresh.
- Do not mount `.env.local` into the container; inject secrets via orchestrator secrets.
- Terminate TLS at your ingress; set `Secure` cookies accordingly.
- CORS is not required for same-origin BFF + API when the browser talks to one public API host.
- Rebuild the image to change `NEXT_PUBLIC_API_BASE_URL`; Next.js public variables are compile-time values.

## CI

GitHub Actions workflow: `.github/workflows/vidio-web.yml` (working directory `vidio-web`).
