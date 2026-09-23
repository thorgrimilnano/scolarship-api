export interface ScholarshipRequirements {
  essay_required: boolean;
  transcript_required: boolean;
  recommendation_required: boolean;
  interview_required: boolean;
  financial_need_required: boolean;
  test_scores_required: boolean;
  photo_required: boolean;
  resume_required: boolean;
  community_service_required: boolean;
  contest_entry_required: boolean;
  application_form_required: boolean;
  application_fee_required: boolean;
  portfolio_required: boolean;
  drivers_license_required: boolean;
  autobiography_required: boolean;
  military_service_required: boolean;
  special_requirements_flag: boolean;
}

export interface ScholarshipEligibility {
  min_gpa: number | null;
  age_min: number | null;
  age_max: number | null;
  grade_level: string | null;
  gender: 'Female' | 'Male' | null;
  ethnicity: string | null;
  has_state_restriction: boolean;
  states: string[];
  institution_types: string[];
  citizenships: string[];
  military_branches: string[];
  disability_types: string[];
}

export interface Scholarship {
  id: number;
  slug: string;
  name: string;
  provider_name: string | null;
  description: string | null;
  source_url: string | null;
  apply_url: string | null;
  application_method: 'Online' | 'Email' | null;
  contact_email: string | null;
  amount: {
    min: number | null;
    max: number | null;
    type: 'fixed' | 'varies' | null;
  };
  num_awards: number | null;
  deadline: {
    mmdd: string | null;
    type: 'fixed_annual' | 'rolling' | 'varies' | null;
  };
  eligibility: ScholarshipEligibility;
  requirements: ScholarshipRequirements;
  extra_criteria: string[];
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

export interface FacetValue {
  name: string;
  count: number;
}

export interface Facets {
  states: FacetValue[];
  institution_types: FacetValue[];
  citizenships: FacetValue[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
