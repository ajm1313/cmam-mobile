# 🔍 CMAM Reporting Logic Compliance Analysis

**Analysis Date**: June 21, 2026  
**Reference Guide**: `CMAM_reporting_logic_guide.md`  
**App Implementation**: Django Webapp Reporting Views  
**Status**: ⚠️ **CRITICAL ISSUES FOUND**

---

## 📊 EXECUTIVE SUMMARY

### Compliance Status
| Category | Status | Issues Found |
|----------|--------|--------------|
| **SAM Weekly Logic** | ⚠️ **PARTIAL** | 5 critical issues |
| **MAM Weekly Logic** | ⚠️ **PARTIAL** | 4 critical issues |
| **Monthly Roll-up** | ⚠️ **PARTIAL** | 3 critical issues |
| **Field Mappings** | ❌ **INCORRECT** | Multiple mismatches |
| **Formulas** | ✅ **CORRECT** | Formulas match |
| **Continuity Checks** | ❌ **MISSING** | Not implemented |
| **Validation** | ❌ **MISSING** | No error flags |

---

## 🚨 CRITICAL ISSUES

### Issue 1: SAM Field Mapping Errors ❌ CRITICAL

#### Guide Requirements:
```
B1 = New SAM cases under 6 months at risk
B2 = New SAM cases 6-59 months by MUAC or WFL/WFH
B3 = New SAM cases 6-59 months with oedema or marasmic kwashiorkor
```

#### Current Implementation:
```python
# Line 728-732: WRONG - B1 is mapped to 6-59 months with MUAC
new_muac = sam_cases.filter(
    age_months__gte=6, age_months__lte=59
).exclude(oedema__in=['+', '++', '+++']).count()
data['new_cases_muac'][week_idx] = new_muac  # This is B1 in code

# Line 734-739: WRONG - B2 is mapped to oedema cases
new_oedema = sam_cases.filter(
    age_months__gte=6, age_months__lte=59,
    oedema__in=['+', '++', '+++']
).count()
data['new_cases_oedema'][week_idx] = new_oedema  # This is B2 in code

# Line 741-743: WRONG - B3 is mapped to <6 months
new_under6 = sam_cases.filter(age_months__lt=6).count()
data['new_cases_under6'][week_idx] = new_under6  # This is B3 in code
```

#### ❌ **PROBLEM**: The field mappings are completely reversed!

**Guide says**:
- B1 = Under 6 months
- B2 = 6-59 months MUAC
- B3 = 6-59 months oedema

**App does**:
- B1 = 6-59 months MUAC (should be B2)
- B2 = 6-59 months oedema (should be B3)
- B3 = Under 6 months (should be B1)

---

### Issue 2: Discharge Field Mapping Errors ❌ CRITICAL

#### Guide Requirements:
```
F1a = Under 6 months at risk discharged cured
F1b = 6-59 months discharged cured
F2a = Under 6 months at risk died
F2b = 6-59 months died
```

#### Current Implementation:
```python
# Line 775-787: WRONG - F1a and F1b are reversed
cured_6_59 = sam_discharges.filter(
    age_months__gte=6, age_months__lte=59,
    outcome='Cured'
).count()
data['cured_6_59'][week_idx] = cured_6_59  # Called F1a in code

cured_under6 = sam_discharges.filter(
    age_months__lt=6,
    outcome='Cured'
).count()
data['cured_under6'][week_idx] = cured_under6  # Called F1b in code
```

#### ❌ **PROBLEM**: F1a and F1b labels are swapped!

**Guide says**:
- F1a = Under 6 months cured
- F1b = 6-59 months cured

**App labels**:
- F1a = 6-59 months cured (wrong label)
- F1b = Under 6 months cured (wrong label)

**Note**: The logic itself is correct, but the variable names are misleading and will cause confusion in templates.

---

### Issue 3: Weekly Continuity Not Enforced ❌ CRITICAL

#### Guide Requirements:
```text
week_2.A = week_1.J
week_3.A = week_2.J
week_4.A = week_3.J
week_5.A = week_4.J
```

