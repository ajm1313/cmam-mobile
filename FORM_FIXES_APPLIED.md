# CMAM Tracker - Form Logic Fixes Applied

## ✅ Immediate Fixes Completed

### 1. Fixed Critical Field Name Mismatches in Webapp

#### Fix 1: Gender Field
**File:** `c:\wamp64\www\cmam\cmam-tracker-django\templates\cases\partials\sam_form.html:46`

**Changed:**
```html
<!-- BEFORE -->
<select name="gender" id="sam_reg_gender" required>

<!-- AFTER -->
<select name="child_gender" id="sam_reg_gender" required>
```

**Impact:** ✅ Webapp now correctly submits gender data to backend API

---

#### Fix 2: Age Field
**File:** `c:\wamp64\www\cmam\cmam-tracker-django\templates\cases\partials\sam_form.html:42`

**Changed:**
```html
<!-- BEFORE -->
<input type="number" name="child_age_months" id="sam_age_months" ...>

<!-- AFTER -->
<input type="number" name="age_months" id="sam_age_months" ...>
```

**Impact:** ✅ Webapp now correctly submits age data to backend API

---

## ⚠️ REMAINING CRITICAL ISSUES

### Priority 1: Database Schema Expansion Required

The following fields are collected by forms but **cannot be saved** due to missing database columns:

#### Medical History Fields (Need New Table or Columns)
- `father_alive`
- `mother_alive`
- `house_location`
- `travel_time`
- `diarrhoea`
- `stool_frequency`
- `vomiting`
- `cough`
- `passing_urine`
- `oedema_duration_days`
- `breastfeeding_status`
- `breastfeeding_prospect`
- `immunization_status`
- `g6pd_status`
- `additional_medical_history`

#### Physical Examination Fields
- `respiratory_rate`
- `temperature_celsius`
- `chest_indrawing`
- `eyes_condition`
- `conjunctiva`
- `ears_condition`
- `mouth_condition`
- `lymph_nodes`
- `hands_feet`
- `skin_changes`
- `disability`
- `disability_details`
- `physical_exam_notes`

#### Medicines at Enrollment
- `amoxicillin_date`, `amoxicillin_dosage`
- `vitamin_a_date`, `vitamin_a_dosage`
- `folic_acid_date`, `folic_acid_dosage`
- `deworming_date`, `deworming_dosage`
- `measles_vaccine_date`, `measles_vaccine_dosage`
- `malaria_test_date`, `malaria_test_result`
- `antimalarial_date`, `antimalarial_dosage`

#### RUTF and Other
- `rutf_sachets_given`
- `rutf_ration_per_day`
- `next_visit_date`
- `other_drug_1`, `other_drug_1_date`, `other_drug_1_dosage`
- `other_drug_2`, `other_drug_2_date`, `other_drug_2_dosage`
- `other_drug_3`, `other_drug_3_date`, `other_drug_3_dosage`
- `additional_notes`

---

### Recommended Database Schema Changes

