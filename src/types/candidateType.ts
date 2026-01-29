export type CandidateStatus = 'New' | 'Interviewing' | 'Hired';

export interface Candidate {
    id: string; 
    user_id: string; 
    full_name: string | null;
    applied_position: string | null;
    status: CandidateStatus | null;
    resume_url: string | null;
    created_at: string; 
  }
  