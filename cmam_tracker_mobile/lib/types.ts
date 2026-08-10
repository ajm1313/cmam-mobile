export interface UserRole {
  id: number;
  name: string;
  role_name?: string;
  display_name?: string;
  level: number;
}

export interface UserLocation {
  region_id: number | null;
  region_name: string | null;
  district_id: number | null;
  district_name: string | null;
  facility_id: number | null;
  facility_name: string | null;
  facility_type: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  profile_picture: string | null;
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  is_facility_level_only?: boolean;
  can_import_export?: boolean;
  role: UserRole;
  location: UserLocation;
  created_at: string | null;
}

export interface Facility {
  id: number;
  name: string;
  code?: string;
  type: string;
  district_name?: string;
  region_name?: string;
  is_active: boolean;
}

export interface Region {
  id: number;
  name: string;
  code?: string;
  district_count?: number;
}

export interface District {
  id: number;
  name: string;
  code?: string;
  region_id: number;
  region_name?: string;
}

export interface SubDistrict {
  id: number;
  name: string;
  code?: string;
  district_id: number;
  district_name?: string;
  region_name?: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  unit_of_measure?: string;
  category: string;
  conversion_factor?: string | number;
  reorder_level?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  has_expiry?: boolean;
  is_active: boolean;
}

export interface StockLevel {
  id: number;
  inventory_item: InventoryItem;
  current_balance: number;
  location_type: string;
  last_updated: string;
}

export type LocationLevel = 'national' | 'regional' | 'district' | 'facility';

export interface StockMovement {
  id: number;
  inventory_item: InventoryItem;
  movement_type: string;
  quantity: number;
  notes: string;
  movement_date: string;
  created_by_name?: string;
  source_type?: LocationLevel;
  source_region_id?: number | null;
  source_district_id?: number | null;
  source_facility_id?: number | null;
  destination_type?: LocationLevel;
  destination_region_id?: number | null;
  destination_district_id?: number | null;
  destination_facility_id?: number | null;
  source?: string;
  destination?: string;
  reference_number?: string;
}

export interface DashboardStats {
  total_sam: number;
  total_mam: number;
  active_sam: number;
  active_mam: number;
  discharged_this_month: number;
  total_discharged: number;
  defaulters: number;
  facilities_count: number;
  total_cases: number;
  total_all_cases: number;
  active_cases: number;
}

export interface OpcCase {
  id: number;
  registration_number: string;
  child_name: string;
  child_gender: string;
  date_of_birth: string;
  age_months: number;
  malnutrition_type: 'SAM' | 'MAM';
  mam_type?: string;
  status: string;
  admission_date: string;
  facility_name: string;
  facility_id: number;
  weight_kg: number;
  height_cm: number;
  muac_cm: number | null;
  oedema: string | null;
  visit_count: number;
  latest_visit_date: string | null;
  next_visit_date: string | null;
  is_visit_due: boolean;
}