#### Option 1: Add Columns to OpcRegistration (Simple but Large Table)
```python
# Add to apps/cases/models.py - OpcRegistration model

# Medical History
father_alive = models.CharField(max_length=10, null=True, blank=True)
mother_alive = models.CharField(max_length=10, null=True, blank=True)
house_location = models.CharField(max_length=255, null=True, blank=True)
travel_time = models.CharField(max_length=50, null=True, blank=True)
diarrhoea = models.CharField(max_length=10, null=True, blank=True)
stool_frequency = models.CharField(max_length=10, null=True, blank=True)
vomiting = models.CharField(max_length=10, null=True, blank=True)
cough = models.CharField(max_length=10, null=True, blank=True)
passing_urine = models.CharField(max_length=10, null=True, blank=True)
oedema_duration_days = models.IntegerField(null=True, blank=True)
breastfeeding_status = models.CharField(max_length=10, null=True, blank=True)
breastfeeding_prospect = models.CharField(max_length=20, null=True, blank=True)
immunization_status = models.CharField(max_length=50, null=True, blank=True)
g6pd_status = models.CharField(max_length=50, null=True, blank=True)
additional_medical_history = models.TextField(null=True, blank=True)

# Physical Examination
respiratory_rate = models.CharField(max_length=20, null=True, blank=True)
temperature_celsius = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
chest_indrawing = models.CharField(max_length=10, null=True, blank=True)
eyes_condition = models.CharField(max_length=50, null=True, blank=True)
conjunctiva = models.CharField(max_length=50, null=True, blank=True)
ears_condition = models.CharField(max_length=50, null=True, blank=True)
mouth_condition = models.CharField(max_length=50, null=True, blank=True)
lymph_nodes = models.CharField(max_length=50, null=True, blank=True)
hands_feet = models.CharField(max_length=50, null=True, blank=True)
skin_changes = models.CharField(max_length=50, null=True, blank=True)
disability = models.CharField(max_length=10, null=True, blank=True)
disability_details = models.CharField(max_length=255, null=True, blank=True)
physical_exam_notes = models.TextField(null=True, blank=True)

# Medicines
amoxicillin_date = models.DateField(null=True, blank=True)
amoxicillin_dosage = models.CharField(max_length=100, null=True, blank=True)
vitamin_a_date = models.DateField(null=True, blank=True)
vitamin_a_dosage = models.CharField(max_length=100, null=True, blank=True)
folic_acid_date = models.DateField(null=True, blank=True)
folic_acid_dosage = models.CharField(max_length=100, null=True, blank=True)
deworming_date = models.DateField(null=True, blank=True)
deworming_dosage = models.CharField(max_length=100, null=True, blank=True)
measles_vaccine_date = models.DateField(null=True, blank=True)
measles_vaccine_dosage = models.CharField(max_length=100, null=True, blank=True)
malaria_test_date = models.DateField(null=True, blank=True)
malaria_test_result = models.CharField(max_length=20, null=True, blank=True)
antimalarial_date = models.DateField(null=True, blank=True)
antimalarial_dosage = models.CharField(max_length=100, null=True, blank=True)

# RUTF and Other
rutf_sachets_given = models.IntegerField(null=True, blank=True)
rutf_ration_per_day = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
next_visit_date = models.DateField(null=True, blank=True)
other_drug_1 = models.CharField(max_length=100, null=True, blank=True)
other_drug_1_date = models.DateField(null=True, blank=True)
other_drug_1_dosage = models.CharField(max_length=100, null=True, blank=True)
other_drug_2 = models.CharField(max_length=100, null=True, blank=True)
other_drug_2_date = models.DateField(null=True, blank=True)
other_drug_2_dosage = models.CharField(max_length=100, null=True, blank=True)
other_drug_3 = models.CharField(max_length=100, null=True, blank=True)
other_drug_3_date = models.DateField(null=True, blank=True)
other_drug_3_dosage = models.CharField(max_length=100, null=True, blank=True)
additional_notes = models.TextField(null=True, blank=True)
```