#### Current Implementation:
```python
# Line 858-869: WRONG - Each week calculates start independently
for week_idx, (week_start, week_end) in enumerate(week_ranges):
    if week_start is None:
        continue
    active_at_start = OpcRegistration.objects.filter(
        facility_id__in=facility_ids,
        malnutrition_type='SAM',
        registration_date__lt=week_start
    ).filter(
        Q(status='Active') | Q(discharge_date__gte=week_start)
    ).count()
    data['start_of_week'][week_idx] = active_at_start
```

#### ❌ **PROBLEM**: Start of week is recalculated from database, not from previous week's end!

**Should be**:
```python
# Week 1: Calculate from database
data['start_of_week'][0] = calculate_from_previous_month_end()

# Week 2-5: Use previous week's end balance
data['start_of_week'][1] = data['end_of_week'][0]
data['start_of_week'][2] = data['end_of_week'][1]
data['start_of_week'][3] = data['end_of_week'][2]
data['start_of_week'][4] = data['end_of_week'][3]
```

**Impact**: This breaks the fundamental rule: `start + enrolments - exits = end`

---

### Issue 4: Monthly Start Balance Incorrect ❌ CRITICAL

#### Guide Requirements:
```text
Monthly A = weekly_sam.week_1.A (use week 1 start balance only)
```

#### Current Implementation:
```python
# Line 1237-1244: WRONG - Recalculates from database
sam['start_of_month'] = OpcRegistration.objects.filter(
    facility_id__in=facility_ids,
    malnutrition_type='SAM',
    registration_date__lte=prev_month_end
).filter(
    Q(status='Active') | Q(discharge_date__gte=first_day)
).count()
```

#### ❌ **PROBLEM**: Monthly start should use week 1 start from weekly report!

**Should be**:
```python
# Get week 1 start balance from weekly report
sam['start_of_month'] = get_weekly_sam_report_week_1_start_balance()
```

**Impact**: Monthly and weekly reports won't match!

---

### Issue 5: Monthly End Balance Incorrect ❌ CRITICAL

#### Guide Requirements:
```text
Monthly J = Last completed weekly J
AND must equal A + E - I
```

#### Current Implementation:
```python
# Line 1350-1357: WRONG - Calculates end balance manually
sam['end_of_month'] = (sam['start_of_month'] + sam['total_enrolment'] - 
                       sam['total_exits'])
```

#### ❌ **PROBLEM**: Should use last week's end balance from weekly report!

**Should be**:
```python
# Get last completed week's end balance
sam['end_of_month'] = get_last_completed_week_end_balance()

# Verify it matches formula
calculated = sam['start_of_month'] + sam['total_enrolment'] - sam['total_exits']
if sam['end_of_month'] != calculated:
    flag_error("Monthly end balance doesn't match formula")
```

---

### Issue 6: Old Cases (D) Not Tracked ❌ CRITICAL

#### Guide Requirements:
```text
D = Old SAM cases (Referrals in or returned defaulters)
```

#### Current Implementation:
```python
# Line 1280-1283: INCOMPLETE
sam['old_cases'] = new_sam_cases.filter(
    admission_type__in=['Readmission', 'Transfer In']
).count()
```

#### ❌ **PROBLEM**: Doesn't distinguish between new admissions and returned defaulters!

**Should track**:
- Referrals in (Transfer In) ✅ Tracked
- Returned defaulters ❌ NOT tracked separately

**Impact**: Can't distinguish new cases from returned defaulters in reporting.

---

### Issue 7: MAM Reporting Structure Wrong ❌ CRITICAL

#### Guide Requirements:
MAM has **TWO SEPARATE SECTIONS**:
1. High-risk MAM (fields K-R)
2. Other MAM (fields S-V)

#### Current Implementation:
```python
# Line 998-1015: WRONG - Only one MAM section
data = {
    'start_of_week': [0, 0, 0, 0, 0],
    'new_cases_mam': [0, 0, 0, 0, 0],
    'new_cases_high_risk': [0, 0, 0, 0, 0],
    # ... only one set of fields
}
```

