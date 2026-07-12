# CMAM Reporting Logic Guide

This file is an AI-readable version of the CMAM completion guide. It is meant for an AI editor, app developer, or reporting logic reviewer to compare an application against the weekly tally and monthly SAM/MAM report logic.

Source forms:

- `2025 July 24 Health Facility Tally Sheet_All.docx`
- `2025 July 20 Health Facilty OPC Reporting Forms.docx`

Core rule:

```text
start balance + enrolments - exits = end balance
```

For every programme, the end balance for one week becomes the start balance for the next week.

## General Data Rules

- Write `0` when there were no cases or no commodities.
- Do not leave numeric fields blank unless the item does not apply.
- Count each client once in the correct category.
- A new case is a first admission during the period.
- An old case is a referral in from another care point or a returned defaulter.
- A returned defaulter is not a new case.
- A referral out is recorded as a referral/exit, not as cured, died, defaulted, or non-recovered.
- Do not sum weekly start balances to create the monthly start balance.
- Do not sum weekly end balances to create the monthly end balance.

## Weekly SAM Outpatient Tally

Use the table headed `Health Facility Tally Sheet for Management of SAM`.

### SAM Weekly Fields

| Field | Meaning | Logic |
|---|---|---|
| A | Total SAM start of week | Week 1 uses previous month SAM end balance. Later weeks use previous week J. |
| B1 | New SAM cases under 6 months at risk | Sum as weekly admissions. |
| B2 | New SAM cases 6-59 months by MUAC or WFL/WFH | Sum as weekly admissions. |
| B3 | New SAM cases 6-59 months with oedema or marasmic kwashiorkor | Sum as weekly admissions. |
| C | Other new SAM cases | Children 5 years and above, adolescents, adults. |
| D | Old SAM cases | Referrals in or returned defaulters. |
| E | Total SAM enrolment | `E = B1 + B2 + B3 + C + D` |
| F1a | Under 6 months at risk discharged cured | Sum weekly outcome. |
| F1b | 6-59 months discharged cured | Sum weekly outcome. |
| F2a | Under 6 months at risk died | Sum weekly outcome. |
| F2b | 6-59 months died | Sum weekly outcome. |
| F3a | Under 6 months at risk defaulted | Sum weekly outcome. |
| F3b | 6-59 months defaulted | Sum weekly outcome. |
| F4a | Under 6 months at risk non-recovered | Sum weekly outcome. |
| F4b | 6-59 months non-recovered | Sum weekly outcome. |
| F | Total SAM discharges | `F = F1a + F1b + F2a + F2b + F3a + F3b + F4a + F4b` |
| G | SAM referrals | Referrals to other outpatient care or inpatient care. |
| H | Other SAM exits | Other exits for other SAM client groups. |
| I | Total SAM exits | `I = F + G + H` |
| J | Total SAM end of week | `J = A + E - I` |

Template note: the outpatient SAM weekly tally prints `E=B1+B2+B3+B4+C+D`, but the outpatient SAM table has no B4 row. Use `E=B1+B2+B3+C+D`.

### SAM Sex Checks

```text
B1m + B1f = B1
B2_B3_m + B2_B3_f = B2 + B3
```

### SAM Weekly Continuity Checks

```text
week_2.A = week_1.J
week_3.A = week_2.J
week_4.A = week_3.J
week_5.A = week_4.J
```

## Weekly MAM Outpatient Tally

Use the table headed `Health Facility Tally Sheet for Management of MAM`.

The MAM tally has two sections:

- High-risk MAM
- Other MAM

### High-risk MAM Weekly Fields

| Field | Meaning | Logic |
|---|---|---|
| K | Total high-risk MAM start of week | Week 1 uses previous month high-risk MAM end balance. Later weeks use previous week R. |
| L | New high-risk MAM cases | New high-risk MAM admissions. |
| M | Old high-risk MAM cases | Referrals in or returned defaulters. |
| N | Total high-risk MAM enrolment | `N = L + M` |
| O1 | High-risk MAM discharged cured | Sum weekly outcome. |
| O2 | High-risk MAM died | Sum weekly outcome. |
| O3 | High-risk MAM defaulted | Sum weekly outcome. |
| O4 | High-risk MAM non-recovered | Sum weekly outcome. |
| O | Total high-risk MAM discharges | `O = O1 + O2 + O3 + O4` |
| P | High-risk MAM referrals | Referrals to SAM outpatient care, inpatient care, or other care. |
| Q | Total high-risk MAM exits | `Q = O + P` |
| R | Total high-risk MAM end of week | `R = K + N - Q` |

The form may print `exists`; for reporting logic, treat this as `exits`.

### Other MAM Weekly Fields

| Field | Meaning | Logic |
|---|---|---|
| S | Total other MAM start of week | Week 1 uses previous month other MAM end balance. Later weeks use previous week V. |
| T | New other MAM cases | New other MAM admissions. |
| U1 | Other MAM discharged cured | Sum weekly outcome. |
| U2 | Other MAM defaulted | Sum weekly outcome. |
| U | Total other MAM discharges | `U = U1 + U2` |
| V | Total other MAM end of week | `V = S + T - U` |

