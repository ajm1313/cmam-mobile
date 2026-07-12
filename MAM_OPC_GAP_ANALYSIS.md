# MAM OPC Logic - Gap Analysis

## Executive Summary

The CMAM Tracker app has **minimal implementation** of MAM OPC logic. While basic data capture exists (MAM type selection), **critical protocol-specific logic is missing** for both High-risk MAM and Other MAM management.

---

## ✅ What IS Currently Implemented

### 1. **Basic MAM Type Differentiation** ✅

**Implementation**:
- **Backend**: `apps/cases/models.py:50-53`
  - `mam_type` field with choices: `'High-risk MAM'`, `'Other MAM'`
  
- **Mobile App**: `cmam_tracker_mobile/app/case/register.tsx:72,618`
  - MAM_TYPES selector in registration form
  - User can select High-risk MAM or Other MAM

**Status**: ✅ Data capture works, but no logic uses this differentiation

### 2. **MAM Case Registration** ✅

**Implementation**:
- `OpcRegistration` model accepts `malnutrition_type='MAM'`
- Mobile app has MAM registration flow
- Basic fields captured: weight, height, MUAC, admission date

**Status**: ✅ Basic registration works

### 3. **MAM Cases Excluded from SAM Automation** ✅

**Implementation**: `apps/cases/signals.py:21-22, 135-136`
```python
# Only process SAM cases
if instance.malnutrition_type != 'SAM':
    return
```

**Status**: ✅ Correctly prevents SAM-specific automation from running on MAM cases

---

## ❌ Critical Gaps - NOT Implemented

### 1. **Infant <6 Months Exclusion for MAM** ❌

**Required Logic** (from protocol):
```
Infants less than 6 months are NOT admitted for MAM management.
- If infant has MAM with complications or poor suckling → refer to hospital
- If no complications and breastfeeding possible → refer to infant-at-risk/SAM OPC pathway
```

**Current Status**:
- ❌ No age validation preventing MAM admission for infants <6 months
- ❌ No automatic referral logic for infants with MAM
- ❌ No warning message in mobile app

**Impact**: **HIGH RISK** - Infants may be incorrectly enrolled in MAM program

---

### 2. **High-Risk MAM Admission Criteria** ❌

**Required Logic** (from protocol):
```
Admit as High-risk MAM when child is 6-59 months, clinically well, and has:
- MUAC 11.5 cm - 11.9 cm
OR
- MUAC 12.0 cm - 12.4 cm / WFL-H < -2 SD with aggravating factors

Aggravating factors:
- Age under 24 months
- WAZ below -3 SD
- Previous SAM episode
- Failure to recover with counselling alone
- HIV/TB or other significant medical/social risk
- Disability
- Poor maternal health
- Mother died
- Severe household vulnerability
```

**Current Status**:
- ❌ No automatic classification based on MUAC ranges
- ❌ No aggravating factors assessment
- ❌ No fields to capture aggravating factors
- ❌ No logic to auto-select "High-risk MAM" vs "Other MAM"

**Missing Fields**:
- `previous_sam_episode` (Boolean)
- `waz_below_minus_3` (Boolean)
- `hiv_tb_status` (String)
- `maternal_health_status` (String)
- `mother_deceased` (Boolean)
- `household_vulnerability_score` (Integer)
- `failed_counselling_only` (Boolean)

**Impact**: **HIGH** - Manual selection prone to errors, inconsistent classification

---

### 3. **Other MAM Admission Criteria** ❌

**Required Logic** (from protocol):
```
Other MAM (lower-risk):
- MUAC 12.0 cm - 12.4 cm
OR
- WFL-H < -2 SD
with NO high-risk aggravating factors
```

**Current Status**:
- ❌ No automatic classification
- ❌ No validation that "Other MAM" should not have aggravating factors

**Impact**: **MEDIUM** - Classification errors possible

---

### 4. **Visit Schedule Differentiation** ❌

**Required Logic** (from protocol):
```
High-risk MAM: Weekly follow-up visits
Other MAM: Fortnightly (every 2 weeks) visits
```

**Current Status**:
- ❌ No visit schedule tracking
- ❌ No automatic visit reminders based on MAM type
- ❌ No validation of visit frequency

**Impact**: **MEDIUM** - Staff must manually track, risk of missed visits

---

### 5. **High-Risk MAM Management Protocol** ❌

**Required at Every Visit**:
- Check MUAC, weight, oedema
- Check stool/vomiting
- Check appetite and feeding
- Check clinical condition
- Refer for clinical care if sick/deteriorating
- Arrange home visit if: losing weight, static weight, not responding, absent/defaulting, caregiver refused referral

**Current Status**:
- ❌ No MAM-specific visit checklist
- ❌ No automatic home visit triggers for MAM
- ❌ No deterioration detection for MAM

**Impact**: **HIGH** - Protocol not systematically followed

---

### 6. **SFF/RUTF for High-Risk MAM** ❌