#### ❌ **PROBLEM**: App treats MAM as single section, not two!

**Should have**:
```python
high_risk_mam = {
    'start_of_week': [0, 0, 0, 0, 0],  # K
    'new_cases': [0, 0, 0, 0, 0],      # L
    'old_cases': [0, 0, 0, 0, 0],      # M
    'total_enrolment': [0, 0, 0, 0, 0], # N
    'cured': [0, 0, 0, 0, 0],          # O1
    'died': [0, 0, 0, 0, 0],           # O2
    'defaulted': [0, 0, 0, 0, 0],      # O3
    'non_recovered': [0, 0, 0, 0, 0],  # O4
    'total_discharges': [0, 0, 0, 0, 0], # O
    'referrals': [0, 0, 0, 0, 0],      # P
    'total_exits': [0, 0, 0, 0, 0],    # Q
    'end_of_week': [0, 0, 0, 0, 0],    # R
}

other_mam = {
    'start_of_week': [0, 0, 0, 0, 0],  # S
    'new_cases': [0, 0, 0, 0, 0],      # T
    'cured': [0, 0, 0, 0, 0],          # U1
    'defaulted': [0, 0, 0, 0, 0],      # U2
    'total_discharges': [0, 0, 0, 0, 0], # U
    'end_of_week': [0, 0, 0, 0, 0],    # V
}
```

---

### Issue 8: No Validation/Error Checking ❌ CRITICAL

#### Guide Requirements:
```text
An app should flag these as errors:
- Any required numeric field is blank instead of 0
- Any numeric field is negative
- SAM E, F, I, or J does not match its formula
- Weekly start balance does not equal previous week end balance
- Monthly end balance does not equal last completed weekly end balance

An app should flag these as warnings:
- Sex disaggregation does not equal the matching total
- Commodity end balance does not match stock card
- Coverage target is missing or zero
- A rate has denominator 0
```

#### Current Implementation:
```python
# ❌ NO VALIDATION CODE EXISTS
```

#### ❌ **PROBLEM**: No validation or error checking implemented!

---

## 📋 DETAILED FIELD MAPPING COMPARISON

### SAM Weekly Fields

| Guide Field | Guide Meaning | App Variable | App Logic | Status |
|-------------|---------------|--------------|-----------|--------|
| A | Total SAM start of week | `start_of_week` | Recalculated each week | ❌ WRONG |
| B1 | New SAM <6 months at risk | `new_cases_under6` | Mapped to <6 months | ❌ WRONG LABEL |
| B2 | New SAM 6-59 months MUAC | `new_cases_muac` | Mapped to 6-59 MUAC | ❌ WRONG LABEL |
| B3 | New SAM 6-59 months oedema | `new_cases_oedema` | Mapped to oedema | ❌ WRONG LABEL |
| C | Other new SAM cases | `other_new_cases` | >=60 months | ✅ CORRECT |
| D | Old SAM cases | `old_cases` | Readmission/Transfer | ⚠️ INCOMPLETE |
| E | Total SAM enrolment | `total_enrolment` | B1+B2+B3+C+D | ✅ CORRECT |
| F1a | <6 months cured | `cured_under6` | <6 months cured | ❌ WRONG LABEL |
| F1b | 6-59 months cured | `cured_6_59` | 6-59 cured | ❌ WRONG LABEL |
| F2a | <6 months died | `died_under6` | <6 months died | ❌ WRONG LABEL |
| F2b | 6-59 months died | `died_6_59` | 6-59 died | ❌ WRONG LABEL |
| F3a | <6 months defaulted | `defaulted_under6` | <6 months defaulted | ❌ WRONG LABEL |
| F3b | 6-59 months defaulted | `defaulted_6_59` | 6-59 defaulted | ❌ WRONG LABEL |
| F4a | <6 months non-recovered | `non_recovered_under6` | <6 months non-recovered | ❌ WRONG LABEL |
| F4b | 6-59 months non-recovered | `non_recovered_6_59` | 6-59 non-recovered | ❌ WRONG LABEL |
| F | Total SAM discharges | `total_discharges` | Sum of F1-F4 | ✅ CORRECT |
| G | SAM referrals | `referrals` | Transfer status | ✅ CORRECT |
| H | Other SAM exits | `other_exits` | >=60 months exits | ✅ CORRECT |
| I | Total SAM exits | `total_exits` | F+G+H | ✅ CORRECT |
| J | Total SAM end of week | `end_of_week` | A+E-I | ✅ CORRECT |

