# Testing Guide - Data Loss Fix Verification

## 🚀 Applications Running

### ✅ Django Backend
- **URL**: http://127.0.0.1:8000
- **Status**: Running
- **Migration**: ✅ Applied (0006_add_clinical_fields)
- **API Endpoint**: http://127.0.0.1:8000/api/v1/

### ✅ Mobile App (Expo)
- **Status**: Starting (Metro bundler rebuilding cache)
- **Port**: 8084
- **Once ready**: Scan QR code with Expo Go app or press 'w' for web

---

## 🧪 Test Plan

### Test 1: Verify Database Schema ✅ COMPLETED

The migration has been successfully applied. All 70+ new fields are now in the database.

**Fields Added:**
- ✅ 56 new clinical fields
- ✅ 3 z-score fields changed from Decimal to CharField

---

### Test 2: Test Webapp Form Submission

#### Steps:
1. **Open Django Admin/Webapp**
   - Navigate to: http://127.0.0.1:8000
   - Login with your credentials

2. **Create a New SAM Case**
   - Go to Cases → Create New Case
   - Select "SAM" tab
   - Fill in ALL sections:
     - ✅ Basic Information (name, DOB, gender, etc.)
     - ✅ Anthropometry (weight, height, MUAC, z-scores)
     - ✅ Medical History (diarrhoea, vomiting, cough, etc.)
     - ✅ Physical Examination (respiratory rate, temperature, eyes, etc.)
     - ✅ Routine Medicines (amoxicillin, vitamin A, folic acid, etc.)
     - ✅ RUTF Ration (sachets given, ration per day)
     - ✅ Other Medicines (up to 3 custom drugs)
     - ✅ Additional Notes

3. **Submit the Form**
   - Click "Register SAM Case"
   - Note the registration number

4. **Verify Data Saved**
   - Go to the case detail page
   - Check that ALL fields are displayed
   - Or use Django shell:
   ```python
   from apps.cases.models import OpcRegistration
   case = OpcRegistration.objects.latest('id')
   
   # Check new fields
   print(f"Father Alive: {case.father_alive}")
   print(f"Diarrhoea: {case.diarrhoea}")
   print(f"Respiratory Rate: {case.respiratory_rate}")
   print(f"Amoxicillin Date: {case.amoxicillin_date}")
   print(f"RUTF Sachets: {case.rutf_sachets_given}")
   print(f"Additional Notes: {case.additional_notes}")
   ```

#### Expected Result:
✅ All fields should be saved and retrievable from database

---

### Test 3: Test Mobile App Form Submission

#### Steps:
1. **Open Mobile App**
   - Once Metro bundler is ready, scan QR code with Expo Go
   - Or press 'w' to open in web browser
   - Or press 'a' for Android emulator
   - Or press 'i' for iOS simulator

2. **Login**
   - Use your credentials
   - API should connect to: http://127.0.0.1:8000/api/v1/ (or production)

3. **Register a New SAM Case**
   - Tap "Cases" tab
   - Tap the "+" button (Register New Case)
   - Select "SAM"
   - Fill ALL 8 steps:
     - **Step 0**: Child Info & Photo
     - **Step 1**: Location
     - **Step 2**: Anthropometry (weight, height, MUAC, z-scores)
     - **Step 3**: Medical History (diarrhoea, vomiting, breastfeeding, etc.)
     - **Step 4**: Physical Examination (respiratory rate, temperature, eyes, etc.)
     - **Step 5**: Routine Medicines (amoxicillin, vitamin A, folic acid, etc.)
     - **Step 6**: RUTF Ration & Other Medicines
     - **Step 7**: Additional Notes

4. **Submit the Form**
   - Tap "Submit" on final step
   - Wait for success message

5. **Verify Data Saved**
   - View the case details in mobile app
   - Or check in Django admin
   - Or use API:
   ```bash
   curl http://127.0.0.1:8000/api/v1/cases/{case_id}/ \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

#### Expected Result:
✅ All 70+ fields should be saved
✅ No data loss
✅ Case detail shows complete information

---

### Test 4: Test API Response

#### Test via cURL:

```bash
# Get auth token first
curl -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'

