#!/bin/bash
# Re-run migrations + collectstatic + superuser only.
# Use this AFTER emptying the database and after full_setup.sh already
# created the venv and installed packages successfully.

APP_DIR="/home/pharnorg/public_html/nutriapp.pharn.org"
VENV_DIR="$APP_DIR/venv"
PYTHON="$VENV_DIR/bin/python"

echo "=========================================="
echo "MIGRATE ONLY - $(date)"
echo "=========================================="

cd "$APP_DIR"

echo ""
echo "=== Running migrations ==="
$PYTHON manage.py migrate 2>&1

echo ""
echo "=== Collecting static files ==="
$PYTHON manage.py collectstatic --noinput 2>&1

echo ""
echo "=== Creating superuser ==="
$PYTHON manage.py shell -c "
from apps.users.models import User
import os
if not User.objects.filter(email='admin@nutriapp.pharn.org').exists():
    pw = os.environ.get('ADMIN_PASSWORD', 'Admin@Nutri2026!')
    User.objects.create_superuser(email='admin@nutriapp.pharn.org', password=pw, name='Admin')
    print('SUCCESS: Superuser created (admin@nutriapp.pharn.org)')
else:
    print('Superuser already exists')
" 2>&1

echo ""
echo "=========================================="
echo "DONE at $(date)"
echo "=========================================="