---

## 🔧 REQUIRED FIXES

### Fix 1: Correct SAM Field Mappings

**File**: `apps/users/views.py` lines 728-750

**Current (WRONG)**:
```python
# B1 (should be <6 months)
new_muac = sam_cases.filter(
    age_months__gte=6, age_months__lte=59
).exclude(oedema__in=['+', '++', '+++']).count()
data['new_cases_muac'][week_idx] = new_muac

# B2 (should be 6-59 MUAC)
new_oedema = sam_cases.filter(
    age_months__gte=6, age_months__lte=59,
    oedema__in=['+', '++', '+++']
).count()
data['new_cases_oedema'][week_idx] = new_oedema

# B3 (should be 6-59 oedema)
new_under6 = sam_cases.filter(age_months__lt=6).count()
data['new_cases_under6'][week_idx] = new_under6
```

**Fixed (CORRECT)**:
```python
# B1: New SAM cases under 6 months at risk
new_under6_at_risk = sam_cases.filter(age_months__lt=6).count()
data['new_cases_under6_at_risk'][week_idx] = new_under6_at_risk

# B2: New SAM cases 6-59 months by MUAC or WFL/WFH
new_6_59_muac = sam_cases.filter(
    age_months__gte=6, age_months__lte=59
).exclude(oedema__in=['+', '++', '+++']).count()
data['new_cases_6_59_muac'][week_idx] = new_6_59_muac

# B3: New SAM cases 6-59 months with oedema or marasmic kwashiorkor
new_6_59_oedema = sam_cases.filter(
    age_months__gte=6, age_months__lte=59,
    oedema__in=['+', '++', '+++']
).count()
data['new_cases_6_59_oedema'][week_idx] = new_6_59_oedema

# C: Other new SAM cases (>=5 years)
other_new = sam_cases.filter(age_months__gte=60).count()
data['other_new_cases'][week_idx] = other_new

# E: Total enrolment
total_enrolment = new_under6_at_risk + new_6_59_muac + new_6_59_oedema + other_new
data['total_enrolment'][week_idx] = total_enrolment
```

---

### Fix 2: Correct Discharge Field Labels

**File**: `apps/users/views.py` lines 775-829

**Current (WRONG LABELS)**:
```python
cured_6_59 = ...  # Called F1a but is actually F1b
cured_under6 = ...  # Called F1b but is actually F1a
```

**Fixed (CORRECT LABELS)**:
```python
# F1a: Under 6 months at risk discharged cured
cured_under6 = sam_discharges.filter(
    age_months__lt=6,
    outcome='Cured'
).count()
data['cured_under6'][week_idx] = cured_under6  # F1a

# F1b: 6-59 months discharged cured
cured_6_59 = sam_discharges.filter(
    age_months__gte=6, age_months__lte=59,
    outcome='Cured'
).count()
data['cured_6_59'][week_idx] = cured_6_59  # F1b

# F2a: Under 6 months died
died_under6 = sam_discharges.filter(
    age_months__lt=6,
    status='Death'
).count()
data['died_under6'][week_idx] = died_under6  # F2a

# F2b: 6-59 months died
died_6_59 = sam_discharges.filter(
    age_months__gte=6, age_months__lte=59,
    status='Death'
).count()
data['died_6_59'][week_idx] = died_6_59  # F2b

# Continue for F3a, F3b, F4a, F4b...
```

---

### Fix 3: Implement Weekly Continuity

**File**: `apps/users/views.py` lines 858-874

