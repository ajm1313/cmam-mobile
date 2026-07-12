#!/bin/bash
# Full manual setup for nutriapp.pharn.org — no cPanel Python App tool needed.
# Run via a ONE-TIME Cron Job.

APP_DIR="/home/pharnorg/public_html/nutriapp.pharn.org"
VENV_DIR="$APP_DIR/venv"

echo "=========================================="
echo "FULL SETUP - nutriapp.pharn.org - $(date)"
echo "=========================================="

# Step 1: Find Python 3.12
echo ""
echo "=== Step 1: Locating Python 3.12 ==="
PYTHON=""
for candidate in /opt/alt/python312/bin/python3 /usr/bin/python3.12 python3.12; do
    if command -v "$candidate" >/dev/null 2>&1; then
        PYTHON="$candidate"
        break
    fi
done
if [ -z "$PYTHON" ]; then
    echo "ERROR: Python 3.12 not found. Trying python3..."
    PYTHON=$(command -v python3)
fi
echo "Using Python: $PYTHON"
$PYTHON --version

# Step 2: Create required directories
echo ""
echo "=== Step 2: Creating directories ==="
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/media"
mkdir -p "$APP_DIR/staticfiles"
touch "$APP_DIR/logs/django.log"
chmod 755 "$APP_DIR/logs"
chmod 644 "$APP_DIR/logs/django.log"
echo "Done: logs/, media/, staticfiles/ created"

# Step 3: Create virtual environment (only if missing)
echo ""
echo "=== Step 3: Creating virtual environment ==="
if [ -d "$VENV_DIR" ] && [ -f "$VENV_DIR/bin/python" ]; then
    echo "Venv already exists, skipping creation..."
else
    rm -rf "$VENV_DIR"
    $PYTHON -m venv "$VENV_DIR"
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to create venv. Trying with --without-pip..."
        $PYTHON -m venv --without-pip "$VENV_DIR"
        curl -sS https://bootstrap.pypa.io/get-pip.py | "$VENV_DIR/bin/python3"
    fi
fi
echo "Venv created at: $VENV_DIR"

# Step 4: Install dependencies
echo ""
echo "=== Step 4: Installing dependencies ==="
source "$VENV_DIR/bin/activate"
echo "Venv Python: $(which python)"
pip install --upgrade pip 2>&1
pip install -r "$APP_DIR/requirements.txt" 2>&1

if [ $? -ne 0 ]; then
    echo "WARNING: Some packages may have failed. Retrying individually..."
    pip install Django==5.0.1 djangorestframework==3.14.0 django-cors-headers==4.3.1 python-decouple==3.8 Pillow==10.2.0 gunicorn==21.2.0 whitenoise==6.6.0 djangorestframework-simplejwt==5.3.1 django-filter==23.5 pytz==2024.1 django-ratelimit==4.1.0 openpyxl==3.1.2
    pip install mysqlclient==2.2.1 || pip install PyMySQL
fi

echo ""
echo "Installed packages:"
pip list

# Step 5: Run migrations
echo ""
echo "=== Step 5: Running migrations ==="
cd "$APP_DIR"
python manage.py migrate 2>&1

# Step 6: Collect static files
echo ""
echo "=== Step 6: Collecting static files ==="
python manage.py collectstatic --noinput 2>&1

# Step 7: Create superuser
echo ""
echo "=== Step 7: Creating superuser ==="
python manage.py shell -c "
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
echo "SETUP COMPLETE at $(date)"
echo "App dir:  $APP_DIR"
echo "Venv:     $VENV_DIR"
echo "Python:   $($VENV_DIR/bin/python --version)"
echo "=========================================="
