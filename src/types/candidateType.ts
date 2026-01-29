export type CandidateStatus = 'New' | 'Interviewing' | 'Hired';

export const ALLOWED_CANDIDATE_STATUS: CandidateStatus[] = [
  'New',
  'Interviewing',
  'Hired',
];
export interface Candidate {
    id: string; 
    user_id: string; 
    full_name: string | null;
    applied_position: string | null;
    status: CandidateStatus | null;
    resume_url: string | null;
    created_at: string; 
  }
  
  export interface CreateCandidateInput {
    full_name?: string;
    applied_position?: string;
    status?: CandidateStatus;
    resume_url?: string;
  }
  
  export interface CreateCandidateResult {
    data: Candidate | null;
    error: string | null;
    details?: string[];
  }