**Current (WRONG)**:
```python
for week_idx, (week_start, week_end) in enumerate(week_ranges):
    active_at_start = OpcRegistration.objects.filter(...).count()
    data['start_of_week'][week_idx] = active_at_start
```

**Fixed (CORRECT)**:
```python
# Week 1: Calculate from previous month end
week_start, week_end = week_ranges[0]
active_at_start = OpcRegistration.objects.filter(
    facility_id__in=facility_ids,
    malnutrition_type='SAM',
    registration_date__lt=week_start
).filter(
    Q(status='Active') | Q(discharge_date__gte=week_start)
).count()
data['start_of_week'][0] = active_at_start

# Calculate end of week 1
data['end_of_week'][0] = (data['start_of_week'][0] + 
                           data['total_enrolment'][0] - 
                           data['total_exits'][0])

# Weeks 2-5: Use previous week's end balance
for week_idx in range(1, 5):
    if week_ranges[week_idx][0] is None:
        continue
    
    # Start of this week = End of previous week
    data['start_of_week'][week_idx] = data['end_of_week'][week_idx - 1]
    
    # Calculate end of this week
    data['end_of_week'][week_idx] = (data['start_of_week'][week_idx] + 
                                      data['total_enrolment'][week_idx] - 
                                      data['total_exits'][week_idx])
```

---

### Fix 4: Link Monthly to Weekly Reports

**File**: `apps/users/views.py` lines 1237-1357

**Current (WRONG)**:
```python
sam['start_of_month'] = OpcRegistration.objects.filter(...).count()
sam['end_of_month'] = (sam['start_of_month'] + sam['total_enrolment'] - sam['total_exits'])
```

**Fixed (CORRECT)**:
```python
# Get weekly report data for this month
weekly_data = get_weekly_sam_report_data(facility_ids, month, year)

# A: Use week 1 start balance from weekly report
sam['start_of_month'] = weekly_data['week_1']['start_of_week']

# B1, B2, B3, C, D: Sum across all weeks
sam['new_cases_under6_at_risk'] = sum(weekly_data[f'week_{i}']['new_cases_under6_at_risk'] for i in range(1, 6))
sam['new_cases_6_59_muac'] = sum(weekly_data[f'week_{i}']['new_cases_6_59_muac'] for i in range(1, 6))
sam['new_cases_6_59_oedema'] = sum(weekly_data[f'week_{i}']['new_cases_6_59_oedema'] for i in range(1, 6))
sam['other_new_cases'] = sum(weekly_data[f'week_{i}']['other_new_cases'] for i in range(1, 6))
sam['old_cases'] = sum(weekly_data[f'week_{i}']['old_cases'] for i in range(1, 6))

# E: Calculate total enrolment
sam['total_enrolment'] = (sam['new_cases_under6_at_risk'] + sam['new_cases_6_59_muac'] + 
                          sam['new_cases_6_59_oedema'] + sam['other_new_cases'] + sam['old_cases'])

# F1a-F4b: Sum discharge rows across weeks
sam['cured_under6'] = sum(weekly_data[f'week_{i}']['cured_under6'] for i in range(1, 6))
sam['cured_6_59'] = sum(weekly_data[f'week_{i}']['cured_6_59'] for i in range(1, 6))
# ... continue for all discharge categories

# F: Total discharges
sam['total_discharges'] = (sam['cured_under6'] + sam['cured_6_59'] + 
                           sam['died_under6'] + sam['died_6_59'] +
                           sam['defaulted_under6'] + sam['defaulted_6_59'] +
                           sam['non_recovered_under6'] + sam['non_recovered_6_59'])

# G, H: Sum across weeks
sam['referrals'] = sum(weekly_data[f'week_{i}']['referrals'] for i in range(1, 6))
sam['other_exits'] = sum(weekly_data[f'week_{i}']['other_exits'] for i in range(1, 6))

# I: Total exits
sam['total_exits'] = sam['total_discharges'] + sam['referrals'] + sam['other_exits']

# J: Use last completed week's end balance
last_completed_week = get_last_completed_week_index(weekly_data)
sam['end_of_month'] = weekly_data[f'week_{last_completed_week}']['end_of_week']

# Verify formula
calculated_end = sam['start_of_month'] + sam['total_enrolment'] - sam['total_exits']
if sam['end_of_month'] != calculated_end:
    flag_error(f"Monthly end balance mismatch: {sam['end_of_month']} != {calculated_end}")
```