export interface OpcCaseDetail extends OpcCase {
  caregiver_name: string;
  caregiver_phone: string;
  caregiver_relationship: string;
  total_household_members: number | null;
  address: string;
  admission_criteria: string;
  admission_type: string;
  registration_date: string;
  z_score_wfh: string | null;
  z_score_wfa: string | null;
  z_score_hfa: string | null;
  appetite_test: string;
  medical_complications: boolean;
  complications_notes: string;
  outcome: string | null;
  discharge_date: string | null;
  outcome_notes: string | null;
  facility_code: string;
  created_by_name: string;
  visits: OpcVisit[];
  rutf_sachets_given: number | null;
  rutf_ration_per_day: number | null;
  amoxicillin_date: string | null;
  amoxicillin_dosage: string | null;
  vitamin_a_date: string | null;
  vitamin_a_dosage: string | null;
  folic_acid_date: string | null;
  folic_acid_dosage: string | null;
  deworming_date: string | null;
  deworming_dosage: string | null;
  measles_vaccine_date: string | null;
  measles_vaccine_dosage: string | null;
  malaria_test_date: string | null;
  malaria_test_result: string | null;
  antimalarial_date: string | null;
  antimalarial_dosage: string | null;
  additional_notes: string | null;
  child_photo: string | null;
  registration_latitude: string | null;
  registration_longitude: string | null;
  // Demographic/social
  father_alive: string | null;
  mother_alive: string | null;
  house_location: string | null;
  travel_time: string | null;
  referral_source: string | null;
  // Medical History
  diarrhoea: string | null;
  stool_frequency: string | null;
  vomiting: string | null;
  cough: string | null;
  passing_urine: string | null;
  oedema_duration_days: string | null;
  breastfeeding_status: string | null;
  breastfeeding_prospect: string | null;
  immunization_status: string | null;
  g6pd_status: string | null;
  additional_medical_history: string | null;
  // Physical Examination
  respiratory_rate: string | null;
  temperature_celsius: string | null;
  chest_indrawing: string | null;
  eyes_condition: string | null;
  conjunctiva: string | null;
  ears_condition: string | null;
  mouth_condition: string | null;
  lymph_nodes: string | null;
  hands_feet: string | null;
  skin_changes: string | null;
  disability: string | null;
  disability_details: string | null;
  physical_exam_notes: string | null;
  // Other Medicines
  other_drug_1: string | null;
  other_drug_1_date: string | null;
  other_drug_1_dosage: string | null;
  other_drug_2: string | null;
  other_drug_2_date: string | null;
  other_drug_2_dosage: string | null;
  other_drug_3: string | null;
  other_drug_3_date: string | null;
  other_drug_3_dosage: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpcVisit {
  id: number;
  registration: number;
  visit_number: number;
  visit_date: string;
  visit_type: string;
  weight_kg: number;
  weight_lost: boolean;
  height_cm: number | null;
  muac_cm: number | null;
  z_score_wfh: string | null;
  z_score_wfa: string | null;
  z_score_hfa: string | null;
  oedema: string | null;
  diarrhoea_days: number | null;
  vomiting_days: number | null;
  fever_days: number | null;
  cough_days: number | null;
  temperature: number | null;
  respiratory_rate: number | null;
  dehydrated: boolean;
  anaemia_palmar_pallor: boolean;
  skin_infection: boolean;
  appetite: string;
  rutf_test: string;
  breastfeeding_status: string;
  general_condition: string;
  has_complications: boolean;
  complications_notes: string;
  medical_notes: string;
  rutf_sachets_given: number | null;
  csb_plus_given: number | null;
  oil_given: number | null;
  other_supplies: string | null;
  other_medication: string | null;
  food_product_type: string;
  food_product_quantity: string | null;
  staff_name: string;
  counseling_topics: string | null;
  caregiver_understanding: string | null;
  next_visit_date: string | null;
  treatment_response: string | null;
  visit_outcome: string;
  outcome_notes: string;
  action_needed: boolean;
  home_visit_needed: boolean;
  home_visit_date: string | null;
  home_visit_notes: string | null;
  community_volunteer: string | null;
  weight_change: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export type IpcCaseStatus = 'Admitted' | 'Discharged' | 'Death' | 'Defaulted' | 'Transfer';

export interface IpcCase {
  id: number;
  facility: number;
  facility_name: string;
  patient_name: string;
  patient_age: number;
  gender: string;
  admission_date: string;
  weight: number;
  height: number;
  muac: number | null;
  status: IpcCaseStatus;
  created_at: string;
}

export type CaseTaskType =
  | 'ipc_referral' | 'home_visit' | 'appetite_test'
  | 'amoxicillin_treatment' | 'malaria_test' | 'deworming'
  | 'measles_vaccine' | 'medical_investigation' | 'discharge_counseling'
  | 'community_linkage' | 'nutrition_education' | 'immunization_check'
  | 'rutf_ration' | 'weight_monitoring' | 'oedema_check';

export type CaseTaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type CaseTaskStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

export interface CaseTask {
  id: number;
  case: number;
  task_type: CaseTaskType;
  title: string;
  description: string;
  priority: CaseTaskPriority;
  status: CaseTaskStatus;
  due_date: string | null;
  completed_at: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}
