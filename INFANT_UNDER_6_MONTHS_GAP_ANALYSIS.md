# Infant Under 6 Months Logic - Gap Analysis

## Executive Summary

The CMAM Tracker app has **partial implementation** of infant under 6 months logic. While basic infrastructure exists, **critical gaps remain** that prevent full compliance with the Ghana CMAM protocol for infants 6 weeks to less than 6 months.

---

## ✅ What IS Currently Implemented

### 1. **Reporting Category Classification** ✅
- **Location**: `apps/cases/automation_service.py:62-64`
- **Status**: WORKING
- Correctly classifies infants <6 months as `B1: New SAM case under 6 months at risk`

### 2. **Data Capture Fields** ✅
- **Location**: `apps/cases/models.py` and mobile app `register.tsx`
- **Status**: WORKING
- Fields exist:
  - `breastfeeding_status` (Yes/No)
  - `breastfeeding_prospect` (Good/Poor/None)
  - `age_months` and `age_weeks` (documented in spec)
  - `z_score_wfa` (Weight-for-Age)
  - `z_score_wfh` (Weight-for-Length)

### 3. **Mobile App UI** ✅
- **Location**: `cmam_tracker_mobile/app/case/register.tsx:445-450`
- **Status**: WORKING
- Conditional display: breastfeeding prospect only shown if breastfeeding status = "Yes"
- Enrollment criteria includes: `'MUAC < 11.0cm infant'`, `'WFA < -3SD infant'`

### 4. **Basic Age-Based Task Generation** ✅
- **Location**: `apps/cases/automation_service.py:305-306`
- **Status**: WORKING
- Appetite test correctly excluded for infants <6 months
- Measles vaccination correctly excluded for infants <6 months

---

## ❌ Critical Gaps - NOT Implemented

### 1. **IPC Referral Blocking for Infants <6 Months** ❌

**Required Logic** (from protocol):
```
Refer to IPC if infant <6 months has:
- Any oedema (+, ++, +++)
- Visible severe wasting/SAM needing inpatient care
- No suckling / refusing or unable to breastfeed
- No prospect of breastfeeding
- Relactation needed
- Any medical complication/danger sign
```

**Current Status**: 
- ❌ No automatic IPC referral trigger for infants
- ❌ No validation preventing OPC admission when IPC criteria met
- ❌ Missing fields: `effective_suckling`, `relactation_needed`, `visible_wasting`

**Impact**: **HIGH RISK** - Infants who should be in IPC may be incorrectly admitted to OPC

---

### 2. **Mandatory Visit Schedule (Day 4 and Day 10)** ❌

**Required Logic** (from protocol):
```
Infants <6 months at risk must have:
- Mandatory follow-up visit on Day 4
- Mandatory follow-up visit on Day 10
```

**Current Status**:
- ❌ No special visit scheduling for infants
- ❌ No Day 4/Day 10 visit reminders or tasks
- ❌ Standard weekly visit schedule applied (incorrect for infants)

**Impact**: **HIGH RISK** - Infants may not receive adequate monitoring

---

### 3. **Infant-Specific Discharge Criteria** ❌

**Required Logic** (from protocol):
```
Infant <6 months discharged CURED when ALL true:
- Breastfeeding/effective feeding established
- Weight gain ≥150g per week for 3 continuous weeks
- WFA > -2 SD and/or WFL > -2 SD
- Clinically well and alert
- No medical complication
```

**Current Status**:
- ❌ Uses standard 6-59 month discharge criteria (MUAC ≥12.5cm for 3 visits)
- ❌ No 150g/week weight gain tracking for infants
- ❌ No WFA/WFL threshold checking for discharge
- ❌ No breastfeeding establishment verification

**Location**: `apps/cases/automation_service.py:183-216` (`_check_cure_criteria`)

**Impact**: **HIGH RISK** - Infants may be discharged prematurely or held too long

---

### 4. **Infant-Specific Reporting Categories for Discharge** ❌

**Required Logic** (from protocol):
```
Discharge outcomes for infants <6 months:
- F1a: Discharged cured, SAM <6 months at risk
- F2a: Died, SAM <6 months at risk
- F3a: Defaulted, SAM <6 months at risk
- F4a: Non-recovered, SAM <6 months at risk
```

**Current Status**:
- ❌ No separate F1a/F2a/F3a/F4a categories
- ❌ Infants lumped with 6-59 month children in discharge reporting
- ❌ No age-based discharge category differentiation