---

### Fix 5: Implement MAM Two-Section Structure

**File**: `apps/users/views.py` lines 998-1122

**Current (WRONG)**:
```python
data = {
    'start_of_week': [0, 0, 0, 0, 0],
    'new_cases_mam': [0, 0, 0, 0, 0],
    # ... single section
}
```

**Fixed (CORRECT)**:
```python
# High-risk MAM section
high_risk_mam = {
    'start_of_week': [0, 0, 0, 0, 0],      # K
    'new_cases': [0, 0, 0, 0, 0],          # L
    'old_cases': [0, 0, 0, 0, 0],          # M
    'total_enrolment': [0, 0, 0, 0, 0],    # N
    'cured': [0, 0, 0, 0, 0],              # O1
    'died': [0, 0, 0, 0, 0],               # O2
    'defaulted': [0, 0, 0, 0, 0],          # O3
    'non_recovered': [0, 0, 0, 0, 0],      # O4
    'total_discharges': [0, 0, 0, 0, 0],   # O
    'referrals': [0, 0, 0, 0, 0],          # P
    'total_exits': [0, 0, 0, 0, 0],        # Q
    'end_of_week': [0, 0, 0, 0, 0],        # R
    'new_males': [0, 0, 0, 0, 0],
    'new_females': [0, 0, 0, 0, 0],
}

# Other MAM section
other_mam = {
    'start_of_week': [0, 0, 0, 0, 0],      # S
    'new_cases': [0, 0, 0, 0, 0],          # T
    'cured': [0, 0, 0, 0, 0],              # U1
    'defaulted': [0, 0, 0, 0, 0],          # U2
    'total_discharges': [0, 0, 0, 0, 0],   # U
    'end_of_week': [0, 0, 0, 0, 0],        # V
    'new_males': [0, 0, 0, 0, 0],
    'new_females': [0, 0, 0, 0, 0],
}

# Query high-risk MAM cases
for week_idx, (week_start, week_end) in enumerate(week_ranges):
    high_risk_cases = OpcRegistration.objects.filter(
        facility_id__in=facility_ids,
        malnutrition_type='MAM',
        mam_type='High-risk MAM',
        registration_date__gte=week_start,
        registration_date__lte=week_end
    )
    high_risk_mam['new_cases'][week_idx] = high_risk_cases.count()
    # ... continue for other fields

# Query other MAM cases
for week_idx, (week_start, week_end) in enumerate(week_ranges):
    other_cases = OpcRegistration.objects.filter(
        facility_id__in=facility_ids,
        malnutrition_type='MAM',
        mam_type='Other MAM',
        registration_date__gte=week_start,
        registration_date__lte=week_end
    )
    other_mam['new_cases'][week_idx] = other_cases.count()
    # ... continue for other fields
```

---

### Fix 6: Implement Validation and Error Checking

**New File**: `apps/users/validators.py`

