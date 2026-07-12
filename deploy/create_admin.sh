#!/bin/bash
# Create superuser only (migrations already done)
APP_DIR="/home/pharnorg/public_html/nutri.pharn.org"
VENV_DIR="$APP_DIR/venv"

echo "=== Creating superuser - $(date) ==="
source "$VENV_DIR/bin/activate"
cd "$APP_DIR"

python manage.py shell -c "
from apps.users.models import User
import os
if not User.objects.filter(email='admin@nutri.pharn.org').exists():
    pw = os.environ.get('ADMIN_PASSWORD', 'Admin@Nutri2026!')
    User.objects.create_superuser(email='admin@nutri.pharn.org', password=pw, name='Admin')
    print('SUCCESS: Superuser created (admin@nutri.pharn.org / password from ADMIN_PASSWORD env)')
else:
    print('Superuser already exists')
" 2>&1

echo "=== Done at $(date) ==="
