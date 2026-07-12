# CMAM Tracker - Form Logic Deep Dive Analysis

## Executive Summary

After conducting a comprehensive analysis of form logic in both the webapp (Django templates) and mobile app (React Native), I've identified **several critical inconsistencies and issues** that need to be addressed for data integrity and user experience.

---

## 🔴 CRITICAL ISSUES FOUND

### 1. **Field Name Mismatches Between Frontend and Backend**

#### Issue: Gender Field Naming Inconsistency
- **Webapp Form**: Uses `name="gender"` 
- **Mobile App**: Uses `child_gender`
- **Backend API**: Expects `child_gender`
- **Database Model**: Field is `child_gender`

**Location:**
- `@c:\wamp64\www\cmam\cmam-tracker-django\templates\cases\partials\sam_form.html:46`
```html
<select name="gender" id="sam_reg_gender" required>
```

**Impact:** ⚠️ **HIGH** - Webapp form submissions will fail or lose gender data because the backend expects `child_gender`, not `gender`.

**Fix Required:**
```html
<!-- Change from -->
<select name="gender" ...>
<!-- To -->
<select name="child_gender" ...>
```

---

#### Issue: Age Field Naming Inconsistency
- **Webapp Form**: Uses `name="child_age_months"`
- **Mobile App**: Uses `age_months`
- **Backend API**: Expects `age_months`
- **Database Model**: Field is `age_months`

**Location:**
- `@c:\wamp64\www\cmam\cmam-tracker-django\templates\cases\partials\sam_form.html:42`
```html
<input type="number" name="child_age_months" id="sam_age_months" ...>
```

**Impact:** ⚠️ **HIGH** - Webapp submissions may fail validation or lose age data.

**Fix Required:**
```html
<!-- Change from -->
<input type="number" name="child_age_months" ...>
<!-- To -->
<input type="number" name="age_months" ...>
```

---

### 2. **Missing Field Mappings in Backend API**

#### Issue: Additional Fields Not Saved
The mobile app collects extensive data that the backend API **does not save**:

**Fields collected by mobile but NOT saved by backend:**
- `father_alive`
- `mother_alive`
- `house_location`
- `travel_time`
- `referral_source` (collected but mapped to wrong field)
- `diarrhoea`, `stool_frequency`, `vomiting`, `cough`, `passing_urine`
- `oedema_duration_days`
- `breastfeeding_status`, `breastfeeding_prospect`
- `immunization_status`, `g6pd_status`
- `additional_medical_history`
- All physical examination fields (respiratory_rate, temperature, etc.)
- All medicine fields (amoxicillin, vitamin_a, folic_acid, etc.)
- `rutf_sachets_given`, `rutf_ration_per_day`, `next_visit_date`
- `other_drug_1`, `other_drug_2`, `other_drug_3` and their dates/dosages
- `additional_notes`

**Location:** `@c:\wamp64\www\cmam\cmam-tracker-django\apps\api\views.py:338-369`

**Impact:** ⚠️ **CRITICAL** - **Data loss**. Users spend time filling comprehensive forms on mobile, but most clinical data is silently discarded.

---

### 3. **Database Schema Limitations**

#### Issue: OpcRegistration Model Missing Fields
The `OpcRegistration` model only has basic fields and cannot store the comprehensive clinical data collected by forms.

**Current Model Fields** (`@c:\wamp64\www\cmam\cmam-tracker-django\apps\cases\models.py:37-111`):
- Basic demographics (name, gender, DOB, age)
- Caregiver info (name, phone, relationship)
- Anthropometry (weight, height, MUAC, z-scores, oedema)
- Minimal clinical (appetite_test, medical_complications)
- Location (lat/long)
- Photo

**Missing from Model:**
- Medical history fields (diarrhoea, vomiting, cough, etc.)
- Physical examination findings
- Routine medicines at enrollment
- RUTF ration details
- Detailed notes

