#!/bin/bash
# Drops ALL tables in the database, then runs migrate + collectstatic + superuser.
# Use this when the database already has leftover tables from another app.

APP_DIR="/home/pharnorg/public_html/nutriapp.pharn.org"
VENV_DIR="$APP_DIR/venv"
PYTHON="$VENV_DIR/bin/python"

echo "=========================================="
echo "RESET DB & MIGRATE - $(date)"
echo "=========================================="

cd "$APP_DIR"

echo ""
echo "=== Dropping all existing tables ==="
$PYTHON manage.py shell -c "
from django.db import connection
cursor = connection.cursor()
cursor.execute('SET FOREIGN_KEY_CHECKS=0')
cursor.execute('SHOW TABLES')
tables = cursor.fetchall()
if not tables:
    print('No tables found - database is already empty')
for t in tables:
    print('Dropping table:', t[0])
    cursor.execute('DROP TABLE IF EXISTS \`{}\`'.format(t[0]))
cursor.execute('SET FOREIGN_KEY_CHECKS=1')
print('DONE: all tables dropped')
" 2>&1

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