#### Option 2: Separate Related Tables (Normalized, Recommended)
```python
# Create new models in apps/cases/models.py

class EnrollmentMedicalHistory(TimeStampedModel):
    """Medical history at enrollment"""
    registration = models.OneToOneField(OpcRegistration, on_delete=models.CASCADE, related_name='medical_history')
    father_alive = models.CharField(max_length=10, null=True, blank=True)
    mother_alive = models.CharField(max_length=10, null=True, blank=True)
    house_location = models.CharField(max_length=255, null=True, blank=True)
    travel_time = models.CharField(max_length=50, null=True, blank=True)
    diarrhoea = models.CharField(max_length=10, null=True, blank=True)
    stool_frequency = models.CharField(max_length=10, null=True, blank=True)
    vomiting = models.CharField(max_length=10, null=True, blank=True)
    cough = models.CharField(max_length=10, null=True, blank=True)
    passing_urine = models.CharField(max_length=10, null=True, blank=True)
    oedema_duration_days = models.IntegerField(null=True, blank=True)
    breastfeeding_status = models.CharField(max_length=10, null=True, blank=True)
    breastfeeding_prospect = models.CharField(max_length=20, null=True, blank=True)
    immunization_status = models.CharField(max_length=50, null=True, blank=True)
    g6pd_status = models.CharField(max_length=50, null=True, blank=True)
    additional_notes = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'enrollment_medical_history'

class EnrollmentPhysicalExam(TimeStampedModel):
    """Physical examination at enrollment"""
    registration = models.OneToOneField(OpcRegistration, on_delete=models.CASCADE, related_name='physical_exam')
    respiratory_rate = models.CharField(max_length=20, null=True, blank=True)
    temperature_celsius = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    chest_indrawing = models.CharField(max_length=10, null=True, blank=True)
    eyes_condition = models.CharField(max_length=50, null=True, blank=True)
    conjunctiva = models.CharField(max_length=50, null=True, blank=True)
    ears_condition = models.CharField(max_length=50, null=True, blank=True)
    mouth_condition = models.CharField(max_length=50, null=True, blank=True)
    lymph_nodes = models.CharField(max_length=50, null=True, blank=True)
    hands_feet = models.CharField(max_length=50, null=True, blank=True)
    skin_changes = models.CharField(max_length=50, null=True, blank=True)
    disability = models.CharField(max_length=10, null=True, blank=True)
    disability_details = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'enrollment_physical_exam'

class EnrollmentMedicine(TimeStampedModel):
    """Medicines given at enrollment"""
    registration = models.ForeignKey(OpcRegistration, on_delete=models.CASCADE, related_name='enrollment_medicines')
    medicine_type = models.CharField(max_length=50)  # 'Amoxicillin', 'Vitamin A', etc.
    date_given = models.DateField(null=True, blank=True)
    dosage = models.CharField(max_length=100, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    
    class Meta:
        db_table = 'enrollment_medicines'

class EnrollmentRUTF(TimeStampedModel):
    """RUTF ration at enrollment"""
    registration = models.OneToOneField(OpcRegistration, on_delete=models.CASCADE, related_name='rutf_ration')
    sachets_given = models.IntegerField(null=True, blank=True)
    ration_per_day = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    next_visit_date = models.DateField(null=True, blank=True)
    
    class Meta:
        db_table = 'enrollment_rutf'
```

---

### Priority 2: Update Backend API

After database schema is updated, modify `case_create_api` in `apps/api/views.py`:

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def case_create_api(request):
    """Create a new case registration from mobile"""
    data = request.data
    
    # ... existing validation ...
    
    # Create main registration
    case = OpcRegistration.objects.create(
        # ... existing fields ...
    )
    
    # Create medical history if data provided
    if any(data.get(f) for f in ['father_alive', 'mother_alive', 'diarrhoea', ...]):
        EnrollmentMedicalHistory.objects.create(
            registration=case,
            father_alive=data.get('father_alive'),
            mother_alive=data.get('mother_alive'),
            house_location=data.get('house_location'),
            travel_time=data.get('travel_time'),
            diarrhoea=data.get('diarrhoea'),
            stool_frequency=data.get('stool_frequency'),
            vomiting=data.get('vomiting'),
            cough=data.get('cough'),
            passing_urine=data.get('passing_urine'),
            oedema_duration_days=data.get('oedema_duration_days'),
            breastfeeding_status=data.get('breastfeeding_status'),
            breastfeeding_prospect=data.get('breastfeeding_prospect'),
            immunization_status=data.get('immunization_status'),
            g6pd_status=data.get('g6pd_status'),
            additional_notes=data.get('additional_medical_history'),
        )
    
    # Create physical exam if data provided
    if any(data.get(f) for f in ['respiratory_rate', 'temperature_celsius', ...]):
        EnrollmentPhysicalExam.objects.create(
            registration=case,
            respiratory_rate=data.get('respiratory_rate'),
            temperature_celsius=data.get('temperature_celsius'),
            chest_indrawing=data.get('chest_indrawing'),
            eyes_condition=data.get('eyes_condition'),
            conjunctiva=data.get('conjunctiva'),
            ears_condition=data.get('ears_condition'),
            mouth_condition=data.get('mouth_condition'),
            lymph_nodes=data.get('lymph_nodes'),
            hands_feet=data.get('hands_feet'),
            skin_changes=data.get('skin_changes'),
            disability=data.get('disability'),
            disability_details=data.get('disability_details'),
            notes=data.get('physical_exam_notes'),
        )
    
    # Create medicines
    medicines = [
        ('Amoxicillin', 'amoxicillin_date', 'amoxicillin_dosage'),
        ('Vitamin A', 'vitamin_a_date', 'vitamin_a_dosage'),
        ('Folic Acid', 'folic_acid_date', 'folic_acid_dosage'),
        ('Deworming', 'deworming_date', 'deworming_dosage'),
        ('Measles Vaccine', 'measles_vaccine_date', 'measles_vaccine_dosage'),
        ('Malaria Test', 'malaria_test_date', None),
        ('Antimalarial', 'antimalarial_date', 'antimalarial_dosage'),
    ]
    
    for med_type, date_key, dosage_key in medicines:
        if data.get(date_key):
            EnrollmentMedicine.objects.create(
                registration=case,
                medicine_type=med_type,
                date_given=data.get(date_key),
                dosage=data.get(dosage_key) if dosage_key else None,
            )
    
    # Handle other drugs
    for i in range(1, 4):
        drug_name = data.get(f'other_drug_{i}')
        if drug_name:
            EnrollmentMedicine.objects.create(
                registration=case,
                medicine_type=drug_name,
                date_given=data.get(f'other_drug_{i}_date'),
                dosage=data.get(f'other_drug_{i}_dosage'),
            )
    
    # Create RUTF ration
    if data.get('rutf_sachets_given') or data.get('rutf_ration_per_day'):
        EnrollmentRUTF.objects.create(
            registration=case,
            sachets_given=data.get('rutf_sachets_given'),
            ration_per_day=data.get('rutf_ration_per_day'),
            next_visit_date=data.get('next_visit_date'),
        )
    
    serializer = OpcRegistrationDetailSerializer(case)
    return Response({'success': True, 'message': 'Case created successfully', 'data': serializer.data},
                    status=status.HTTP_201_CREATED)