**Impact**: **MEDIUM** - Reporting inaccurate, program monitoring compromised

---

### 5. **Breastfeeding Assessment and Support Tasks** ❌

**Required Logic** (from protocol):
```
At enrollment and follow-up:
- Assess breastfeeding
- Observe feeding for 10-15 minutes
- Check weight and growth
- Assess mother/caregiver health and stress
- Counsel on: positioning, attachment, frequent feeds, night feeds,
  expressing milk, cup feeding, warmth, hygiene, caregiver rest, family support
```

**Current Status**:
- ❌ No breastfeeding observation task generation
- ❌ No 10-15 minute feeding assessment workflow
- ❌ No maternal health/stress assessment
- ❌ No breastfeeding counseling checklist

**Impact**: **HIGH** - Core infant management protocol not followed

---

### 6. **Validation Checks** ❌

**Required Logic** (from spec line 399):
```
Flag error when:
- An infant under 6 months is admitted without breastfeeding prospect assessment
```

**Current Status**:
- ❌ No validation preventing admission without breastfeeding assessment
- ❌ No warning when IPC criteria present but OPC admission attempted

**Impact**: **MEDIUM** - Data quality issues, protocol violations undetected

---

## 📊 Implementation Completeness Score

| Component | Status | Completeness |
|-----------|--------|--------------|
| Reporting category (B1) | ✅ Working | 100% |
| Data capture fields | ✅ Working | 80% (missing suckling, relactation) |
| IPC referral blocking | ❌ Missing | 0% |
| Mandatory visit schedule | ❌ Missing | 0% |
| Discharge criteria | ❌ Missing | 0% |
| Discharge reporting (F1a-F4a) | ❌ Missing | 0% |
| Breastfeeding support tasks | ❌ Missing | 0% |
| Validation checks | ❌ Missing | 0% |

**Overall Completeness: ~22%** (2 of 8 components fully implemented)

---

## 🚨 Risk Assessment

### **Critical Risks** (Immediate Action Required):
1. **Infants admitted to OPC when IPC needed** - Could result in poor outcomes or death
2. **Inadequate monitoring** - Missing Day 4/Day 10 visits
3. **Incorrect discharge decisions** - Wrong criteria applied

### **High Risks**:
1. **No breastfeeding support protocol** - Core intervention missing
2. **Inaccurate reporting** - Program performance cannot be properly monitored

---

## 💡 Recommendations

### **Phase 1: Critical Safety (Immediate)**
1. ✅ Add IPC referral blocking for infants <6 months with:
   - Any oedema
   - No breastfeeding prospect
   - Medical complications
2. ✅ Add validation: require breastfeeding prospect assessment before admission

### **Phase 2: Core Protocol (Week 1-2)**
1. ✅ Implement Day 4 and Day 10 mandatory visit scheduling
2. ✅ Add infant-specific discharge criteria (150g/week, WFA/WFL thresholds)
3. ✅ Add missing fields: `effective_suckling`, `relactation_needed`, `visible_wasting`

### **Phase 3: Complete Implementation (Week 3-4)**
1. ✅ Implement F1a/F2a/F3a/F4a discharge reporting categories
2. ✅ Add breastfeeding assessment and counseling task workflows
3. ✅ Add 10-15 minute feeding observation checklist

---

## 📝 Technical Implementation Notes

### Files Requiring Updates:

1. **`apps/cases/models.py`**
   - Add fields: `effective_suckling`, `relactation_needed`, `visible_wasting`

2. **`apps/cases/automation_service.py`**
   - Add method: `check_infant_ipc_criteria()`
   - Update: `check_discharge_criteria()` to handle infant-specific logic
   - Add method: `generate_infant_visit_schedule()`
   - Update: `classify_reporting_category()` for discharge (F1a-F4a)

3. **`apps/cases/signals.py`**
   - Add pre_save validation for infant admission blocking

4. **`cmam_tracker_mobile/app/case/register.tsx`**
   - Add validation before submission
   - Add IPC referral warning dialog

5. **`apps/api/views.py`**
   - Add infant admission validation endpoint
   - Update discharge reporting to include F1a-F4a categories

---

## 📚 Protocol References

- Ghana CMAM Manual: Infant <6 months management (Section 4.2)
- SAM Treatment Card: Infant discharge criteria
- Module 4 Training Material: Breastfeeding support protocol

---

**Document Status**: Gap analysis complete  
**Next Action**: Prioritize Phase 1 critical safety implementations  
**Owner**: Development team  
**Date**: June 28, 2026
