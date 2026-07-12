# CMAM Tracker — Manual Deployment to nutriapp.pharn.org (Stormerhost)

**Subdomain**: https://nutriapp.pharn.org
**File location**: `public_html/nutriapp.pharn.org`
**Database**: `pharnorg_madrasa` (user: `pharnorg_madrasa`)

> This guide **bypasses cPanel's "Setup Python App" tool** entirely and sets
> everything up manually via a Cron Job script — the same approach that
> successfully got `nutri.pharn.org` migrated, static files collected, and
> superuser created.
>
> **Known risk**: On this host, Passenger sometimes refuses to serve ANY
> Python app (even a bare "Hello World") unless it's registered through
> cPanel's Python App tool first. If you get a plain "503 Service
> Unavailable" after finishing this guide, that's the likely cause — see
> **Troubleshooting** at the bottom.

---

## Files in This Package

| File | Purpose |
|------|---------|
| `passenger_wsgi.py` | Manually activates our own `venv`, loads Django |
| `.htaccess` | Explicit Passenger config pointing at our own venv |
| `.env` | Database credentials & Django settings (already filled in) |
| `full_setup.sh` | One-time script: creates venv, installs packages, migrates, creates admin |
| `manage.py`, `requirements.txt` | Django project files |
| `apps/`, `config/`, `templates/` | Application code |

---

## Step 1 — Create the Subdomain (if not already done)

1. **cPanel → Domains** (or **Subdomains**)
2. Create subdomain `nutriapp` for domain `pharn.org`
3. Document root: `public_html/nutriapp.pharn.org`
4. Save

## Step 2 — Create the Database (if not already done)

1. **cPanel → MySQL Databases**
2. Create database: `pharnorg_madrasa`
3. Create user: `pharnorg_madrasa` / password `Aqeelah@13`
4. **Add user to database** with **ALL PRIVILEGES**

---

## Step 3 — Upload the Project Files

1. **cPanel → File Manager** → `public_html/nutriapp.pharn.org/`
2. **Upload** `nutriapp_deploy.zip`
3. **Right-click → Extract**
4. **Delete** the zip after extraction

### Verify these exist:
```
✓ passenger_wsgi.py
✓ .htaccess
✓ .env
✓ full_setup.sh
✓ manage.py
✓ requirements.txt
✓ apps/
✓ config/
✓ templates/
```

### Temporarily disable .htaccess
Rename `.htaccess` → `.htaccess_OFF` for now. The Passenger directives inside
will error until the venv actually exists.

---

## Step 4 — Run the Setup Script via Cron Job

### 4.1 Set permissions
1. Right-click `full_setup.sh` → **Change Permissions** → `755` → **Save**

### 4.2 Create a ONE-TIME Cron Job
1. **cPanel → Cron Jobs**
2. **Minute**: current minute + 2, **Hour/Day/Month/Weekday**: `*`
3. **Command**:
   ```
   bash /home/pharnorg/public_html/nutriapp.pharn.org/full_setup.sh >> /home/pharnorg/nutriapp_setup_log.txt 2>&1
   ```
4. Wait 3-5 minutes (venv creation + pip install takes time)
5. **Delete the cron job immediately after it runs** — do not leave it repeating!

### 4.3 Check the log
**File Manager → Home (`/home/pharnorg/`)** → open `nutriapp_setup_log.txt`

Look for:
```
Applying ... OK        (migrations)
X static files copied  (collectstatic)
SUCCESS: Superuser created (admin@nutriapp.pharn.org)
```

If `pip install` fails partway, re-run the cron job — the script skips venv
creation if it already exists and will retry installs.

---

## Step 5 — Re-enable .htaccess

1. **File Manager** → rename `.htaccess_OFF` → `.htaccess`

---

## Step 6 — Test the Site

Visit **https://nutriapp.pharn.org**

Log in:
- **Email**: `admin@nutriapp.pharn.org`
- **Password**: `Admin@Nutri2026!`

---

## Troubleshooting

### 503 Service Unavailable (plain Apache page, no custom error)
This means Passenger isn't even attempting to run our Python file — it
doesn't recognize the app. This happened once before on this host and was
only fixed by registering the app through **cPanel → Setup Python App**
(pointing it at this same folder/files, entry point `application`, startup
file `passenger_wsgi.py`). If you hit this:
1. Go to **cPanel → Setup Python App → CREATE APPLICATION**
2. **Application root**: `public_html/nutriapp.pharn.org`
3. Everything else (venv, code) is already in place — just let cPanel
   register the app. It may create its own separate venv; if so, update
   `.htaccess`'s `PassengerPython` line to point at whichever venv actually
   has packages installed (yours from `full_setup.sh`, or cPanel's new one
   after running "Run Pip Install").

### 500 Internal Server Error / Django Startup Error debug page
Our `passenger_wsgi.py` shows a traceback — read it. Usually:
- Missing package → re-run `full_setup.sh`
- Wrong `.env` value → check `DB_NAME`, `DB_USER`, `DB_PASSWORD`

### "FileNotFoundError: logs/django.log"
Re-run `full_setup.sh` — it creates the `logs` folder. `config/settings.py`
also auto-creates it as a safety net (`LOG_DIR.mkdir(exist_ok=True)`).

### Login fails / superuser missing
Check `nutriapp_setup_log.txt` for the exact error and re-run Step 4 if
needed.

---

## Security Reminder

1. Change the admin password immediately after first login
2. Never leave a cron job set to repeat once its one-time job is done