**Impact:** ⚠️ **CRITICAL** - Even if API is fixed, database cannot store the data. **Schema migration required**.

---

### 4. **Z-Score Data Type Inconsistencies**

#### Issue: String vs Decimal Confusion
- **Mobile App**: Sends z-scores as **strings** (e.g., "< -3 SD", "-3 to < -2 SD")
- **Database Model**: Expects **decimal numbers** (`DecimalField`)
- **Backend API**: Accepts whatever is sent (no validation)

**Locations:**
- Mobile: `@c:\wamp64\www\cmam\cmam_tracker_mobile\app\case\register.tsx:316-321`
```typescript
const WFH_Z = ['< -3 SD','-3 to < -2 SD','-2 to +1 SD','> +1 to +2 SD','> +2 SD'];
```
- Model: `@c:\wamp64\www\cmam\cmam-tracker-django\apps\cases\models.py:96-98`
```python
z_score_wfh = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
```

**Impact:** ⚠️ **HIGH** - Database errors or data corruption. Strings like "< -3 SD" cannot be stored in DecimalField.

**Fix Options:**
1. **Change mobile to send numeric values** (e.g., -3.5)
2. **Change database to CharField** to store ranges
3. **Add separate fields** for both numeric and categorical z-scores

---

### 5. **Validation Logic Inconsistencies**

#### Issue: Different Required Fields
**Webapp SAM Form Required Fields:**
- facility_id ✓
- admission_date ✓
- child_name ✓
- date_of_birth ✓
- child_age_months ✓
- gender ✓
- community ✓
- caregiver_name ✓
- referral_source ✓
- weight_kg ✓
- height_cm ✓
- muac_cm ✓

**Mobile App Required Fields** (`@c:\wamp64\www\cmam\cmam_tracker_mobile\app\case\register.tsx:152-160`):
- child_name ✓
- child_gender ✓
- date_of_birth ✓
- weight_kg ✓
- height_cm ✓
- facility_id ✓
- admission_date ✓

**Backend API Required Fields** (`@c:\wamp64\www\cmam\cmam-tracker-django\apps\api\views.py:322-323`):
- child_name ✓
- child_gender ✓
- date_of_birth ✓
- age_months ✓
- malnutrition_type ✓
- admission_date ✓
- weight_kg ✓
- height_cm ✓
- facility_id ✓

**Impact:** ⚠️ **MEDIUM** - Inconsistent user experience. Mobile allows submission without MUAC (required for SAM diagnosis), webapp requires it.

---

### 6. **Age Calculation Logic Differences**

#### Webapp Logic (`sam_form.html:641-658`):
```javascript
function samDobToAge() {
    const dob = document.getElementById('sam_dob').value;
    if (!dob) return;
    const dobDate = new Date(dob);
    const now = new Date();
    let months = (now.getFullYear() - dobDate.getFullYear()) * 12;
    months += now.getMonth() - dobDate.getMonth();
    if (now.getDate() < dobDate.getDate()) months--;
    document.getElementById('sam_age_months').value = months >= 0 ? months : 0;
}
```

#### Mobile Logic (`register.tsx:119-126`):
```typescript
useEffect(() => {
  if (f.date_of_birth && /^\d{4}-\d{2}-\d{2}$/.test(f.date_of_birth)) {
    const dob = new Date(f.date_of_birth); const now = new Date();
    let months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
    if (now.getDate() < dob.getDate()) months--;
    if (months >= 0 && months < 120) s('age_months', String(months));
  }
}, [f.date_of_birth, s]);
```

**Differences:**
1. Mobile has upper limit check (< 120 months)
2. Mobile validates date format with regex
3. Both use same calculation logic ✓

**Impact:** ⚠️ **LOW** - Minor inconsistency, but logic is functionally equivalent.

---

### 7. **Photo Upload Handling**

#### Webapp:
```html
<input type="file" name="child_photo" accept="image/jpeg,image/png,image/gif" ...>
```
- Uses standard HTML file input
- Sent as multipart/form-data
- Backend expects `child_photo` field