### MAM Sex Checks

```text
Lm + Lf = L
Tm + Tf = T
```

### MAM Weekly Continuity Checks

```text
week_2.K = week_1.R
week_3.K = week_2.R
week_4.K = week_3.R
week_5.K = week_4.R

week_2.S = week_1.V
week_3.S = week_2.V
week_4.S = week_3.V
week_5.S = week_4.V
```

## Weekly Total Column Rules

Use these rules when completing the `TOTAL` column on the weekly tally.

| Row type | Correct total-column logic |
|---|---|
| Activity rows | Add week 1 + week 2 + week 3 + week 4 + week 5. |
| Start-balance rows | Use week 1 start balance only. |
| End-balance rows | Use the last completed week end balance only. |
| Commodity received | Add all weekly receipts. |
| Commodity issued | Add all weekly issues. |
| Commodity end balance | Use the last completed week balance. |

## Monthly SAM Report Roll-up

| Monthly field | Source or formula |
|---|---|
| A | `weekly_sam.week_1.A` |
| B1 | `sum(weekly_sam.B1 across weeks)` |
| B2 | `sum(weekly_sam.B2 across weeks)` |
| B3 | `sum(weekly_sam.B3 across weeks)` |
| C | `sum(weekly_sam.C across weeks)` |
| D | `sum(weekly_sam.D across weeks)` |
| E | `B1 + B2 + B3 + C + D` |
| F1a to F4b | Sum each matching weekly discharge row. |
| F | `F1a + F1b + F2a + F2b + F3a + F3b + F4a + F4b` |
| G | `sum(weekly_sam.G across weeks)` |
| H | `sum(weekly_sam.H across weeks)` |
| I | `F + G + H` |
| J | Last completed weekly `J`, and must also equal `A + E - I`. |

## Monthly MAM Report Roll-up

### High-risk MAM

| Monthly field | Source or formula |
|---|---|
| K | `weekly_mam.week_1.K` |
| L | `sum(weekly_mam.L across weeks)` |
| M | `sum(weekly_mam.M across weeks)` |
| N | `L + M` |
| O1 to O4 | Sum each matching weekly discharge row. |
| O | `O1 + O2 + O3 + O4` |
| P | `sum(weekly_mam.P across weeks)` |
| Q | `O + P` |
| R | Last completed weekly `R`, and must also equal `K + N - Q`. |

### Other MAM

| Monthly field | Source or formula |
|---|---|
| S | `weekly_mam.week_1.S` |
| T | `sum(weekly_mam.T across weeks)` |
| U1 | `sum(weekly_mam.U1 across weeks)` |
| U2 | `sum(weekly_mam.U2 across weeks)` |
| U | `U1 + U2` |
| V | Last completed weekly `V`, and must also equal `S + T - U`. |

## SAM Performance Indicators

Use total monthly SAM discharges `F` as the denominator.

```text
cure_rate_percent = ((F1a + F1b) / F) * 100
death_rate_percent = ((F2a + F2b) / F) * 100
default_rate_percent = ((F3a + F3b) / F) * 100
non_recovered_rate_percent = ((F4a + F4b) / F) * 100
```

Standards shown on the form:

- Cure rate should be more than 75%.
- Death rate should be less than 10%.
- Default rate should be less than 15%.

If `F = 0`, do not divide by zero. Return `N/A` or `0%` according to the district instruction and flag that there were no discharges.

## Commodity Logic

For monthly commodity reporting:

```text
start_of_month = week_1.start_balance
quantity_received = sum(all weekly receipts)
quantity_issued_for_sam = sum(all weekly SAM issues)
quantity_issued_for_mam = sum(all weekly MAM issues)
end_of_month_balance = last completed weekly closing balance
```

Commodity balance check:

```text
end_balance = start_balance + received - issued_for_sam - issued_for_mam - approved_losses_or_adjustments
```

The reported end balance should agree with the stock card and physical count.

## Target And Coverage Logic

Use district-approved target values where available.

Practical SAM method:

```text
sam_total_children_at_facility = sam.A + sam.E
sam_coverage_percent = (sam_total_children_at_facility / estimated_target_with_sam) * 100
```

Practical MAM method:

```text
mam_total_children_at_facility = high_risk_mam.K + high_risk_mam.N + other_mam.S + other_mam.T
mam_coverage_percent = (mam_total_children_at_facility / estimated_target_with_mam) * 100
```

If a target is missing or zero, coverage should be `N/A` and flagged for review.

## Minimum App Logic Checks

An app should flag these as errors:

- Any required numeric field is blank instead of `0`.
- Any numeric field is negative.
- SAM `E`, `F`, `I`, or `J` does not match its formula.
- High-risk MAM `N`, `O`, `Q`, or `R` does not match its formula.
- Other MAM `U` or `V` does not match its formula.
- Weekly start balance does not equal previous week end balance.
- Monthly end balance does not equal last completed weekly end balance.

An app should flag these as warnings:

- Sex disaggregation does not equal the matching total.
- Commodity end balance does not match the stock card or physical count.
- Coverage target is missing or zero.
- A rate has denominator `0`.