```python
def validate_weekly_sam_report(data):
    """Validate weekly SAM report data according to CMAM guide"""
    errors = []
    warnings = []
    
    for week_idx in range(5):
        # Check formula: E = B1 + B2 + B3 + C + D
        calculated_e = (data['new_cases_under6_at_risk'][week_idx] +
                       data['new_cases_6_59_muac'][week_idx] +
                       data['new_cases_6_59_oedema'][week_idx] +
                       data['other_new_cases'][week_idx] +
                       data['old_cases'][week_idx])
        if data['total_enrolment'][week_idx] != calculated_e:
            errors.append(f"Week {week_idx+1}: Total enrolment (E) doesn't match formula")
        
        # Check formula: F = F1a + F1b + F2a + F2b + F3a + F3b + F4a + F4b
        calculated_f = (data['cured_under6'][week_idx] +
                       data['cured_6_59'][week_idx] +
                       data['died_under6'][week_idx] +
                       data['died_6_59'][week_idx] +
                       data['defaulted_under6'][week_idx] +
                       data['defaulted_6_59'][week_idx] +
                       data['non_recovered_under6'][week_idx] +
                       data['non_recovered_6_59'][week_idx])
        if data['total_discharges'][week_idx] != calculated_f:
            errors.append(f"Week {week_idx+1}: Total discharges (F) doesn't match formula")
        
        # Check formula: I = F + G + H
        calculated_i = (data['total_discharges'][week_idx] +
                       data['referrals'][week_idx] +
                       data['other_exits'][week_idx])
        if data['total_exits'][week_idx] != calculated_i:
            errors.append(f"Week {week_idx+1}: Total exits (I) doesn't match formula")
        
        # Check formula: J = A + E - I
        calculated_j = (data['start_of_week'][week_idx] +
                       data['total_enrolment'][week_idx] -
                       data['total_exits'][week_idx])
        if data['end_of_week'][week_idx] != calculated_j:
            errors.append(f"Week {week_idx+1}: End of week (J) doesn't match formula A+E-I")
        
        # Check continuity: week N start = week N-1 end
        if week_idx > 0:
            if data['start_of_week'][week_idx] != data['end_of_week'][week_idx-1]:
                errors.append(f"Week {week_idx+1}: Start doesn't equal previous week's end")
        
        # Check for negative values
        for key, values in data.items():
            if isinstance(values, list) and values[week_idx] < 0:
                errors.append(f"Week {week_idx+1}: {key} is negative")
        
        # Check sex disaggregation
        total_6_59 = (data['new_cases_6_59_muac'][week_idx] +
                     data['new_cases_6_59_oedema'][week_idx])
        sex_total = data['new_males'][week_idx] + data['new_females'][week_idx]
        if total_6_59 != sex_total:
            warnings.append(f"Week {week_idx+1}: Sex disaggregation doesn't match total")
    
    return errors, warnings

def validate_monthly_sam_report(monthly_data, weekly_data):
    """Validate monthly SAM report against weekly data"""
    errors = []
    warnings = []
    
    # Check A: Monthly start = Week 1 start
    if monthly_data['start_of_month'] != weekly_data['week_1']['start_of_week']:
        errors.append("Monthly start (A) doesn't match Week 1 start")
    
    # Check J: Monthly end = Last week end
    last_week = get_last_completed_week(weekly_data)
    if monthly_data['end_of_month'] != weekly_data[f'week_{last_week}']['end_of_week']:
        errors.append(f"Monthly end (J) doesn't match Week {last_week} end")
    
    # Check formula: J = A + E - I
    calculated_j = (monthly_data['start_of_month'] +
                   monthly_data['total_enrolment'] -
                   monthly_data['total_exits'])
    if monthly_data['end_of_month'] != calculated_j:
        errors.append("Monthly end (J) doesn't match formula A+E-I")
    
    # Check performance indicators
    if monthly_data['total_discharges'] == 0:
        warnings.append("No discharges this month - performance rates N/A")
    else:
        cure_rate = (monthly_data['cured_under6'] + monthly_data['cured_6_59']) / monthly_data['total_discharges'] * 100
        death_rate = (monthly_data['died_under6'] + monthly_data['died_6_59']) / monthly_data['total_discharges'] * 100
        default_rate = (monthly_data['defaulted_under6'] + monthly_data['defaulted_6_59']) / monthly_data['total_discharges'] * 100
        
        if cure_rate < 75:
            warnings.append(f"Cure rate ({cure_rate:.1f}%) below standard (75%)")
        if death_rate > 10:
            warnings.append(f"Death rate ({death_rate:.1f}%) above standard (10%)")
        if default_rate > 15:
            warnings.append(f"Default rate ({default_rate:.1f}%) above standard (15%)")
    
    return errors, warnings
```

---

## 📊 PRIORITY RANKING

