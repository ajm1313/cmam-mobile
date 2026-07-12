import sys
import os

def application(environ, start_response):
    """Minimal WSGI app - if you see this, Passenger works!"""
    output = f"""<html><body>
    <h1>Passenger Works!</h1>
    <p><b>Python:</b> {sys.version}</p>
    <p><b>Working Dir:</b> {os.getcwd()}</p>
    <p><b>Script:</b> {os.path.abspath(__file__)}</p>
    <p><b>sys.path:</b><br>{'<br>'.join(sys.path)}</p>
    <h2>Checking venv...</h2>
    <p><b>venv/bin/python exists:</b> {os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'venv', 'bin', 'python'))}</p>
    <p><b>venv/lib64 exists:</b> {os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'venv', 'lib64'))}</p>
    <p><b>.env exists:</b> {os.path.exists(os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env'))}</p>
    </body></html>"""
    
    start_response('200 OK', [('Content-Type', 'text/html')])
    return [output.encode('utf-8')]
