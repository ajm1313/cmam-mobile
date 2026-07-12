#!/bin/bash
# =============================================================
# CMAM Tracker - One-time Setup Script
# Run via: cPanel → Cron Jobs (then delete the cron job after)
# =============================================================

# IMPORTANT: Update this path after creating the Python app in cPanel.
# cPanel will show you the virtualenv activation command — copy it here.
# Example: source /home/pharnorg/virtualenv/public_html_nutri.pharn.org/3.12/bin/activate
source /home/pharnorg/virtualenv/public_html_nutri.pharn.org/3.12/bin/activate

cd /home/pharnorg/public_html/nutri.pharn.org

echo "=== Installing dependencies ==="
pip install -r requirements.txt 2>&1

echo "=== Running database migrations ==="
python manage.py migrate 2>&1

echo "=== Collecting static files ==="
python manage.py collectstatic --noinput 2>&1

echo "=== Creating superuser ==="
python manage.py shell -c "
from apps.users.models import User
import os
if not User.objects.filter(username='admin').exists():
    password = os.environ.get('ADMIN_PASSWORD', 'Admin@Nutri2026!')
    User.objects.create_superuser(username='admin', email='admin@nutri.pharn.org', password=password, role='admin')
    print('Superuser created: admin')
else:
    print('Superuser already exists')
" 2>&1

echo "=== Setup complete! ==="
echo "Now delete this cron job in cPanel."
