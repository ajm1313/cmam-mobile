# SAM OPC App Automation Specification

Purpose: this document explains the decision logic an AI editor or developer should apply in a CMAM app for SAM outpatient care (OPC). It covers automatic admission type selection, automatic referral blocking at registration, action triggers during admission and visits, and automatic discharge/exit category triggers.

Source logic comes from the Ghana CMAM OPC manual, SAM treatment card, and Module 4 outpatient care training material already reviewed in this workspace.

## 1. Required App Inputs

The app cannot automate decisions safely unless these fields are captured.

### Child and Visit Identity

- `age_months`
- `age_weeks` for infants under 6 months
- `sex`
- `registration_source`
- `previous_program_status`
- `current_visit_number`
- `weeks_in_treatment`
- `missed_consecutive_visits`
- `returned_from_ipc_date`

### Admission Source Values

Use these controlled values:

- `community`
- `self_referral`
- `cwc_or_outreach`
- `health_facility_referral`
- `inpatient_care_referral`
- `other_opc_transfer`
- `returned_defaulter`
- `relapse_after_cure`

### Anthropometry and Nutrition

- `muac_cm`
- `weight_kg`
- `length_height_cm`
- `wflh_zscore`
- `wfa_zscore`
- `bilateral_pitting_oedema_grade`: `0`, `+`, `++`, `+++`
- `visible_wasting`
- `weight_less_than_4kg`
- `weight_trend`: `gaining`, `static`, `losing`, `deteriorating`
- `consecutive_weight_loss_count`
- `consecutive_static_weight_count`
- `below_admission_weight_week_3`

### Appetite and Feeding

- `appetite_test_result`: `passed`, `failed`, `not_done`, `not_required`
- `rutf_percent_consumed_weekly`
- `breastfeeding_status`: `effective`, `poor`, `refusing`, `unable`, `not_breastfed`
- `prospect_of_breastfeeding`: `yes`, `no`
- `relactation_needed`
- `effective_suckling`
- `replacement_feeding_safe`

### Medical Assessment

Use booleans unless a value is shown:

- `critically_ill`
- `imci_danger_sign`
- `intractable_vomiting`
- `convulsions`
- `lethargic_or_not_alert`
- `unconscious`
- `very_weak_or_apathetic`
- `hypoglycaemia_suspected`
- `temperature_c`
- `respiratory_rate`
- `chest_indrawing`
- `severe_dehydration`
- `very_pale_or_severe_palmar_pallor`
- `difficulty_breathing`
- `extensive_skin_infection_needs_im_treatment`
- `eye_signs_vitamin_a_deficiency`
- `severe_anaemia`
- `lower_respiratory_tract_infection`
- `general_medical_deterioration`
- `caregiver_requests_ipc`
- `caregiver_refuses_referral`

### Discharge Readiness

- `muac_12_5_or_more_consecutive_visits`
- `no_oedema_consecutive_visits`
- `no_oedema_continuous_days`
- `wflh_greater_equal_minus_2_consecutive_visits`
- `wfa_greater_minus_2`
- `weight_gain_150g_per_week_consecutive_weeks`
- `clinically_well_and_alert`
- `medical_investigation_done`
- `nutrition_health_education_completed`
- `immunization_updated`
- `linked_to_followup_services`

## 2. Decision Order

The app should apply decisions in this order:

1. Check for emergency/IPC referral conditions.
2. If IPC referral is required, block SAM OPC admission and show referral action.
3. If IPC referral is refused, record `RR` and trigger urgent home visit.
4. If no IPC referral condition exists, check whether the child meets SAM OPC admission criteria.
5. Auto-select admission source/type on the treatment card.
6. Auto-select reporting admission category.
7. During each visit, run action protocol triggers.
8. At each visit, check discharge/exit category in this order: died, referred, defaulted, non-recovered, cured, continue treatment.

