# CMAM Tracker — Fresh Deployment to Stormerhost

**Server**: nutri.pharn.org  
**Hosting**: Stormerhost (cPanel shared hosting, no SSH)  
**Project path on server**: `/home/pharnorg/public_html/nutri.pharn.org/`

> **This guide bypasses the cPanel "Setup Python App" tool** (which has issues
> on this server) and sets everything up manually via a Cron Job script.

---

## Files in This Package

| File | Purpose |
|------|---------|
| `passenger_wsgi.py` | Starts Django app via Passenger (auto-detects venv) |
| `.htaccess` | Apache/Passenger config, HTTPS, security |
| `.env` | Database credentials & Django settings |
| `full_setup.sh` | Creates venv, installs packages, runs migrations |
| `manage.py` | Django management |
| `requirements.txt` | Python dependencies |
| `apps/` | Django application code |
| `config/` | Django settings & URL config |
| `templates/` | HTML templates |

---

## Step 1 — Prepare the Database (5 min)

1. **cPanel → MySQL Databases**
2. If the database `pharnorg_cmam` already exists and you want a fresh start:
   - Go to **cPanel → phpMyAdmin**
   - Select `pharnorg_cmam`
   - Click **Operations** tab → **Drop the database**
3. Create the database:
   - Database name: `pharnorg_cmam`
4. Create the user (if not already created):
   - Username: `pharnorg_cmamuser`
   - Password: `AQeeiaN@13`
5. Add user to database:
   - Select `pharnorg_cmamuser` → `pharnorg_cmam`
   - Grant **ALL PRIVILEGES**
   - Click **Make Changes**

---

## Step 2 — Upload the ZIP Package (10 min)

### 2.1 Upload cmam_tracker_v2.zip

1. **cPanel → File Manager** → Navigate to `public_html/nutri.pharn.org/`
2. Click **Upload**
3. Upload `cmam_tracker_v2.zip` from `C:\wamp64\www\cmam\deploy\`
4. After upload completes, **right-click** on `cmam_tracker_v2.zip`
5. Click **Extract**
6. Extract to current directory (this will overwrite existing files)
7. **Delete** `cmam_tracker_v2.zip` after extraction (to save space)

### 2.2 Verify key files exist

After extracting, confirm these files are in `public_html/nutri.pharn.org/`:

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

### 2.3 Temporarily rename .htaccess

**IMPORTANT**: Rename `.htaccess` to `.htaccess_OFF` for now.
Passenger directives in `.htaccess` will cause errors until the venv is created.

1. Right-click `.htaccess` → **Rename** → `.htaccess_OFF`

---

## Step 3 — Run the Setup Script via Cron Job (10 min)

We skip cPanel's Python App tool and create the virtual environment ourselves.

### 3.1 Set script permissions

1. **File Manager** → find `full_setup.sh` in `public_html/nutri.pharn.org/`
2. Right-click → **Change Permissions**
3. Set to **755** (check all Execute boxes)
4. Click **Save**

### 3.2 Create a Cron Job to run the script

1. **cPanel → Cron Jobs**
2. Under "Add New Cron Job":
   - Common Settings: select **Once Per Minute**
   - Command:
     ```
     bash /home/pharnorg/public_html/nutri.pharn.org/full_setup.sh >> /home/pharnorg/setup_log.txt 2>&1
     ```
3. Click **Add New Cron Job**
4. **Wait 2–3 minutes** for it to run

### 3.3 Check the setup log

1. **File Manager** → Navigate to `/home/pharnorg/`
2. Find `setup_log.txt`
3. Right-click → **View** or **Edit**
4. Look for these success markers:
   ```
   === Step 1: Finding Python 3.12 ===
   Found: /opt/alt/python312/bin/python3 (Python 3.12.x)
   ...
   === Step 3: Installing dependencies ===
   Successfully installed Django-5.0.1 ...
   ...
   === Step 4: Running migrations ===
   Applying cases.0001_initial... OK
   ...
   === Step 6: Creating superuser ===
   SUCCESS: Superuser created (admin)
   ...
   SETUP COMPLETE!
   ```
5. **If you see errors**, copy the log content and share it with me

### 3.4 Delete the Cron Job

1. **cPanel → Cron Jobs**
2. **Delete** the cron job (it was one-time only)

---

## Step 4 — Enable the Application (2 min)

### 4.1 Restore .htaccess

1. **File Manager** → `public_html/nutri.pharn.org/`
2. Right-click `.htaccess_OFF` → **Rename** → `.htaccess`

### 4.2 Verify venv was created

1. In File Manager, check that `public_html/nutri.pharn.org/venv/` folder exists
2. It should contain `bin/`, `lib/`, etc.

---

## Step 5 — Test the Application (5 min)

### 5.1 Open the website

1. Visit: **https://nutri.pharn.org**
2. You should see the login page

### 5.3 Log in

```
Username: admin
Password: Admin@Nutri2026!
```

(Or whatever you set in `.env` as `ADMIN_PASSWORD`)

### 5.4 Verify functionality

- [ ] Login page loads
- [ ] Can log in as admin
- [ ] Dashboard shows
- [ ] Can navigate to Cases, Reports
- [ ] Admin panel works: https://nutri.pharn.org/admin/

---

## Step 6 — Post-Setup Security (5 min)

1. **Delete `setup.sh`** from the server (it contains sensitive info)
2. **Delete `setup_log.txt`** from `/home/pharnorg/`
3. **Change your admin password** via the admin panel
4. **Generate a proper SECRET_KEY**:
   - Visit https://djecrety.ir/
   - Copy the key
   - Edit `.env` → replace the `SECRET_KEY` value
   - Restart the app

---

## Troubleshooting

### "No such application" error when creating Python app
- Make sure Application root is: **`public_html/nutri.pharn.org`** (with `public_html/` prefix)
- Delete all folders in `/home/pharnorg/virtualenv/` first
- Refresh the page and try again

### "502 Bad Gateway" or blank page
- Check `setup_log.txt` for errors
- Most common: pip install failed → re-run the cron job
- Check `.env` file has correct database credentials

### "Internal Server Error"
- Visit the URL — the error page will show debug info (Python version, sys.path, etc.)
- Usually means Django can't start: missing package or wrong DB credentials
- Check `setup_log.txt` for migration errors

### Static files not loading (page looks unstyled)
- Re-run: `python manage.py collectstatic --noinput` (add to cron job)
- Check that `staticfiles/` folder exists and has files

### Can't log in
- Verify superuser was created (check `setup_log.txt`)
- Try resetting via cron: `python manage.py changepassword admin`

---

## Server Details Reference

| Item | Value |
|------|-------|
| Domain | nutri.pharn.org |
| cPanel user | pharnorg |
| Home directory | /home/pharnorg |
| App directory | /home/pharnorg/public_html/nutri.pharn.org |
| Database | pharnorg_cmam |
| DB User | pharnorg_cmamuser |
| DB Password | AQeeiaN@13 |
| Python | 3.12.13 |
| Admin user | admin |
| Admin password | Admin@Nutri2026! (change after setup!) |
