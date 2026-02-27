# OnlineSchool — Deployment Plan

This document describes how to deploy the **OnlineSchool** platform (Django backend + React frontend) to a production environment. It covers server setup, configuration, security, and optional containerization.

---

## 1. Overview

| Component | Stack |
|-----------|--------|
| **Backend** | Django 6, Django REST Framework, Django Channels (ASGI), Daphne, PostgreSQL |
| **Frontend** | React 19, TypeScript, Vite (build only in production) |
| **Real-time** | WebSockets (Django Channels); video/audio via Agora RTC (client-side) |
| **Auth** | JWT (Simple JWT); OTP via ESKIZ SMS |

Production requirements:

- **ASGI server** (Daphne) — required for both HTTP and WebSocket. Do not use `runserver` in production.
- **PostgreSQL** — primary database.
- **Redis** (recommended) — for Channels layer when running multiple Daphne/worker processes; optional for single process.
- **Reverse proxy** (e.g. Nginx) — SSL termination, static/media serving, WebSocket upgrade.

---

## 2. Prerequisites

- **Server**: Linux (Ubuntu 22.04 LTS or similar). Minimum 1 GB RAM; 2 GB+ recommended for backend + DB + Redis.
- **Domain**: e.g. `api.yourschool.com` (backend + WebSocket), `app.yourschool.com` (frontend) or a single domain with path-based routing.
- **SSL**: Certificates (e.g. Let’s Encrypt via Certbot).
- **PostgreSQL**: 14+ installed and reachable (same host or managed service).
- **Node.js**: 18+ (for building the frontend; not required on the same host as backend if you build elsewhere).
- **Python**: 3.10+ and `pip` / `venv`.

---

## 3. Backend Deployment

### 3.1 Repository and virtual environment

```bash
cd /var/www  # or your preferred path
git clone <your-repo-url> OnlineSchool
cd OnlineSchool/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3.2 Environment variables

Create `backend/.env` (never commit this file):

```env
# Required
SECRET_KEY=<generate-a-strong-secret-key>
DEBUG=False
DB_NAME=onlineschool_prod
DB_USER=onlineschool_user
DB_PASSWORD=<strong-password>
DB_HOST=localhost
DB_PORT=5432

# Optional: override in production
ALLOWED_HOSTS=api.yourschool.com,yourschool.com,127.0.0.1
```

Generate a secret key:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

### 3.3 Production settings checklist

Ensure `backend/backend/settings.py` (or a dedicated `settings_production.py`) uses:

- **SECRET_KEY**: from `os.getenv('SECRET_KEY')` — no default in production.
- **DEBUG**: `os.getenv('DEBUG', 'False').lower() == 'true'` — must be `False` in production.
- **ALLOWED_HOSTS**: from env, e.g. `os.getenv('ALLOWED_HOSTS', '').split(',')` (no `*` in production).
- **Database**: already uses `DB_*` from `.env`.
- **CORS**: set `CORS_ALLOW_ALL_ORIGINS = False` and `CORS_ALLOWED_ORIGINS = ['https://app.yourschool.com']` (your frontend origin).
- **Cookies** (if using session/CSRF over HTTPS): `SESSION_COOKIE_SECURE = True`, `CSRF_COOKIE_SECURE = True`.
- **ESKIZ**: move credentials to env (e.g. `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_NICKNAME`); remove hardcoded values.
- **Agora**: move `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` to env (see `scheduling/utils.py`).

### 3.4 Redis (recommended for Channels)

For multiple Daphne workers or horizontal scaling, use Redis as the channel layer.

Install Redis, then in settings:

```python
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {
            "hosts": [os.getenv("REDIS_URL", "redis://127.0.0.1:6379")],
        },
    },
}
```

Add `channels-redis` to `requirements.txt` and set `REDIS_URL` in `.env` if needed.

### 3.5 Static and media files

- **Static**: Django collects them into `STATIC_ROOT`; BlackNoise in `asgi.py` serves them under Daphne. For high traffic, prefer Nginx to serve `/static/` and `/media/`.
- **Media**: Ensure `MEDIA_ROOT` is on a persistent volume and backed up.

Commands:

```bash
cd /var/www/OnlineSchool/backend
source .venv/bin/activate
export DJANGO_SETTINGS_MODULE=backend.settings
python manage.py collectstatic --noinput
```

### 3.6 Database migrations and superuser

```bash
python manage.py migrate
python manage.py createsuperuser  # for admin access
```

### 3.7 Run with Daphne

Single process (development/small production):

```bash
daphne -b 0.0.0.0 -p 8000 backend.asgi:application
```

Production with binding to localhost (Nginx will proxy):

```bash
daphne -b 127.0.0.1 -p 8000 backend.asgi:application
```

Use a process manager (systemd, supervisord, or Docker) so the process restarts on failure — see Section 6.

---

## 4. Frontend Deployment

### 4.1 Build with production API/WebSocket URLs

Create `frontend/.env.production` (or set at build time):

```env
VITE_API_BASE_URL=https://api.yourschool.com
VITE_WS_BASE_URL=wss://api.yourschool.com
```

Build:

```bash
cd frontend
npm ci
npm run build
```

Output is in `frontend/dist/`. Serve this directory via Nginx (or any static host/CDN).

### 4.2 Serving the SPA

- **Nginx**: root or `alias` to `frontend/dist`; use `try_files $uri $uri/ /index.html` for client-side routing.
- **Alternative**: Backend can serve the built SPA from a path (e.g. `/`) by configuring Django to serve `index.html` for non-API routes and mapping static assets to the built JS/CSS — not covered in detail here; Nginx is simpler.

---

## 5. Nginx Configuration (Reverse Proxy)

Example Nginx config (adapt domain and paths):

```nginx
# Backend API + WebSocket
upstream backend {
    server 127.0.0.1:8000;
}