This order prevents a sick child from being wrongly admitted or kept in SAM OPC only because anthropometry meets SAM criteria.

## 3. Automatic Selection of Admission Type on Registration Form

The treatment card enrolment/source field should be selected from the source of entry.

| Input condition | Auto-select on treatment card | Reporting category |
|---|---|---|
| `registration_source` is `community`, `self_referral`, or `cwc_or_outreach` | `Direct from community` | New case if SAM OPC criteria are met |
| `registration_source` is `health_facility_referral` | `Referred from health facility` | New case if this is not a transfer from OPC/IPC |
| `registration_source` is `inpatient_care_referral` | `Referred from inpatient care` | Old case |
| `registration_source` is `other_opc_transfer` | Use referred/moved-in logic in register; if card has no exact option, use `Referred from health facility` and store transfer detail separately | Old case |
| `registration_source` is `returned_defaulter` | Re-enrolment/returned defaulter detail | Old case |
| `registration_source` is `relapse_after_cure` | `Re-enrolment/relapse` | New case |

### Reporting Admission Category

After source selection, classify the SAM admission row:

| Condition | Reporting category |
|---|---|
| Infant under 6 months/6 weeks to less than 6 months at risk and admitted to OPC | `B1: New SAM case under 6 months at risk` |
| Child 6-59 months with MUAC less than 11.5 cm or WFL/H less than -3 SD, no oedema admission category | `B2: New SAM case 6-59 months by MUAC/WFLH` |
| Child 6-59 months with oedema/marasmic kwashiorkor admission category after appropriate stabilization/eligibility | `B3: New SAM case 6-59 months oedema/marasmic kwashiorkor` |
| Child 5 years or older, adolescent, or adult managed by programme | `C: Other new SAM case` |
| Referred from IPC, transferred from another OPC, or returned defaulter before recovery | `D: Old case` |

Important: relapse after cure is a new episode. Do not classify relapse after cure as a returned defaulter.

## 4. Automatic Referral Blocking at Registration

If any condition below is true, the app should not allow normal SAM OPC admission. It should show: `Refer to IPC now`, require referral documentation, and set treatment-card outcome/action to referral where applicable.

### Infants Under 6 Months

Refer to IPC if:

- Any bilateral pitting oedema is present: `+`, `++`, or `+++`.
- Infant has SAM/visible wasting needing inpatient care.
- Infant refuses or is unable to breastfeed.
- Infant has no suckling.
- Non-breastfed infant refuses or is unable to feed.
- `prospect_of_breastfeeding = no`.
- `relactation_needed = true`.
- Any medical complication or danger sign is present.

### Children 6-59 Months

Refer to IPC if:

- `bilateral_pitting_oedema_grade = +++`.
- Marasmic kwashiorkor is present, meaning oedema plus severe wasting.
- `appetite_test_result = failed`.
- Child has no appetite or cannot eat.
- `intractable_vomiting = true`.
- `convulsions = true`.
- `lethargic_or_not_alert = true`.
- `unconscious = true`.
- `very_weak_or_apathetic = true`.
- `temperature_c > 39`.
- `temperature_c < 35`.
- Respiratory rate is above age threshold:
  - under 2 months: `respiratory_rate >= 60`
  - 2 to 12 months: `respiratory_rate >= 50`
  - 1 to 5 years: `respiratory_rate >= 40`
  - over 5 years: `respiratory_rate >= 30`
- `chest_indrawing = true`.
- `severe_dehydration = true`.
- `very_pale_or_severe_palmar_pallor = true`.
- `difficulty_breathing = true`.
- `extensive_skin_infection_needs_im_treatment = true`.
- `eye_signs_vitamin_a_deficiency = true`.
- `severe_anaemia = true`.
- `lower_respiratory_tract_infection = true`.
- `weight_less_than_4kg = true` for a child over 6 months.
- `caregiver_requests_ipc = true`.

### Referral Outputs

When referral is triggered, the app should:

