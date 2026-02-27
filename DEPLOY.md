# Deployment Plan for OnlineSchool

This document describes the end-to-end deployment process for the OnlineSchool project, covering both backend (Django/Channels) and frontend (React/Vite) components, environment preparation, infrastructure, and validation steps.

---

## 1. Preparation

1. **Repository & Branching**
   - Maintain `main`/`master` for production-ready code.
   - Use feature branches, merge via PR with CI checks (lint, tests, type-check).

2. **Environment Variables**
   - Backend (`backend/.env`)
     ```
     DEBUG=False
     DB_NAME=…
     DB_USER=…
     DB_PASSWORD=…
     DB_HOST=…
     DB_PORT=…
     SECRET_KEY=<secure value>
     ALLOWED_HOSTS=…
     CHANNEL_LAYERS_BACKEND=redis  # production
     ```
   - Frontend (`frontend/.env`)
     ```
     VITE_API_BASE_URL=https://api.example.com
     VITE_WS_BASE_URL=wss://api.example.com
     ```
   - Store secrets in a vault (AWS Secrets Manager, Azure Key Vault) – never commit.

3. **Dependencies**
   - Backend: `pip install -r requirements.txt`; ideally pinned with `pip-compile`.
   - Frontend: `npm ci` (or `yarn --frozen-lockfile`).

4. **Database Migration Plan**
   - Use `python manage.py migrate` on the target DB.
   - For zero-downtime, consider online migration strategies.

5. **Static & Media Storage**
   - Configure `STATIC_ROOT` and run `collectstatic`.
   - Serve media via object storage (S3, Azure Blob) with `django-storages`.
   - Cache-bust assets (hash filenames).

6. **Channels & WebSockets**
   - Switch from `InMemoryChannelLayer` to Redis in production.
   - Ensure Redis is reachable from all backend instances.

---

## 2. Deployment Steps

### A. Infrastructure

1. **Provision Servers/Containers**
   - Backend: Docker image built from `backend/` directory.
   - Frontend: Static build served by CDN (Vercel, Netlify, S3+CloudFront) or NGINX container.
   - Use orchestration (Kubernetes, ECS, or simple VM + supervisord).

2. **Build Process**
   - Backend:
     ```bash
     cd backend
     python -m pip install -r requirements.txt
     python manage.py collectstatic --noinput
     python manage.py migrate
     ```
   - Frontend:
     ```bash
     cd frontend
     npm run build   # output to dist/
     ```
   - Store build artifacts in a registry or artifact store for reproducibility.

3. **Web Server & ASGI**
   - Launch Daphne (or Uvicorn) to serve Django/Channels:
     ```bash
     daphne -b 0.0.0.0 -p 8000 backend.asgi:application
     ```
   - Place NGINX (or similar) in front to:
     - Proxy HTTP → Daphne
     - Terminate TLS
     - Serve static files directly
     - Proxy `/ws/` or similar paths to Daphne for WebSocket traffic

4. **Load Balancing & Scaling**
   - Use a load balancer (ELB, nginx, Traefik) across multiple backend instances.
   - WebSocket sticky-session support or use a shared Redis channel layer.

5. **Caching & Performance**
   - Enable Django’s cache (Redis/memcached) for sessions, query caching, etc.
   - Use CDN for static/JS assets.
   - Configure database connection pooling.

6. **Monitoring & Logging**
   - Setup:
     - Application logs to stdout → aggregated by ELK/Datadog.
     - Error tracking (Sentry).
     - Metrics: CPU/memory, Redis queue lengths, WebSocket connection counts.
     - Health-check endpoints for load balancer.

---

## 3. Post-Deployment Validation

1. **Smoke Tests**
   - Hit `/api/docs/` — expect 200 and Swagger UI.
   - Authenticate via OTP, create a user.
   - Book a lesson, confirm video room connects (Agora token).

2. **Role Flows**
   - Login as teacher, student, admin; verify dashboards and permissions.

3. **WebSocket Functionality**
   - Start a lesson with a teacher and student; draw on whiteboard, confirm sync.
   - Verify Redis channel layer works across instances.

4. **Homework & Curriculum**
   - Create homework, submit answers, inspect auto-grading.
   - Add a course/unit/lesson through admin and ensure API reflects changes.

5. **Static/Media**
   - Upload a profile picture; verify it’s served from object storage.
   - Check CSS/JS assets have hashed filenames and are delivered via CDN.

---

## 4. Maintenance & Rollback

- **Releases**: Tag releases in Git; maintain changelog.
- **Rollback Strategy**:
  1. Keep previous Docker image or build.
  2. Run `python manage.py migrate <previous>` if schema changed (use `--plan`).
  3. Re-deploy old build and verify smoke tests.
- **Backup**:
  - Schedule daily DB dumps.
  - Mirror media storage.

---

## Security & Compliance

- Enforce HTTPS everywhere.
- Rotate `SECRET_KEY`, DB credentials, and API keys regularly.
- Use CSP headers via Django settings.
- Limit CORS to allowed origins.

---

## Environment Matrix

| Environment  | Backend Host        | Frontend Host       | DB           | Redis        | Notes                   |
|--------------|---------------------|---------------------|--------------|--------------|-------------------------|
| Development  | local               | local               | sqlite/PG    | local        | `DEBUG=True`            |
| Staging      | staging.example.com | staging.example.com | managed PG   | Redis cluster| Mirror prod             |
| Production   | api.example.com     | app.example.com     | managed PG   | Redis cluster| Auto-scale              |

---

### Tips

- Use a CI pipeline to automatically build & push images, run tests, and deploy to staging.
- Incorporate `manage.py check --deploy` in pre-deployment scripts.
- Document special command sequences in `DEPLOYMENT.md` for on-call engineers.

---

This plan should provide a strong foundation for rolling out the OnlineSchool platform reliably, with clear steps for environment setup, deployment, validation, and fallback. Adjust specifics (hosts, services) to fit your infrastructure (e.g., AWS, Azure, Heroku).