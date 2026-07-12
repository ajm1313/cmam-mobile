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

export interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  category: string;
  reorder_level: number;
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
  defaulters: number;
  facilities_count: number;
  total_cases: number;
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
  address: string;
  admission_criteria: string;
  admission_type: string;
  registration_date: string;
  z_score_wfh: number | null;
  z_score_wfa: number | null;
  z_score_hfa: number | null;
  appetite_test: string;
  medical_complications: boolean;
  complications_notes: string;
  outcome: string | null;
  discharge_date: string | null;
  outcome_notes: string | null;
  facility_code: string;
  created_by_name: string;
  visits: OpcVisit[];
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
  z_score_wfh: number | null;
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
  visit_outcome: string;
  outcome_notes: string;
  weight_change: number | null;
  food_product_type: string;
  staff_name: string;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}
