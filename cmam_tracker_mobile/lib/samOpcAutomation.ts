// ponytail: SAM OPC automation for mobile app
// Based on SAM_OPC_app_automation_spec.md

export interface SamData {
  age_months: number;
  weight_kg?: number;
  oedema?: string;
  appetite_test?: string;
  temperature_c?: number;
  respiratory_rate?: number;
  intractable_vomiting?: boolean;
  convulsions?: boolean;
  lethargic?: boolean;
  unconscious?: boolean;
  chest_indrawing?: boolean;
  severe_dehydration?: boolean;
  severe_pallor?: boolean;
  visit_number?: number;
  admission_weight?: number;
  registration_source?: string;
  muac_cm?: number;
  wflh_zscore?: number;
  previous_weight_kg?: number;
  days_between_visits?: number;
  weeks_in_treatment?: number;
  consecutive_recovery_visits?: number;
  clinically_well?: boolean;
  medical_investigation_done?: boolean;
  nutrition_education_completed?: boolean;
  immunization_updated?: boolean;
  linked_to_followup?: boolean;
  // Infant-specific fields
  breastfeeding_prospect?: string;
  effective_suckling?: string;
  relactation_needed?: boolean;
  visible_severe_wasting?: boolean;
}

export interface AutomationResult {
  needsAction: boolean;
  action?: 'R: Referral' | 'HV: Home Visit' | 'OK: Continue';
  actionType?: 'IPC_REFERRAL' | 'HOME_VISIT' | 'CONTINUE';
  priority?: 'critical' | 'high' | 'normal';
  severity?: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  reasons: string[];
}

// ponytail: IPC referral check - minimal logic
export function checkIpcReferral(data: SamData): AutomationResult {
  const reasons: string[] = [];
  
  // Infant under 6 months checks
  if (data.age_months < 6) {
    if (data.oedema && data.oedema !== 'None') {
      reasons.push('Infant has oedema');
    }
    if (data.appetite_test === 'Fail') {
      reasons.push('Infant unable to feed');
    }
  }
  
  // Children 6-59 months checks
  if (data.age_months >= 6) {
    if (data.oedema === '+++') reasons.push('Grade +++ oedema');
    if (data.appetite_test === 'Fail') reasons.push('Failed appetite test');
    if (data.intractable_vomiting) reasons.push('Intractable vomiting');
    if (data.convulsions) reasons.push('Convulsions');
    if (data.lethargic) reasons.push('Lethargic or not alert');
    if (data.unconscious) reasons.push('Unconscious');
    if (data.chest_indrawing) reasons.push('Chest indrawing');
    if (data.severe_dehydration) reasons.push('Severe dehydration');
    if (data.severe_pallor) reasons.push('Severe palmar pallor');
    if (data.weight_kg && data.age_months > 6 && data.weight_kg < 4) {
      reasons.push('Weight < 4kg');
    }
  }
  
  // Temperature checks (both age groups)
  if (data.temperature_c) {
    if (data.temperature_c > 39) reasons.push(`Temperature ${data.temperature_c}°C too high`);
    if (data.temperature_c < 35) reasons.push(`Temperature ${data.temperature_c}°C too low`);
  }
  
  // Respiratory rate checks (age-specific)
  if (data.respiratory_rate) {
    const rr = data.respiratory_rate;
    if (data.age_months < 2 && rr >= 60) reasons.push('High respiratory rate (≥60)');
    else if (data.age_months < 12 && rr >= 50) reasons.push('High respiratory rate (≥50)');
    else if (data.age_months < 60 && rr >= 40) reasons.push('High respiratory rate (≥40)');
    else if (data.age_months >= 60 && rr >= 30) reasons.push('High respiratory rate (≥30)');
  }
  
  if (reasons.length > 0) {
    return {
      needsAction: true,
      action: 'R: Referral',
      priority: 'critical',
      title: '⚠️ IPC Referral Required',
      message: 'This child should not be admitted to SAM OPC. The child meets criteria for inpatient care.',
      reasons
    };
  }
  
  return {
    needsAction: false,
    action: 'OK: Continue',
    priority: 'normal',
    title: '',
    message: '',
    reasons: []
  };
}