```

---

### Priority 3: Z-Score Data Type Issue

**Current Problem:**
- Mobile sends: `"< -3 SD"` (string)
- Database expects: `-3.5` (decimal)

**Recommended Solution:**
Change database to store categorical z-scores:

```python
# In OpcRegistration model, change:
z_score_wfh = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)

# To:
z_score_wfh = models.CharField(max_length=50, null=True, blank=True)
z_score_wfh_numeric = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
```

This allows storing both the categorical classification (for reports) and numeric value (for calculations).

---

## 📋 Implementation Checklist

### Immediate (Completed ✅)
- [x] Fix `gender` → `child_gender` in webapp SAM form
- [x] Fix `child_age_months` → `age_months` in webapp SAM form

### High Priority (TODO)
- [ ] Create database migration for new fields
- [ ] Update `case_create_api` to save all fields
- [ ] Update serializers to include new fields
- [ ] Test webapp form submission
- [ ] Test mobile app form submission
- [ ] Verify data is saved correctly

### Medium Priority (TODO)
- [ ] Fix z-score data type handling
- [ ] Add validation for MUAC requirement in SAM cases
- [ ] Standardize required fields across platforms
- [ ] Update MAM and IPC forms with same fixes

### Low Priority (TODO)
- [ ] Add conditional field display to webapp (like mobile)
- [ ] Improve photo filename handling
- [ ] Add better error messages
- [ ] Update documentation

---

## 🧪 Testing Required

After implementing database changes:

1. **Test Webapp Form Submission**
   - Register SAM case with all fields
   - Verify all data is saved
   - Check database records

2. **Test Mobile App Form Submission**
   - Register SAM case with all fields
   - Verify all data is saved
   - Check API response

3. **Test Data Retrieval**
   - Fetch case details
   - Verify all fields are returned
   - Check serializer output

4. **Test Edit Functionality**
   - Edit existing case
   - Verify updates work correctly

---

## 📊 Estimated Effort

| Task | Estimated Time |
|------|----------------|
| Database migration creation | 2-3 hours |
| API update (case_create_api) | 3-4 hours |
| Serializer updates | 1-2 hours |
| Testing | 3-4 hours |
| Bug fixes | 2-3 hours |
| **Total** | **11-16 hours (1.5-2 days)** |

---

## ⚠️ IMPORTANT NOTES

1. **Backup Database** before running migrations
2. **Test in development** environment first
3. **Coordinate deployment** with mobile app updates
4. **Communicate changes** to users
5. **Monitor for errors** after deployment

---

## 🎯 Success Criteria

- ✅ All form fields are saved to database
- ✅ No data loss during submission
- ✅ Webapp and mobile app have consistent behavior
- ✅ API properly validates and stores all fields
- ✅ Existing data is not affected by migration
- ✅ Forms can be edited and updated

---

**Status:** 2 critical fixes applied, database schema expansion pending
**Next Step:** Create and test database migration
