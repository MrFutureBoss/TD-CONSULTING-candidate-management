import supabase from '../../supabaseClient';
import type { Candidate, CandidateStatus, CreateCandidateInput, CreateCandidateResult } from '../../../types/candidateType';

  export const ALLOWED_CANDIDATE_STATUS: CandidateStatus[] = [
    'New',
    'Interviewing',
    'Hired',
  ];

export async function createCandidateForUser(
    userId: string,
    input: CreateCandidateInput,
  ): Promise<CreateCandidateResult> {
    const errors: string[] = [];
    const { full_name, applied_position, status, resume_url } = input;
  
    if (!userId) {
      errors.push('Missing userId');
    }
  
    if (!full_name || full_name.trim().length === 0) {
      errors.push('full_name is required');
    }
  
    if (!applied_position || applied_position.trim().length === 0) {
      errors.push('applied_position is required');
    }
  
    if (!status || !ALLOWED_CANDIDATE_STATUS.includes(status)) {
      errors.push(
        `status must be one of: ${ALLOWED_CANDIDATE_STATUS.join(', ')}`,
      );
    }
  
    if (errors.length > 0) {
      return {
        data: null,
        error: 'Validation failed',
        details: errors,
      };
    }
  
    const { data, error } = await supabase
      .from('candidates')
      .insert({
        user_id: userId,
        full_name,
        applied_position,
        status,
        resume_url: resume_url ?? null,
      })
      .select('*')
      .maybeSingle();
  
    if (error) {
      console.error('Error inserting candidate:', error);
      return {
        data: null,
        error: 'Failed to create candidate',
      };
    }
  
    return {
      data: data as Candidate,
      error: null,
    };
  }
  