- Block final SAM OPC admission unless a supervisor overrides for documented refusal/temporary care.
- Create referral task/form.
- Require reason for referral.
- Record anthropometry, medical findings, medicines given, RUTF given if any, and receiving facility.
- Mark action/outcome as `R: Referral`.
- If caregiver refuses, mark `RR: Refused Referral` and trigger urgent home visit.

## 5. Admission Action Triggers

At registration, the app should trigger these tasks automatically.

| Trigger | App action |
|---|---|
| Child is critically ill or danger sign present | Show emergency triage/referral workflow |
| Hypoglycaemia suspected | Prompt immediate first care according to facility protocol before referral |
| Child 6-59 months eligible for SAM OPC | Require appetite test result before admission completion |
| Child 6-59 months passes appetite test and has no complications | Allow SAM OPC admission |
| Child 6-59 months fails appetite test | Trigger IPC referral |
| Infant under 6 months at risk with breastfeeding prospect | Admit to OPC and create breastfeeding support plan |
| Infant under 6 months needs relactation or has no breastfeeding prospect | Trigger IPC referral |
| New SAM OPC admission | Trigger amoxicillin/medical treatment protocol according to national guidance |
| Malaria suspected or test required | Trigger malaria test/treatment workflow according to national guidance |
| Age 24 months or older | Schedule deworming for second visit |
| Age 6 months or older and measles immunization incomplete | Schedule measles immunization for week 4/fourth visit if clinically well |
| Severe anaemia or vitamin A eye signs | Trigger IPC referral |
| Eligible child admitted | Create RUTF ration task based on weight and visit interval |
| Any admission | Create counselling checklist and next visit date |

## 6. Follow-on Visit Action Triggers

At every visit, the app should run the action protocol after measurements and clinical assessment are entered.

### Refer to IPC During Visit

Trigger `R: Referral` if any of these occur:

- Infant under 6 months develops any oedema grade.
- Child 6-59 months has oedema grade `+++`.
- Marasmic kwashiorkor is present.
- Oedema in child 6-59 months is not reducing by week 3.
- Oedema increases or new oedema develops.
- Infant under 6 months refuses/is unable to breastfeed, has no suckling, or is unable/refusing to feed.
- Child 6-59 months fails appetite test or cannot eat.
- Intractable vomiting.
- Fever greater than 39 C.
- Hypothermia less than 35 C.
- Respiratory rate meets referral threshold.
- Any chest in-drawing.
- Severe pallor with difficulty breathing.
- Extensive infection needing intramuscular treatment.
- Very weak, apathetic, unconscious.
- Fitting or convulsions.
- Severe dehydration.
- Weight loss for 3 continuous measurements.
- Static weight for 5 continuous measurements.
- Deteriorating condition.
- Caregiver requests IPC.
- Child is not recovering and needs hospital investigation.

### Trigger Follow-up Home Visit

Trigger `HV: Home Visit` if:

- Child is absent or defaulting.
- Child 6-59 months has oedema not reducing by week 2.
- Child 6-59 months eats less than 75% of weekly RUTF by the third session.
- General medical deterioration is suspected but child is not yet referred.
- Child is below admission weight on week 3.
- Weight loss for 2 continuous weeks.
- Static weight for 3 continuous weeks.
- Child returned from IPC within the first 2 weeks.
- Caregiver refused IPC referral.

### Continue Treatment

Set `OK: Continue Treatment` only if:

- No referral trigger is present.
- No discharge/exit trigger is present.
- Child remains eligible for OPC.
- RUTF/feeding and counselling tasks are completed.
- Next appointment is scheduled.

## 7. Automatic Discharge and Exit Category Triggers

Run exit checks at each visit after referral checks.

### Exit Priority Order

Use this order:

1. `X: Died`
2. `R: Referral`
3. `D: Defaulted`
4. `NR: Non-Recovered`
5. `C: Cured`
6. `OK: Continue Treatment`