**Required Logic** (from protocol):
```
High-risk MAM: Give 1 sachet per day of SFF/RUTF where available
Appetite test required, especially if giving RUTF/SFF
```

**Current Status**:
- ❌ No SFF (Supplementary Feeding Formula) tracking
- ❌ No 1 sachet/day calculation for MAM
- ❌ RUTF logic is SAM-specific (multiple sachets based on weight)
- ❌ No appetite test requirement for High-risk MAM

**Impact**: **HIGH** - Incorrect feeding protocol

---

### 7. **Other MAM Management Protocol** ❌

**Required**:
- Targeted counselling/CWC-style follow-up (not intensive feeding)
- Appetite assessed from feeding history (not formal test)
- Fortnightly visits
- Counselling on: breastfeeding, complementary feeding, dietary diversity, hygiene, illness care, danger signs
- Monitor: MUAC, weight, oedema, illness, feeding
- If worsens or becomes SAM → refer/enrol to SAM pathway

**Current Status**:
- ❌ No differentiation between High-risk and Other MAM management
- ❌ No counselling-focused workflow for Other MAM
- ❌ No automatic SAM transition trigger

**Impact**: **HIGH** - Other MAM may receive incorrect intensive feeding

---

### 8. **High-Risk MAM Discharge Criteria** ❌

**Required Logic** (from protocol):
```
Cured = MUAC >= 12.5 cm for 3 continuous visits AND clinically well/alert
Died = child dies while in MAM management
Defaulted = absent for 3 continuous visits
Non-recovered = does not recover after allowed treatment period, after review/investigation
Referred = referred to another MAM OPC, SAM OPC, IPC, or health facility (condition deteriorated)
```

**Current Status**:
- ✅ MUAC >= 12.5 cm tracking exists (from SAM automation)
- ❌ Not applied to MAM cases (SAM-only)
- ❌ No MAM-specific discharge criteria checking
- ❌ No "3 continuous visits" tracking for MAM
- ❌ No "Non-recovered" after treatment period logic
- ❌ No "Referred" outcome tracking for MAM

**Impact**: **HIGH** - MAM discharge decisions not automated

---

### 9. **Other MAM Discharge Criteria** ❌

**Required Logic** (from protocol):
```
Simpler discharge for Other MAM:
- Cured
- Defaulted
(No Died, Non-recovered, or Referred categories in reporting)
```

**Current Status**:
- ❌ No Other MAM-specific discharge logic
- ❌ No differentiation from High-risk MAM discharge

**Impact**: **MEDIUM** - Reporting may be inaccurate

---

### 10. **MAM Reporting Categories** ❌

**Required Logic** (from protocol):

**High-risk MAM Monthly Report**:
- K = Total high-risk MAM start of month
- L = New high-risk MAM cases (Lm + Lf for sex disaggregation)
- M = Old cases (referred from other MAM OPC or returned defaulter)
- N = Total high-risk MAM enrolment = L + M
- O1 = Discharged cured
- O2 = Died
- O3 = Defaulted
- O4 = Non-recovered
- O = Total discharges = O1 + O2 + O3 + O4
- P = Referrals to other outpatient/inpatient care for SAM
- Q = Total high-risk MAM exits = O + P
- R = Total high-risk MAM end of month = K + N - Q

**Other MAM Monthly Report**:
- S = Total Other MAM start of month
- T = New Other MAM cases (Tm + Tf for sex disaggregation)
- U1 = Discharged cured Other MAM
- U2 = Defaulted Other MAM
- U = Total Other MAM discharges = U1 + U2
- V = Total Other MAM end of month = S + T - U

**Current Status**:
- ❌ No MAM reporting categories implemented
- ❌ No K, L, M, N, O1-O4, P, Q, R tracking
- ❌ No S, T, U1, U2, U, V tracking
- ❌ No sex disaggregation for MAM
- ❌ No monthly cohort tracking

**Impact**: **HIGH** - Cannot generate required MAM reports

---

## 📊 Implementation Completeness Score

| Component | Status | Completeness |
|-----------|--------|--------------|
| MAM type selection (UI) | ✅ Working | 100% |
| Infant <6 months exclusion | ❌ Missing | 0% |
| High-risk MAM criteria | ❌ Missing | 0% |
| Other MAM criteria | ❌ Missing | 0% |
| Aggravating factors | ❌ Missing | 0% |
| Visit schedule (weekly/fortnightly) | ❌ Missing | 0% |
| High-risk MAM management | ❌ Missing | 0% |
| Other MAM management | ❌ Missing | 0% |
| SFF/RUTF for MAM | ❌ Missing | 0% |
| High-risk MAM discharge | ❌ Missing | 0% |
| Other MAM discharge | ❌ Missing | 0% |
| MAM reporting (K-V) | ❌ Missing | 0% |

**Overall Completeness: ~8%** (1 of 12 components partially implemented)

---

## 🚨 Risk Assessment