// ponytail: Visit action check
export function checkVisitActions(data: SamData): AutomationResult {
  // Check IPC referral first (priority 1)
  const ipcCheck = checkIpcReferral(data);
  if (ipcCheck.needsAction) return ipcCheck;
  
  // Check home visit triggers (priority 2)
  const hvReasons: string[] = [];
  
  if (data.visit_number === 3 && data.weight_kg && data.admission_weight) {
    if (data.weight_kg < data.admission_weight) {
      hvReasons.push('Below admission weight at week 3');
    }
  }
  
  if (hvReasons.length > 0) {
    return {
      needsAction: true,
      action: 'HV: Home Visit',
      priority: 'high',
      title: '🏠 Home Visit Needed',
      message: 'Schedule a follow-up home visit for this child.',
      reasons: hvReasons
    };
  }
  
  // No action needed
  return {
    needsAction: false,
    action: 'OK: Continue',
    priority: 'normal',
    title: '',
    message: '',
    reasons: []
  };
}

// ponytail: Get alert color based on priority
export function getAlertColors(priority: 'critical' | 'high' | 'normal') {
  switch (priority) {
    case 'critical':
      return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b' };
    case 'high':
      return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' };
    default:
      return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' };
  }
}

// ═══════════════════════════════════════════════════════════════
// ADVANCED AUTOMATION FEATURES
// ═══════════════════════════════════════════════════════════════

// 1. ADMISSION TYPE AUTO-SELECTION
export interface AdmissionTypeResult {
  admissionType: string;
  isNewCase: boolean;
}

export function getAdmissionType(registrationSource: string): AdmissionTypeResult {
  const mapping: Record<string, AdmissionTypeResult> = {
    'community': { admissionType: 'Direct from community', isNewCase: true },
    'self_referral': { admissionType: 'Direct from community', isNewCase: true },
    'cwc_or_outreach': { admissionType: 'Direct from community', isNewCase: true },
    'health_facility_referral': { admissionType: 'Referred from health facility', isNewCase: true },
    'inpatient_care_referral': { admissionType: 'Referred from inpatient care', isNewCase: false },
    'other_opc_transfer': { admissionType: 'Referred from health facility', isNewCase: false },
    'returned_defaulter': { admissionType: 'Re-enrolment/returned defaulter', isNewCase: false },
    'relapse_after_cure': { admissionType: 'Re-enrolment/relapse', isNewCase: true },
  };
  return mapping[registrationSource] || { admissionType: 'Direct from community', isNewCase: true };
}

// 2. REPORTING CATEGORY CLASSIFICATION
export function getReportingCategory(data: SamData): string {
  const { age_months, registration_source, oedema } = data;
  
  // Old case conditions (D category)
  if (registration_source && ['inpatient_care_referral', 'other_opc_transfer', 'returned_defaulter'].includes(registration_source)) {
    return 'D: Old case';
  }
  
  // Infant under 6 months at risk (B1)
  if (age_months < 6) {
    return 'B1: New SAM case under 6 months at risk';
  }
  
  // Children 6-59 months with oedema/marasmic kwashiorkor (B3)
  if (age_months >= 6 && age_months < 60) {
    if (oedema && oedema !== 'None') {
      return 'B3: New SAM case 6-59 months oedema/marasmic kwashiorkor';
    }
    return 'B2: New SAM case 6-59 months by MUAC/WFLH';
  }
  
  // 5 years or older (C category)
  if (age_months >= 60) {
    return 'C: Other new SAM case';
  }
  
  return 'B2: New SAM case 6-59 months by MUAC/WFLH';
}

// 3. DISCHARGE CRITERIA CHECK
export interface DischargeCriteria {
  eligible: boolean;
  category: string;
  reasons: string[];
  requirementsMet: Record<string, boolean>;
}