#### Mobile:
```typescript
if (childPhoto) {
  const fd = new FormData();
  fd.append('child_photo', { 
    uri: childPhoto.uri, 
    name: 'child_photo.jpg', 
    type: childPhoto.mimeType || 'image/jpeg' 
  } as any);
  res = await api.post('/v1/cases/create/', fd, { 
    headers: { 'Content-Type': 'multipart/form-data' } 
  });
}
```

**Issue:** Mobile sends photo with hardcoded name `'child_photo.jpg'` regardless of actual filename.

**Impact:** ⚠️ **LOW** - All photos have same name, but backend should handle this. Minor issue.

---

### 8. **Missing Conditional Logic**

#### Issue: Breastfeeding Prospect Field
**Mobile App** (`register.tsx:345-348`):
```typescript
{f.breastfeeding_status === 'Yes' && (
  <><Lbl text="Prospect of Breastfeeding" c={colors} />
  <Chips opts={BF_PROSPECT} val={f.breastfeeding_prospect} .../></>
)}
```
Shows "Prospect of Breastfeeding" **only if** breastfeeding status is "Yes" ✓

**Webapp** (`sam_form.html:312-318`):
```html
<div>
  <label>If Yes, Prospect of Breastfeeding</label>
  <select name="breastfeeding_prospect" ...>
```
Always shows the field, relies on label text "If Yes" ✗

**Impact:** ⚠️ **LOW** - UX inconsistency. Mobile has better conditional display.

---

### 9. **Enrolment Criteria Field Mapping**

#### Issue: Different Field Names
- **Webapp**: `name="enrolment_criteria"`
- **Mobile**: Sends as `enrolment_criteria` but backend maps to `admission_criteria`
- **Database**: Field is `admission_criteria`

**Backend Mapping** (`views.py:351`):
```python
admission_criteria=data.get('admission_criteria', ''),
```

**Mobile Payload** (`register.tsx:176`):
```typescript
if (f.enrolment_criteria) payload.admission_criteria = f.enrolment_criteria;
```

**Impact:** ⚠️ **LOW** - Mobile correctly maps the field, but naming is confusing.

---

## 📊 DATA FLOW COMPARISON

### Case Registration Flow

#### Webapp Flow:
```
User fills SAM form
  ↓
Submit (POST) → Django view
  ↓
Django view processes form data
  ↓
Creates OpcRegistration object
  ↓
Saves to database
```

#### Mobile Flow:
```
User fills SAM form (9 steps)
  ↓
Submit → API POST /v1/cases/create/
  ↓
API validates required fields only
  ↓
Creates OpcRegistration with limited fields
  ↓
**LOSES most clinical data**
  ↓
Saves to database
```

---

## 🔧 RECOMMENDED FIXES

### Priority 1: CRITICAL (Data Loss Prevention)

1. **Fix Field Name Mismatches**
   - Change webapp `gender` → `child_gender`
   - Change webapp `child_age_months` → `age_months`

2. **Expand Database Schema**
   - Add migration to include all clinical fields
   - Create separate tables for:
     - `EnrollmentMedicalHistory`
     - `EnrollmentPhysicalExam`
     - `EnrollmentMedicines`
     - `EnrollmentRUTF`

3. **Update Backend API**
   - Modify `case_create_api` to save all fields
   - Add proper validation for all fields
   - Handle z-score data type conversion

### Priority 2: HIGH (Data Integrity)

4. **Standardize Z-Score Handling**
   - Decision needed: Store as numeric or categorical?
   - If numeric: Mobile needs to send actual numbers
   - If categorical: Database needs CharField

5. **Add Comprehensive Validation**
   - Ensure MUAC is required for SAM cases
   - Validate age ranges (6-59 months for SAM/MAM)
   - Validate z-score values

### Priority 3: MEDIUM (UX Consistency)

6. **Standardize Required Fields**
   - Align webapp, mobile, and API requirements
   - Update validation messages

