#!/bin/bash
# Setup for new path: /home/pharnorg/nutri.pharn.org
APP_DIR="/home/pharnorg/nutri.pharn.org"
VENV_DIR="$APP_DIR/venv"
SYSTEM_PYTHON="/opt/alt/python312/bin/python3"
VENV_PYTHON="$VENV_DIR/bin/python"
VENV_PIP="$VENV_DIR/bin/pip"

echo "=========================================="
echo "SETUP NEW PATH - $(date)"
echo "=========================================="

# Step 1: Create directories
echo "=== Step 1: Creating directories ==="
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/media"
mkdir -p "$APP_DIR/staticfiles"
touch "$APP_DIR/logs/django.log"
chmod 755 "$APP_DIR/logs"
chmod 644 "$APP_DIR/logs/django.log"
echo "Done: directories created"

# Step 2: Recreate venv fresh (old one has wrong paths)
echo ""
echo "=== Step 2: Recreating venv ==="
echo "Removing broken venv..."
rm -rf "$VENV_DIR"
echo "Creating fresh venv with $SYSTEM_PYTHON..."
$SYSTEM_PYTHON -m venv "$VENV_DIR"
echo "Venv Python: $VENV_PYTHON"
echo "Version: $($VENV_PYTHON --version)"

# Step 3: Install packages
echo ""
echo "=== Step 3: Installing packages ==="
$VENV_PIP install --upgrade pip 2>&1
$VENV_PIP install -r "$APP_DIR/requirements.txt" 2>&1

echo ""
echo "Installed packages:"
$VENV_PIP list

# Step 4: Run migrations
echo ""
echo "=== Step 4: Running migrations ==="
cd "$APP_DIR"
$VENV_PYTHON manage.py migrate 2>&1

# Step 5: Collect static files
echo ""
echo "=== Step 5: Collecting static files ==="
$VENV_PYTHON manage.py collectstatic --noinput 2>&1

# Step 6: Create superuser
echo ""
echo "=== Step 6: Creating superuser ==="
$VENV_PYTHON manage.py shell -c "
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