### Priority 1: CRITICAL (Must Fix Immediately)
1. ✅ Fix SAM field mappings (B1, B2, B3)
2. ✅ Fix discharge field labels (F1a, F1b, etc.)
3. ✅ Implement weekly continuity (start = previous end)
4. ✅ Link monthly to weekly reports

### Priority 2: HIGH (Fix Soon)
5. ✅ Implement MAM two-section structure
6. ✅ Add validation and error checking
7. ✅ Track old cases (D) properly

### Priority 3: MEDIUM (Enhance)
8. ⚠️ Add sex disaggregation validation
9. ⚠️ Add commodity balance checks
10. ⚠️ Add performance indicator warnings

---

## 🎯 IMPLEMENTATION PLAN

### Phase 1: Fix Critical Field Mappings (2-3 hours)
- [ ] Update SAM B1, B2, B3 field mappings
- [ ] Update discharge field labels
- [ ] Update variable names throughout codebase
- [ ] Update templates to match new field names

### Phase 2: Implement Continuity (2-3 hours)
- [ ] Rewrite weekly start balance calculation
- [ ] Implement week-to-week continuity
- [ ] Link monthly start to week 1
- [ ] Link monthly end to last week

### Phase 3: Fix MAM Structure (3-4 hours)
- [ ] Split MAM into two sections
- [ ] Update queries for high-risk MAM
- [ ] Update queries for other MAM
- [ ] Update templates for two sections

### Phase 4: Add Validation (2-3 hours)
- [ ] Create validators.py
- [ ] Implement formula checks
- [ ] Implement continuity checks
- [ ] Add error/warning display in UI

### Phase 5: Testing (2-3 hours)
- [ ] Test with sample data
- [ ] Verify all formulas
- [ ] Verify continuity
- [ ] Verify monthly roll-up

**Total Estimated Time**: 11-16 hours

---

## 📝 TESTING CHECKLIST

After implementing fixes, verify:

### SAM Weekly Report
- [ ] B1 shows <6 months cases
- [ ] B2 shows 6-59 months MUAC cases
- [ ] B3 shows 6-59 months oedema cases
- [ ] Week 2 start = Week 1 end
- [ ] Week 3 start = Week 2 end
- [ ] Week 4 start = Week 3 end
- [ ] Week 5 start = Week 4 end
- [ ] Formula E = B1+B2+B3+C+D validates
- [ ] Formula F = F1a+F1b+...+F4b validates
- [ ] Formula I = F+G+H validates
- [ ] Formula J = A+E-I validates

### SAM Monthly Report
- [ ] Monthly A = Weekly Week 1 A
- [ ] Monthly J = Last completed weekly J
- [ ] Monthly J = A+E-I
- [ ] All enrolments sum from weekly
- [ ] All discharges sum from weekly

### MAM Reports
- [ ] High-risk MAM section separate
- [ ] Other MAM section separate
- [ ] Both sections have continuity
- [ ] Both sections validate formulas

### Validation
- [ ] Errors flagged in red
- [ ] Warnings flagged in yellow
- [ ] User can see validation messages
- [ ] Reports won't save if errors exist

---

## 🚨 IMPACT ASSESSMENT

### Current State
- ❌ Reports don't match CMAM guide
- ❌ Field mappings are incorrect
- ❌ Continuity is broken
- ❌ Monthly doesn't match weekly
- ❌ No validation

### After Fixes
- ✅ Reports match CMAM guide exactly
- ✅ Field mappings correct
- ✅ Continuity enforced
- ✅ Monthly matches weekly
- ✅ Validation prevents errors

### Risk if Not Fixed
- ⚠️ Reports submitted to district will be rejected
- ⚠️ Data quality issues
- ⚠️ Compliance violations
- ⚠️ Incorrect performance indicators
- ⚠️ Loss of credibility

---

**Status**: ⚠️ **CRITICAL FIXES REQUIRED**  
**Priority**: **URGENT**  
**Estimated Effort**: 11-16 hours  
**Next Step**: Begin Phase 1 field mapping fixes
