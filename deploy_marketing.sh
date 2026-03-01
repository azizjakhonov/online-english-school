#!/usr/bin/env bash
# ============================================================
#  Marketing Dashboard — Full Deploy
#  Server: root@91.98.24.51
#  Backend: /var/www/backend
#  Frontend: /var/www/frontend/dist
#  Run from: D:\EDU\OnlineSchool\  (Git Bash / WSL)
# ============================================================

set -e

SERVER="root@91.98.24.51"
BACKEND_PATH="/var/www/backend"
FRONTEND_DIST="/var/www/frontend/dist"
LOCAL_FRONTEND="D:/EDU/OnlineSchool/frontend"
LOCAL_BACKEND="D:/EDU/OnlineSchool/backend"

# ──────────────────────────────────────────
# 1. GIT COMMIT & PUSH
# ──────────────────────────────────────────

echo "📦  Staging all changes..."
cd "$LOCAL_BACKEND/.."
git add .

git commit -m "feat(marketing): complete marketing dashboard — all 12 phases

- Phase 1:  Models & Admin
- Phase 2:  Analytics (GA4, Mixpanel, PostHog)
- Phase 3:  REST API /api/marketing/*
- Phase 4:  Frontend shell + role guard
- Phase 5:  Banner & Carousel Manager
- Phase 6:  Announcements Manager
- Phase 7:  Email (Resend) & SMS (Twilio) Campaigns
- Phase 8:  Discount & Promo Codes
- Phase 9:  Revenue Panel
- Phase 10: Funnel Panel
- Phase 11: Retention/Churn Panel
- Phase 12: Push Notifications (Expo + Web Push)

Fixes: TS6133 + TS2322 in RevenuePanel, Overview, RetentionPanel
Switched email provider: SendGrid → Resend"

echo "🚀  Pushing to origin..."
git push origin main


# ──────────────────────────────────────────
# 2. BUILD FRONTEND LOCALLY
# ──────────────────────────────────────────

echo ""
echo "⚛️   Building frontend..."
cd "$LOCAL_FRONTEND"
npm run build


# ──────────────────────────────────────────
# 3. UPLOAD FRONTEND DIST
# ──────────────────────────────────────────

echo ""
echo "📤  Uploading frontend dist to server..."
scp -r "$LOCAL_FRONTEND/dist/"* "$SERVER:$FRONTEND_DIST/"


# ──────────────────────────────────────────
# 4. UPLOAD CHANGED BACKEND FILES
# ──────────────────────────────────────────

echo ""
echo "📤  Uploading backend marketing app..."

# Core marketing app
scp "$LOCAL_BACKEND/marketing/models.py"           "$SERVER:$BACKEND_PATH/marketing/"
scp "$LOCAL_BACKEND/marketing/serializers.py"      "$SERVER:$BACKEND_PATH/marketing/"
scp "$LOCAL_BACKEND/marketing/views.py"            "$SERVER:$BACKEND_PATH/marketing/"
scp "$LOCAL_BACKEND/marketing/urls.py"             "$SERVER:$BACKEND_PATH/marketing/"
scp "$LOCAL_BACKEND/marketing/admin.py"            "$SERVER:$BACKEND_PATH/marketing/"
scp "$LOCAL_BACKEND/marketing/permissions.py"      "$SERVER:$BACKEND_PATH/marketing/"
scp "$LOCAL_BACKEND/marketing/tasks.py"            "$SERVER:$BACKEND_PATH/marketing/"
scp "$LOCAL_BACKEND/marketing/signals.py"          "$SERVER:$BACKEND_PATH/marketing/"

# Services (email switched to Resend)
scp "$LOCAL_BACKEND/marketing/services/email.py"   "$SERVER:$BACKEND_PATH/marketing/services/"
scp "$LOCAL_BACKEND/marketing/services/sms.py"     "$SERVER:$BACKEND_PATH/marketing/services/"
scp "$LOCAL_BACKEND/marketing/services/push.py"    "$SERVER:$BACKEND_PATH/marketing/services/"
scp "$LOCAL_BACKEND/marketing/services/analytics.py" "$SERVER:$BACKEND_PATH/marketing/services/"

# requirements (resend added)
scp "$LOCAL_BACKEND/requirements.txt"              "$SERVER:$BACKEND_PATH/"


# ──────────────────────────────────────────
# 5. SERVER-SIDE: migrate + restart
# ──────────────────────────────────────────

echo ""
echo "🖥️   Running server-side setup..."

ssh "$SERVER" << 'ENDSSH'
  set -e
  cd /var/www/backend

  echo "📦  Installing Python deps (including resend)..."
  source venv/bin/activate
  pip install -r requirements.txt

  echo "🗄️   Running migrations..."
  python manage.py migrate

  echo "📁  Collecting static files..."
  python manage.py collectstatic --noinput

  echo "🔄  Restarting Gunicorn..."
  systemctl restart gunicorn

  echo "🔄  Restarting Celery worker..."
  systemctl restart celery

  echo "🔄  Restarting Celery beat (scheduler)..."
  systemctl restart celerybeat

  echo "🔄  Reloading Nginx..."
  systemctl reload nginx

  echo ""
  echo "✅  Server deploy complete!"
ENDSSH

echo ""
echo "🎉  All done! Marketing Dashboard is live."
echo "    → https://91.98.24.51/marketing"