export function checkDischargeCriteria(data: SamData): DischargeCriteria {
  const result: DischargeCriteria = {
    eligible: false,
    category: 'Continue',
    reasons: [],
    requirementsMet: {}
  };
  
  // Check for non-recovered (16+ weeks)
  if (data.weeks_in_treatment && data.weeks_in_treatment >= 16) {
    if (!data.medical_investigation_done) {
      result.reasons.push('Medical investigation needed before classifying as non-recovered');
      return result;
    }
    result.eligible = true;
    result.category = 'NR: Non-Recovered';
    result.reasons.push('16+ weeks in treatment without meeting cure criteria');
    return result;
  }
  
  // Check cure criteria
  const cureChecks = {
    clinically_well: data.clinically_well || false,
    no_oedema: !data.oedema || data.oedema === 'None',
    muac_adequate: (data.muac_cm || 0) >= 12.5,
    sustained_recovery: (data.consecutive_recovery_visits || 0) >= 3,
    education_completed: data.nutrition_education_completed || false,
    immunization_updated: data.immunization_updated || false,
    community_linkage: data.linked_to_followup || false,
  };
  
  result.requirementsMet = cureChecks;
  
  if (Object.values(cureChecks).every(v => v === true)) {
    result.eligible = true;
    result.category = 'C: Cured';
    result.reasons.push('All cure criteria met');
  }
  
  return result;
}

// 4. WEIGHT TREND CALCULATION
export interface WeightTrend {
  changeGrams: number;
  changePercent: number;
  gainPerKgPerDay: number;
  trend: 'gaining' | 'static' | 'losing' | 'deteriorating' | 'unknown';
  isAdequate: boolean;
  color: string;
  icon: string;
}

export function calculateWeightTrend(
  currentWeight: number,
  previousWeight?: number,
  daysBetween?: number,
  admissionWeight?: number
): WeightTrend {
  if (!previousWeight || !daysBetween || daysBetween <= 0) {
    return {
      changeGrams: 0,
      changePercent: 0,
      gainPerKgPerDay: 0,
      trend: 'unknown',
      isAdequate: false,
      color: '#6b7280',
      icon: 'help-circle'
    };
  }
  
  const changeGrams = Math.round((currentWeight - previousWeight) * 1000);
  const changePercent = ((currentWeight - previousWeight) / previousWeight) * 100;
  const gainPerKgPerDay = (changeGrams / previousWeight) / daysBetween;
  
  let trend: WeightTrend['trend'];
  let isAdequate: boolean;
  let color: string;
  let icon: string;
  
  if (gainPerKgPerDay >= 5) {
    trend = 'gaining';
    isAdequate = true;
    color = '#16a34a';
    icon = 'trending-up';
  } else if (gainPerKgPerDay >= 0) {
    trend = 'static';
    isAdequate = false;
    color = '#f59e0b';
    icon = 'remove';
  } else if (gainPerKgPerDay >= -5) {
    trend = 'losing';
    isAdequate = false;
    color = '#dc2626';
    icon = 'trending-down';
  } else {
    trend = 'deteriorating';
    isAdequate = false;
    color = '#991b1b';
    icon = 'alert-circle';
  }
  
  return {
    changeGrams,
    changePercent: Math.round(changePercent * 100) / 100,
    gainPerKgPerDay: Math.round(gainPerKgPerDay * 100) / 100,
    trend,
    isAdequate,
    color,
    icon
  };
}

// 5. TASK PRIORITY COLORS
export function getTaskPriorityColor(priority: string) {
  switch (priority) {
    case 'critical':
      return { bg: '#fee2e2', border: '#dc2626', text: '#991b1b', badge: '#dc2626' };
    case 'high':
      return { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', badge: '#f59e0b' };
    case 'medium':
      return { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', badge: '#3b82f6' };
    case 'low':
      return { bg: '#f3f4f6', border: '#6b7280', text: '#374151', badge: '#6b7280' };
    default:
      return { bg: '#f3f4f6', border: '#6b7280', text: '#374151', badge: '#6b7280' };
  }
}

// 6. REGISTRATION SOURCE OPTIONS
export const REGISTRATION_SOURCE_OPTIONS = [
  { value: 'community', label: 'Direct from community' },
  { value: 'self_referral', label: 'Self referral' },
  { value: 'cwc_or_outreach', label: 'CWC or outreach' },
  { value: 'health_facility_referral', label: 'Health facility referral' },
  { value: 'inpatient_care_referral', label: 'Inpatient care referral' },
  { value: 'other_opc_transfer', label: 'Other OPC transfer' },
  { value: 'returned_defaulter', label: 'Returned defaulter' },
  { value: 'relapse_after_cure', label: 'Relapse after cure' },
];