### Died

Set `X: Died` if:

- Infant or child died while in OPC.
- Infant or child died during transportation to IPC.

### Referred

Set `R: Referral` if:

- Any IPC referral criterion is present.
- Child’s condition is deteriorating according to the action protocol.
- Child needs hospital investigation because not recovering.

If caregiver refuses, set `RR: Refused Referral` instead of closing the case as a completed referral, and keep home visit/close follow-up active.

### Defaulted

Set `D: Defaulted` if:

- `missed_consecutive_visits >= 3`.
- This represents three continuous missed follow-on sessions/three continuous weeks absent.

Before auto-closing as defaulted, the app should check whether a home visit/tracing attempt has been created or documented.

### Non-Recovered

Set `NR: Non-Recovered` if all are true:

- `weeks_in_treatment >= 16`.
- Child has not reached cured discharge criteria.
- Medical investigation has been done.
- The child is not currently needing IPC referral.

If medical investigation has not been done, trigger medical investigation/referral review instead of setting non-recovered.

### Cured - Children 6-59 Months

Set `C: Cured` when the applicable criteria are met and the child is clinically well and alert.

General minimum criteria:

- `clinically_well_and_alert = true`
- `bilateral_pitting_oedema_grade = 0`
- `muac_cm >= 12.5`
- Recovery criteria sustained for the required continuous visits/weeks.

By admission basis:

| Admission basis | Cured trigger |
|---|---|
| Oedema only | No oedema for required continuous visits, MUAC at least 12.5 cm for 3 continuous visits, clinically well and alert |
| Low MUAC | MUAC at least 12.5 cm for 3 continuous visits, no oedema, clinically well and alert |
| Low WFL/H | WFL/H at least -2 SD or greater for 3 continuous visits, MUAC greater than 12.5 cm, no oedema, clinically well and alert |
| Marasmic kwashiorkor | No oedema, no severe wasting for 3 continuous visits, MUAC at least 12.5 cm, clinically well and alert |

The app should also confirm:

- Immunization status checked/updated.
- Nutrition and health education completed.
- Child linked to CWC/community follow-up.
- Final RUTF ration prepared where applicable.

### Cured - Infants Under 6 Months at Risk

Set `C: Cured` when all are true:

- Effective suckling or safe effective feeding is established.
- Weight gain is at least 150 g/week for 3 continuous weeks.
- WFA is greater than -2 SD and/or WFL is greater than -2 SD.
- Infant is clinically well and alert.
- No medical complication is present.
- Caregiver has received required feeding/breastfeeding support.
- Follow-up/community linkage is documented.

## 8. Recommended App Messages

### Admission Block Message

Use this when IPC referral is triggered:

> This child should not be admitted to SAM OPC today. The child meets criteria for inpatient care. Complete referral actions now.

### Refused Referral Message

> Referral to inpatient care is required, but the caregiver has refused. Record refused referral, counsel again, address barriers, and arrange urgent home visit/close follow-up.

### Home Visit Message

> This child needs follow-up at home before the next visit. Assign a health worker or volunteer and record the reason.

### Cured Message

> The child meets SAM OPC cured discharge criteria. Complete discharge counselling, final ration, immunization check, and community follow-up linkage.

### Non-Recovered Message

> The child has reached 16 weeks without meeting discharge criteria. Confirm medical investigation before classifying as non-recovered.

## 9. Minimum Developer Validation Checks

The app should flag errors when:

- A child is admitted to OPC despite an IPC referral criterion.
- Appetite test is missing for a 6-59 month child being admitted to OPC.
- An infant under 6 months is admitted without breastfeeding prospect assessment.
- A returned defaulter is counted as a new case.
- A relapse after cure is counted as an old case.
- Default is set before 3 consecutive missed visits.
- Non-recovered is set before 16 weeks or without medical investigation.
- Cured is set before sustained MUAC/oedema/WFLH criteria are met.

