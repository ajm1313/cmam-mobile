#!/bin/bash
# Fix: create logs dir, run migrations, collect static, create superuser
# This script assumes venv and packages are already installed.
APP_DIR="/home/pharnorg/public_html/nutri.pharn.org"
VENV_DIR="$APP_DIR/venv"

echo "=========================================="
echo "FIX & MIGRATE - $(date)"
echo "=========================================="

# Step 1: Create missing directories FIRST (before any Django command)
echo ""
echo "=== Step 1: Creating directories ==="
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/media"
mkdir -p "$APP_DIR/staticfiles"
touch "$APP_DIR/logs/django.log"
chmod 755 "$APP_DIR/logs"
chmod 644 "$APP_DIR/logs/django.log"
echo "Created: logs/ media/ staticfiles/"
echo "Created: logs/django.log"
ls -la "$APP_DIR/logs/"

# Step 2: Activate venv
echo ""
echo "=== Step 2: Activating venv ==="
source "$VENV_DIR/bin/activate"
echo "Python: $(which python)"
echo "Version: $(python --version)"
cd "$APP_DIR"

# Step 3: Run migrations
echo ""
echo "=== Step 3: Running migrations ==="
python manage.py migrate 2>&1

# Step 4: Collect static files
echo ""
echo "=== Step 4: Collecting static files ==="
python manage.py collectstatic --noinput 2>&1

# Step 5: Create superuser
echo ""
echo "=== Step 5: Creating superuser ==="
python manage.py shell -c "
from apps.users.models import User
import os
if not User.objects.filter(email='admin@nutri.pharn.org').exists():
    pw = os.environ.get('ADMIN_PASSWORD', 'Admin@Nutri2026!')
    User.objects.create_superuser(email='admin@nutri.pharn.org', password=pw, name='Admin')
    print('SUCCESS: Superuser created (admin@nutri.pharn.org)')
else:
    print('Superuser already exists')
" 2>&1

echo ""
echo "=========================================="
echo "ALL DONE at $(date)"
echo "=========================================="
