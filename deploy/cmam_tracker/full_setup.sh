#!/bin/bash
# =============================================================
# CMAM Tracker - Full Manual Setup (bypasses cPanel Python App)
# Run via: cPanel → Cron Jobs
# Command: bash /home/pharnorg/public_html/nutri.pharn.org/full_setup.sh >> /home/pharnorg/setup_log.txt 2>&1
# =============================================================

APP_DIR="/home/pharnorg/public_html/nutri.pharn.org"
VENV_DIR="$APP_DIR/venv"
LOG="/home/pharnorg/setup_log.txt"

echo "========================================"
echo "CMAM Tracker Setup - $(date)"
echo "========================================"

# Step 1: Find Python 3.12
echo ""
echo "=== Step 1: Finding Python 3.12 ==="
PYTHON=""
for p in /opt/alt/python312/bin/python3 /usr/bin/python3.12 /usr/local/bin/python3.12 /usr/bin/python3 /opt/alt/python311/bin/python3 /usr/bin/python3.11; do
    if [ -x "$p" ]; then
        echo "Found: $p ($($p --version 2>&1))"
        PYTHON="$p"
        break
    fi
done

if [ -z "$PYTHON" ]; then
    echo "ERROR: No Python 3 found! Available Python versions:"
    ls -la /opt/alt/python*/bin/python3 2>/dev/null
    ls -la /usr/bin/python3* 2>/dev/null
    which python3 2>/dev/null
    echo "Cannot continue without Python 3."
    exit 1
fi

echo "Using Python: $PYTHON"

# Step 2: Create virtual environment
echo ""
echo "=== Step 2: Creating virtual environment ==="
if [ -d "$VENV_DIR" ]; then
    echo "Removing old venv..."
    rm -rf "$VENV_DIR"
fi
$PYTHON -m venv "$VENV_DIR"
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create venv. Trying with --without-pip..."
    $PYTHON -m venv --without-pip "$VENV_DIR"
    curl -sS https://bootstrap.pypa.io/get-pip.py | "$VENV_DIR/bin/python3"
fi
echo "Venv created at: $VENV_DIR"

# Step 3: Activate and install dependencies
echo ""
echo "=== Step 3: Installing dependencies ==="
source "$VENV_DIR/bin/activate"
echo "Python in venv: $(which python)"
echo "Python version: $(python --version)"

pip install --upgrade pip
pip install -r "$APP_DIR/requirements.txt"

if [ $? -ne 0 ]; then
    echo "WARNING: Some packages may have failed. Trying without mysqlclient..."
    pip install Django==5.0.1 djangorestframework==3.14.0 django-cors-headers==4.3.1 python-decouple==3.8 Pillow==10.2.0 gunicorn==21.2.0 whitenoise==6.6.0 djangorestframework-simplejwt==5.3.1 django-filter==23.5 pytz==2024.1 django-ratelimit==4.1.0 openpyxl==3.1.2
    pip install mysqlclient==2.2.1 || pip install PyMySQL
fi

echo "Installed packages:"
pip list

# Step 4: Run Django migrations
echo ""
echo "=== Step 4: Running migrations ==="
cd "$APP_DIR"
python manage.py migrate 2>&1

# Step 5: Collect static files
echo ""
echo "=== Step 5: Collecting static files ==="
python manage.py collectstatic --noinput 2>&1

# Step 6: Create superuser
echo ""
echo "=== Step 6: Creating superuser ==="
python manage.py shell -c "
from apps.users.models import User
import os
if not User.objects.filter(username='admin').exists():
    pw = os.environ.get('ADMIN_PASSWORD', 'Admin@Nutri2026!')
    User.objects.create_superuser(username='admin', email='admin@nutri.pharn.org', password=pw, role='admin')
    print('SUCCESS: Superuser created (admin)')
else:
    print('Superuser already exists')
" 2>&1

# Step 7: Print important paths
echo ""
echo "========================================"
echo "SETUP COMPLETE!"
echo "========================================"
echo ""
echo "IMPORTANT PATHS (save these):"
echo "  Python:     $VENV_DIR/bin/python"
echo "  Venv:       $VENV_DIR"
echo "  App Dir:    $APP_DIR"
echo ""
echo "Update passenger_wsgi.py line with:"
echo "  INTERP = \"$VENV_DIR/bin/python\""
echo ""
echo "Update .htaccess PassengerPython line with:"
echo "  PassengerPython $VENV_DIR/bin/python"
echo ""
echo "Done at $(date)"