# Create a case with comprehensive data
curl -X POST http://127.0.0.1:8000/api/v1/cases/create/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "child_name": "Test Child API",
    "child_gender": "Male",
    "date_of_birth": "2024-01-15",
    "age_months": 29,
    "malnutrition_type": "SAM",
    "admission_date": "2026-06-18",
    "weight_kg": 8.5,
    "height_cm": 75.0,
    "muac_cm": 11.0,
    "facility_id": 1,
    "father_alive": "Yes",
    "mother_alive": "Yes",
    "diarrhoea": "No",
    "vomiting": "No",
    "cough": "Yes",
    "respiratory_rate": "30-39",
    "temperature_celsius": 37.2,
    "amoxicillin_date": "2026-06-18",
    "amoxicillin_dosage": "250mg",
    "vitamin_a_date": "2026-06-18",
    "vitamin_a_dosage": "100,000 IU",
    "rutf_sachets_given": 14,
    "rutf_ration_per_day": 2,
    "additional_notes": "Test case for data loss fix verification"
  }'
```

#### Expected Result:
✅ API returns success with case ID
✅ All submitted fields are saved
✅ Response includes all new fields

---

### Test 5: Verify Z-Score Handling

#### Test Categorical Z-Scores (from mobile):
```json
{
  "z_score_wfh": "< -3 SD",
  "z_score_wfa": "-3 to < -2 SD",
  "z_score_hfa": "-2 to +1 SD"
}
```

#### Test Numeric Z-Scores (from webapp):
```json
{
  "z_score_wfh": "-3.5",
  "z_score_wfa": "-2.8",
  "z_score_hfa": "-1.2"
}
```

#### Expected Result:
✅ Both formats should be accepted and saved
✅ No database errors
✅ Values retrieved correctly

---

## 📊 Verification Checklist

After testing, verify:

- [ ] Django backend is running on port 8000
- [ ] Mobile app Metro bundler is ready
- [ ] Migration 0006_add_clinical_fields applied successfully
- [ ] Webapp SAM form saves all fields
- [ ] Mobile app SAM form saves all fields
- [ ] API accepts and saves all 70+ fields
- [ ] Z-score fields accept both categorical and numeric values
- [ ] No console errors in mobile app
- [ ] No Django errors in backend logs
- [ ] Case detail pages show all new fields
- [ ] Existing cases still work correctly

---

## 🐛 Troubleshooting

### Issue: Django server not responding
**Solution**: Check if port 8000 is in use. Stop and restart:
```bash
# Stop
Ctrl+C in the terminal

# Restart
cd c:\wamp64\www\cmam\cmam-tracker-django
python manage.py runserver
```

### Issue: Mobile app won't connect to API
**Solution**: 
1. Check API URL in `lib/config.ts`
2. If using physical device, use your local IP instead of localhost
3. Update `LOCAL_IP` in config file

### Issue: Form fields not saving
**Solution**:
1. Check Django logs for errors
2. Verify migration was applied: `python manage.py showmigrations cases`
3. Check field names match between form and model

### Issue: Z-score errors
**Solution**: 
- Z-scores are now CharField, both "< -3 SD" and "-3.5" are valid
- Check that mobile app sends z-scores as strings

---

## 📈 Success Criteria

### Before Fix:
- ❌ Only 20/70 fields saved
- ❌ ~70% data loss
- ❌ Missing clinical information

### After Fix (Expected):
- ✅ All 70/70 fields saved
- ✅ 0% data loss
- ✅ Complete clinical records

---

## 🎯 Next Steps After Testing

1. **If tests pass**:
   - ✅ Deploy to staging environment
   - ✅ Run same tests on staging
   - ✅ Deploy to production
   - ✅ Monitor for issues

2. **If tests fail**:
   - Check error logs
   - Verify migration applied correctly
   - Review field mappings
   - Check API payload structure

---

## 📞 Quick Commands

### Check Django Server Status:
```bash
curl http://127.0.0.1:8000/api/v1/system/health/
```

### Check Database Schema:
```bash
cd c:\wamp64\www\cmam\cmam-tracker-django
python manage.py dbshell
# Then: \d opc_registrations (PostgreSQL) or .schema opc_registrations (SQLite)
```

### View Recent Cases:
```bash
python manage.py shell
from apps.cases.models import OpcRegistration
OpcRegistration.objects.all().order_by('-id')[:5]
```

### Check Migration Status:
```bash
python manage.py showmigrations cases
```

---

**Testing Status**: ⚠️ Ready to Test
**Applications**: ✅ Running
**Migration**: ✅ Applied
**Documentation**: ✅ Complete

Start testing with the webapp first, then move to mobile app!
