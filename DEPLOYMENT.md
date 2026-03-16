# Deployment Guide

## Architecture

- Frontend: Vercel
- Backend: Railway
- Backend runtime: Dockerized Playwright-compatible container

## Required environment variables

### Frontend

Set in Vercel for the `frontend/` project:

```env
VITE_API_BASE_URL=https://your-railway-service.up.railway.app
```

### Backend

Set in Railway for the `backend/` service:

```env
PORT=8080
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
SCRAPE_TIMEOUT_MS=300000
JOB_RETENTION_MS=600000
RATE_LIMIT_MAX_REQUESTS=3
RATE_LIMIT_WINDOW_MS=60000
SCRAPER_DEBUG_ARTIFACTS=false
```

## Vercel frontend deploy steps

1. Create a new Vercel project from this repository.
2. Set the project root directory to `frontend`.
3. Confirm the framework is Vite.
4. Use the default frontend commands:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
5. Set `VITE_API_BASE_URL` to your Railway backend URL.
6. Deploy.

## Railway backend deploy steps

1. Create a new Railway project from this repository.
2. Point the service root directory to `backend`.
3. Enable Docker deployment so Railway uses the included `backend/Dockerfile`.
4. Add the backend environment variables listed above.
5. Deploy the service.
6. Confirm Railway exposes the container on `PORT=8080`.

Notes:

- The Docker image uses a Playwright-compatible Microsoft base image.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set in the Dockerfile because the base image already includes the required browser/runtime dependencies.
- If you ever deploy without Docker, the backend package also includes a production start command: `npm run start`.

## Post-deploy testing checklist

Run these checks after both services are live:

1. Open the Railway backend URL and confirm `GET /health` returns a JSON success payload.
2. Open the Vercel frontend and confirm the landing page renders correctly.
3. Submit a scrape request from the frontend.
4. Confirm the frontend receives live streaming progress events.
5. Confirm at least one result row renders when valid data is found.
6. Confirm browser console shows no CORS errors.
7. Confirm the footer stays at the bottom of the layout and still shows `Built by roninprotocol` with LinkedIn and GitHub icons.
8. Confirm the backend logs show no Playwright launch failures in Railway.
