# Google Maps Lead Scraper

A production-ready split deployment project for extracting Google Maps business leads with a React frontend and a Playwright-powered Express backend.

## Project overview

- `frontend/` contains the Vite + React UI intended for Vercel.
- `backend/` contains the Express API and Playwright scraper intended for Railway.
- The frontend talks to the backend through `VITE_API_BASE_URL`.
- The backend exposes:
  - `GET /health`
  - `POST /scrape`
  - `GET /progress/:jobId`

## Project structure

```text
.
|-- backend/
|   |-- .dockerignore
|   |-- .env.example
|   |-- Dockerfile
|   |-- package.json
|   |-- tsconfig.json
|   `-- src/
|       |-- server.ts
|       `-- lib/
|           |-- formatter.ts
|           |-- scraper.ts
|           `-- searchBuilder.ts
|-- frontend/
|   |-- .env.example
|   |-- package.json
|   |-- tsconfig.json
|   |-- vercel.json
|   |-- vite.config.ts
|   |-- index.html
|   `-- src/
|       |-- App.tsx
|       |-- main.tsx
|       |-- index.css
|       |-- types.ts
|       |-- lib/
|       |   `-- api.ts
|       |-- components/
|       `-- utils/
|-- DEPLOYMENT.md
|-- package.json
|-- tsconfig.base.json
`-- tsconfig.json
```

## Local setup

### 1. Install dependencies

This repository keeps a root toolchain for local development and separate package manifests for deployment targets.

```bash
npm install
```

If you want isolated frontend/backend installs for deployment simulation, you can also install inside `frontend/` and `backend/` separately.

### 2. Configure environment files

Frontend:

```bash
cp frontend/.env.example frontend/.env
```

Backend:

```bash
cp backend/.env.example backend/.env
```

### 3. Run the backend

Recommended: use Docker so you do not need to install Playwright browsers locally.

```bash
docker build -t gmaps-lead-scraper-backend ./backend
docker run --rm -p 3000:8080 --env-file backend/.env gmaps-lead-scraper-backend
```

If you already have the Node dependencies locally and want to run the backend directly:

```bash
npm run dev:backend
```

### 4. Run the frontend

```bash
npm run dev:frontend
```

The frontend runs on `http://localhost:5173` by default and should target the backend defined by `frontend/.env`.

## Deployment overview

- Deploy `frontend/` to Vercel.
- Deploy `backend/` to Railway using the included Dockerfile.
- Set the frontend `VITE_API_BASE_URL` to the Railway backend URL.
- Set backend `CORS_ALLOWED_ORIGINS` to include your Vercel frontend domain.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step deployment checklist.