### **Critical Risks**:
1. **Infants <6 months enrolled in MAM** - Protocol violation, wrong care pathway
2. **Incorrect MAM type classification** - High-risk vs Other MAM confusion
3. **Wrong feeding protocol** - SFF vs RUTF vs counselling-only
4. **No discharge automation** - Manual decisions, inconsistent criteria

### **High Risks**:
1. **No visit schedule tracking** - Missed follow-ups
2. **No deterioration detection** - Delayed SAM transition
3. **No reporting** - Program monitoring impossible

---

## 💡 Recommendations

### **Phase 1: Critical Safety (Immediate)**

1. ✅ **Infant <6 Months Validation**
   - Block MAM admission for age <6 months
   - Show referral guidance (hospital or SAM OPC pathway)
   - Add validation in mobile app and backend

2. ✅ **Aggravating Factors Assessment**
   - Add database fields for aggravating factors
   - Create assessment checklist in mobile app
   - Auto-classify High-risk vs Other MAM

3. ✅ **Basic Discharge Criteria**
   - Implement MUAC >= 12.5 cm for 3 visits (High-risk MAM)
   - Implement defaulter detection (3 missed visits)
   - Add MAM-specific discharge outcomes

---

### **Phase 2: Core Protocol (Week 1-2)**

1. ✅ **Visit Schedule Management**
   - Weekly reminders for High-risk MAM
   - Fortnightly reminders for Other MAM
   - Visit compliance tracking

2. ✅ **SFF/RUTF Management**
   - 1 sachet/day for High-risk MAM
   - Appetite test requirement
   - Stock tracking for SFF

3. ✅ **SAM Transition Logic**
   - Auto-detect when MAM becomes SAM (MUAC <11.5, oedema, etc.)
   - Trigger transfer to SAM OPC
   - Maintain case history

---

### **Phase 3: Reporting & Analytics (Week 3-4)**

1. ✅ **MAM Reporting Categories**
   - Implement K-R tracking for High-risk MAM
   - Implement S-V tracking for Other MAM
   - Sex disaggregation (Lm, Lf, Tm, Tf)
   - Monthly cohort reports

2. ✅ **Home Visit Triggers**
   - Weight loss detection
   - Static weight detection
   - Non-response detection
   - Defaulter tracking

---

## 📝 Technical Implementation Notes

### Files Requiring Creation/Updates:

1. **`apps/cases/mam_automation_service.py`** ✅ NEW
   - Create MAM-specific automation service
   - Methods:
     - `check_infant_mam_exclusion()`
     - `classify_mam_type()` (High-risk vs Other)
     - `check_aggravating_factors()`
     - `check_mam_discharge_criteria()`
     - `calculate_sff_ration()`
     - `check_sam_transition()`

2. **`apps/cases/models.py`** ✅ UPDATE
   - Add aggravating factor fields
   - Add MAM reporting category fields
   - Add visit schedule fields

3. **`apps/cases/signals.py`** ✅ UPDATE
   - Add MAM-specific pre_save signal
   - Add MAM-specific post_save signal
   - Infant <6 months validation

4. **`cmam_tracker_mobile/app/case/register.tsx`** ✅ UPDATE
   - Add aggravating factors checklist
   - Add infant <6 months validation
   - Auto-classify MAM type based on criteria

5. **`apps/api/views.py`** ✅ UPDATE
   - Add MAM reporting endpoints
   - Add MAM discharge validation

---

## 🔍 Comparison: SAM vs MAM Implementation

| Feature | SAM OPC | MAM OPC |
|---------|---------|---------|
| Admission criteria automation | ✅ Full | ❌ None |
| Age-based logic | ✅ Infant <6mo | ❌ No infant exclusion |
| Discharge criteria | ✅ Automated | ❌ Manual |
| Visit schedule | ✅ Day 4/10 for infants | ❌ No schedule |
| Feeding protocol | ✅ RUTF calculation | ❌ No SFF logic |
| Reporting categories | ✅ B1, B2, F1-F4 | ❌ None |
| Task generation | ✅ Automated | ❌ None |
| IPC referral | ✅ Automated | ❌ None |
| Weight trend tracking | ✅ Automated | ❌ None |

**SAM Implementation**: ~78% complete  
**MAM Implementation**: ~8% complete

---

## 📚 Protocol References

- Ghana CMAM Manual: MAM Management (Section 5)
- MAM Treatment Card
- Module 5 Training Material: MAM OPC Management
- Monthly MAM Reporting Forms (High-risk and Other MAM)

---

## ✅ Next Steps

1. **Immediate**: Implement infant <6 months exclusion (safety)
2. **Week 1**: Add aggravating factors and auto-classification
3. **Week 2**: Implement MAM discharge criteria
4. **Week 3**: Add visit schedules and SFF management
5. **Week 4**: Implement MAM reporting (K-V categories)

---

**Document Status**: Gap analysis complete  
**Recommendation**: Prioritize Phase 1 (infant exclusion + aggravating factors)  
**Owner**: Development team  
**Date**: June 28, 2026