7. **Improve Conditional Logic**
   - Add JavaScript to webapp for conditional fields
   - Match mobile's conditional display logic

### Priority 4: LOW (Polish)

8. **Minor Improvements**
   - Fix photo filename handling
   - Standardize field naming conventions
   - Add better error messages

---

## 📝 DETAILED FIELD MAPPING TABLE

| Field Name | Webapp Form | Mobile App | Backend API | Database Model | Status |
|------------|-------------|------------|-------------|----------------|--------|
| `facility_id` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `child_name` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `gender` / `child_gender` | `gender` ❌ | `child_gender` ✓ | `child_gender` ✓ | `child_gender` ✓ | 🔴 **MISMATCH** |
| `child_age_months` / `age_months` | `child_age_months` ❌ | `age_months` ✓ | `age_months` ✓ | `age_months` ✓ | 🔴 **MISMATCH** |
| `date_of_birth` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `admission_date` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `weight_kg` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `height_cm` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `muac_cm` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `caregiver_name` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `caregiver_phone` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `caregiver_relationship` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `community` / `address` | `community` | `community` | `address` | `address` | ⚠️ **MAPPED** |
| `oedema` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `z_score_wfh` | ✓ | ✓ (string) | ✓ | ✓ (decimal) | 🔴 **TYPE MISMATCH** |
| `z_score_wfa` | ✓ | ✓ (string) | ✓ | ✓ (decimal) | 🔴 **TYPE MISMATCH** |
| `z_score_hfa` | ✓ | ✓ (string) | ✓ | ✓ (decimal) | 🔴 **TYPE MISMATCH** |
| `appetite_test` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `registration_latitude` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `registration_longitude` | ✓ | ✓ | ✓ | ✓ | ✅ OK |
| `child_photo` | ✓ | ✓ | ✗ (not handled) | ✓ | ⚠️ **PARTIAL** |
| `father_alive` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `mother_alive` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `house_location` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `travel_time` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `diarrhoea` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `stool_frequency` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `vomiting` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `cough` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `passing_urine` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `oedema_duration_days` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `breastfeeding_status` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `breastfeeding_prospect` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `immunization_status` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `g6pd_status` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `respiratory_rate` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `temperature_celsius` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `chest_indrawing` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `eyes_condition` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `conjunctiva` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `ears_condition` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `mouth_condition` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `lymph_nodes` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `hands_feet` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `skin_changes` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `disability` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `disability_details` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `amoxicillin_date` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `amoxicillin_dosage` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `vitamin_a_date` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `vitamin_a_dosage` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `folic_acid_date` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `folic_acid_dosage` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `deworming_date` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `deworming_dosage` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `measles_vaccine_date` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `measles_vaccine_dosage` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `malaria_test_date` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `malaria_test_result` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `antimalarial_date` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `antimalarial_dosage` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `rutf_sachets_given` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `rutf_ration_per_day` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `next_visit_date` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `other_drug_1/2/3` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |
| `additional_notes` | ✓ | ✓ | ✗ | ✗ | 🔴 **NOT SAVED** |

**Summary:**
- ✅ **OK**: 20 fields
- ⚠️ **MAPPED/PARTIAL**: 3 fields
- 🔴 **CRITICAL ISSUES**: 50+ fields **NOT SAVED**

---

## 🎯 CONCLUSION

The form logic analysis reveals **significant data loss issues**. While both applications collect comprehensive clinical data, the backend infrastructure (database schema + API) only saves a fraction of it.

**Immediate Action Required:**
1. Fix field name mismatches (gender, age)
2. Expand database schema to store all clinical data
3. Update API to handle all fields
4. Resolve z-score data type conflicts

**Estimated Effort:**
- Database migration: 4-6 hours
- API updates: 6-8 hours
- Testing: 4-6 hours
- **Total: 2-3 days**

This is a **critical issue** that should be addressed before production use to prevent permanent data loss.
