import sys
import os
import traceback

APP_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_DIR = os.path.join(APP_DIR, 'venv')

# Activate virtual environment
activate_this = os.path.join(VENV_DIR, 'bin', 'activate_this.py')
if os.path.exists(activate_this):
    exec(open(activate_this).read(), {'__file__': activate_this})
else:
    # Manually add venv site-packages to path (check both lib and lib64)
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}"
    for lib_dir in ['lib64', 'lib']:
        site_packages = os.path.join(VENV_DIR, lib_dir, f'python{python_version}', 'site-packages')
        if os.path.exists(site_packages) and site_packages not in sys.path:
            sys.path.insert(0, site_packages)
            break

if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

# Ensure working directory is the app directory (for python-decouple .env loading)
os.chdir(APP_DIR)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

try:
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
except Exception:
    error_html = """<html><body style="font-family:monospace;background:#1a1a1a;color:#f00;padding:20px">
    <h2>Django Startup Error</h2><pre style="color:#ff9;background:#111;padding:15px">{}</pre>
    <h3 style="color:#aaa">Python: {}</h3>
    <h3 style="color:#aaa">sys.path: {}</h3>
    <h3 style="color:#aaa">ENV vars present: SECRET_KEY={}, DB_NAME={}</h3>
    </body></html>""".format(
        traceback.format_exc(),
        sys.version,
        "<br>".join(sys.path),
        bool(os.environ.get('SECRET_KEY')),
        os.environ.get('DB_NAME', 'NOT SET')
    )
    def application(environ, start_response):
        start_response('500 Internal Server Error',
                       [('Content-Type', 'text/html; charset=utf-8')])
        return [error_html.encode('utf-8')]