server {
    listen 443 ssl http2;
    server_name api.yourschool.com;

    ssl_certificate     /etc/letsencrypt/live/api.yourschool.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourschool.com/privkey.pem;

    # Optional: serve static/media with Nginx
    location /static/ {
        alias /var/www/OnlineSchool/backend/staticfiles/;
    }
    location /media/ {
        alias /var/www/OnlineSchool/backend/media/;
    }

    # WebSocket
    location /ws/ {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://backend;
    }

    # API and admin
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Frontend SPA
server {
    listen 443 ssl http2;
    server_name app.yourschool.com;

    ssl_certificate     /etc/letsencrypt/live/app.yourschool.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourschool.com/privkey.pem;

    root /var/www/OnlineSchool/frontend/dist;
    index index.html;
    try_files $uri $uri/ /index.html;

    location / {
        add_header Cache-Control "no-cache";
    }
    location ~* \.(js|css|ico|png|jpg|jpeg|gif|svg|woff2?)$ {
        add_header Cache-Control "public, max-age=31536000";
    }
}
```

Reload Nginx after changes: `sudo nginx -t && sudo systemctl reload nginx`.

---

## 6. Process Management (systemd)

Example systemd unit for Daphne (`/etc/systemd/system/onlineschool-daphne.service`):

```ini
[Unit]
Description=OnlineSchool Daphne ASGI
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/OnlineSchool/backend
Environment="PATH=/var/www/OnlineSchool/backend/.venv/bin"
EnvironmentFile=/var/www/OnlineSchool/backend/.env
ExecStart=/var/www/OnlineSchool/backend/.venv/bin/daphne -b 127.0.0.1 -p 8000 backend.asgi:application
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable onlineschool-daphne
sudo systemctl start onlineschool-daphne
sudo systemctl status onlineschool-daphne
```

---

## 7. Security Checklist

- [ ] **SECRET_KEY**: from environment; never in repo.
- [ ] **DEBUG**: `False` in production.
- [ ] **ALLOWED_HOSTS**: explicit list; no `*`.
- [ ] **CORS**: `CORS_ALLOWED_ORIGINS` set to frontend origin(s) only.
- [ ] **HTTPS**: enforce for API and frontend; set secure cookie flags.
- [ ] **ESKIZ / Agora**: credentials in env; no hardcoded secrets in code.
- [ ] **Database**: strong password; restrict network access.
- [ ] **Admin**: strong superuser password; consider limiting `/admin/` by IP if needed.
- [ ] **Dependencies**: run `pip audit` and fix known vulnerabilities; keep packages updated.

---

## 8. Post-Deploy Verification

1. **Health**: `curl -I https://api.yourschool.com/api/docs/` (or any API route).
2. **WebSocket**: Connect to `wss://api.yourschool.com/ws/...` with a valid JWT (e.g. from browser dev tools during a lesson).
3. **Frontend**: Open `https://app.yourschool.com`, log in, and run a quick flow (e.g. book a lesson, open classroom).
4. **Admin**: Log in at `https://api.yourschool.com/admin/`.
5. **Migrations**: After code deploys, run `python manage.py migrate` before or right after restarting Daphne.

---

## 9. Optional: Docker

Example layout (you can add Dockerfiles and compose):

- **Backend Dockerfile**: base image `python:3.11-slim`, install deps, copy app, run `daphne`.
- **Frontend**: build stage only (`node` → `npm run build`); output copied to Nginx image or served by Nginx container.
- **docker-compose**: services for `backend`, `postgres`, `redis`, `nginx`; env file for secrets; volumes for `media`, `staticfiles`, and PostgreSQL data.

This can be expanded in a separate `docker/` or `deploy/` directory with concrete Dockerfiles and `docker-compose.yml`.

---

## 10. Optional: CI/CD

- **Build**: on push to `main`, run tests (backend: `pytest`/`manage.py test`; frontend: `npm run lint` and `npm run build`).
- **Deploy**: SSH or CI runner on the server to pull latest code, run migrations, `collectstatic`, restart Daphne (and Nginx if config changed).
- **Secrets**: store `SECRET_KEY`, DB password, ESKIZ, Agora, and Redis URL in the CI/CD secret store; inject into `.env` or container env on deploy.

---

## 11. Summary

| Step | Action |
|------|--------|
| 1 | Server + PostgreSQL (+ Redis if multi-worker) |
| 2 | Clone repo, Python venv, `pip install -r requirements.txt` |
| 3 | Configure `backend/.env` (SECRET_KEY, DEBUG, DB_*, ALLOWED_HOSTS, CORS, ESKIZ, Agora) |
| 4 | Optional: Redis and `channels_redis` for CHANNEL_LAYERS |
| 5 | `collectstatic`, `migrate`, `createsuperuser` |
| 6 | Run Daphne via systemd (or Docker) |
| 7 | Build frontend with `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` |
| 8 | Nginx: SSL, proxy to Daphne, WebSocket upgrade, serve SPA and optionally static/media |
| 9 | Verify API, WebSocket, frontend, and admin |

For a single-server setup, this plan is sufficient. For scaling, add Redis, multiple Daphne workers or load balancer, and consider managed DB and object storage for media.
