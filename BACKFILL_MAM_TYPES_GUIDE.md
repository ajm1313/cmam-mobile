# Backfill MAM Types for Existing Cases

## Issue

Existing MAM cases in the database don't have the `mam_type` field populated because:
- The field was added recently
- Auto-classification only happens on new registrations or updates
- Old cases need to be backfilled

---

## Solution

Run the management command to automatically classify all existing MAM cases.

---

## Steps to Backfill

### **Option 1: Using Docker (Recommended)**

```bash
# Navigate to project directory
cd c:\wamp64\www\cmam\cmam-tracker-django

# Run dry-run first to see what will be updated
docker-compose exec web python manage.py backfill_mam_types --dry-run

# If everything looks good, run the actual backfill
docker-compose exec web python manage.py backfill_mam_types
```

### **Option 2: Direct Python (if not using Docker)**

```bash
# Navigate to project directory
cd c:\wamp64\www\cmam\cmam-tracker-django

# Activate virtual environment (if using one)
# venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Run dry-run first
python manage.py backfill_mam_types --dry-run

# Run actual backfill
python manage.py backfill_mam_types
```

---

## What the Command Does

1. **Finds all MAM cases** in the database
2. **Skips infants <6 months** (they shouldn't be MAM)
3. **Assesses aggravating factors** for each case:
   - Age under 24 months
   - Previous SAM episode
   - Failed counselling only
   - HIV/TB status
   - Poor maternal health
   - Mother deceased
   - Household vulnerability
   - Disability
4. **Classifies MAM type** based on:
   - MUAC (12.0-12.4 cm = High-risk, 11.5-11.9 cm = Other MAM)
   - WFL-H Z-score
   - Presence of aggravating factors
5. **Updates the database** with:
   - `mam_type` field (High-risk MAM or Other MAM)
   - `has_aggravating_factors` field (True/False)

---

## Expected Output

### **Dry Run Example**:
```
Found 15 MAM cases to process
  Would update FUU-MAM-2026-001: None → High-risk MAM
  Would update FUU-MAM-2026-002: None → Other MAM
  Would update FUU-MAM-2026-003: None → High-risk MAM
  Skipping FUU-MAM-2026-004 - Infant <6 months (should not be MAM)
  ...

DRY RUN: Would update 14 cases, skip 1 cases
```

### **Actual Run Example**:
```
Found 15 MAM cases to process
  Updated FUU-MAM-2026-001: None → High-risk MAM
  Updated FUU-MAM-2026-002: None → Other MAM
  Updated FUU-MAM-2026-003: None → High-risk MAM
  Skipping FUU-MAM-2026-004 - Infant <6 months (should not be MAM)
  ...

Successfully updated 14 MAM cases, skipped 1 cases
```

---

## After Running the Command

1. **Refresh the case list page** in your browser
2. **Clear browser cache** if needed (Ctrl+Shift+R or Cmd+Shift+R)
3. **You should now see**:
   - 🟠 Orange "High-risk" badges for High-risk MAM cases
   - 🔵 Blue "Other MAM" badges for Other MAM cases

---

## Verification

### **Check in Database** (optional):
```sql
-- Count MAM cases by type
SELECT mam_type, COUNT(*) 
FROM cases_opcregistration 
WHERE malnutrition_type = 'MAM' 
GROUP BY mam_type;

-- View specific cases
SELECT registration_number, child_name, mam_type, has_aggravating_factors
FROM cases_opcregistration
WHERE malnutrition_type = 'MAM'
ORDER BY registration_date DESC
LIMIT 10;
```

### **Check in Webapp**:
1. Go to `http://127.0.0.1:9246/manage/cases/`
2. Look at the Type column
3. MAM cases should now show sub-type badges

---

## Troubleshooting

### **Command not found**
```
Error: No module named 'apps.cases.mam_automation_service'
```
**Solution**: Make sure you're in the correct directory and the file exists:
```bash
ls apps/cases/mam_automation_service.py
```

### **No cases updated**
```
Found 0 MAM cases to process
```
**Solution**: Check if you have MAM cases in the database:
```bash
docker-compose exec web python manage.py shell
>>> from apps.cases.models import OpcRegistration
>>> OpcRegistration.objects.filter(malnutrition_type='MAM').count()
```

### **Still not showing on webpage**
1. **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear browser cache**
3. **Restart Django server**:
   ```bash
   docker-compose restart web
   ```
4. **Check if field was actually updated**:
   ```bash
   docker-compose exec web python manage.py shell
   >>> from apps.cases.models import OpcRegistration
   >>> case = OpcRegistration.objects.filter(malnutrition_type='MAM').first()
   >>> print(case.mam_type)  # Should show 'High-risk MAM' or 'Other MAM'
   ```

---

## Future Cases

**New MAM cases registered after this will automatically have `mam_type` populated** because:
- The signals are already in place
- The automation service runs on save
- No manual backfill needed

---

## Summary

**Quick Command**:
```bash
# Dry run first
docker-compose exec web python manage.py backfill_mam_types --dry-run

# Actual run
docker-compose exec web python manage.py backfill_mam_types

# Refresh browser
# Ctrl+Shift+R or Cmd+Shift+R
```

**Expected Result**: All MAM cases will show either "High-risk" (orange) or "Other MAM" (blue) badges on the case list page! 🎉
