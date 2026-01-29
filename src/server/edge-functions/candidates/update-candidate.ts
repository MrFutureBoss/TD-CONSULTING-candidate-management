import type { Candidate, CandidateStatus } from '../../../types/candidateType';
import type { CreateCandidateInput, CreateCandidateResult } from '../../../types/candidateType';
import { supabase } from '../../supabaseClient';

const ALLOWED_CANDIDATE_STATUS: CandidateStatus[] = [
    'New',
    'Interviewing',
    'Hired',
  ];

export async function updateCandidateForUser(
  userId: string,
  candidateId: string,
  input: Partial<CreateCandidateInput>,
): Promise<CreateCandidateResult> {
  const errors: string[] = [];

  if (!userId) {
    errors.push('Missing userId (user must be authenticated).');
  }

  if (!candidateId) {
    errors.push('Missing candidateId.');
  }

  const { full_name, applied_position, status, resume_url } = input;

  if (full_name !== undefined && full_name.trim().length === 0) {
    errors.push('full_name cannot be empty when provided');
  }

  if (
    applied_position !== undefined &&
    applied_position.trim().length === 0
  ) {
    errors.push('applied_position cannot be empty when provided');
  }

  if (status !== undefined && !ALLOWED_CANDIDATE_STATUS.includes(status)) {
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

  const updatePayload: Record<string, unknown> = {};
  if (full_name !== undefined) updatePayload.full_name = full_name;
  if (applied_position !== undefined) {
    updatePayload.applied_position = applied_position;
  }
  if (status !== undefined) updatePayload.status = status;
  if (resume_url !== undefined) updatePayload.resume_url = resume_url;

  const { data, error } = await supabase
    .from('candidates')
    .update(updatePayload)
    .eq('id', candidateId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error updating candidate:', error);
    return {
      data: null,
      error: 'Failed to update candidate',
    };
  }

  return {
    data: data as Candidate,
    error: null,
  };
}

