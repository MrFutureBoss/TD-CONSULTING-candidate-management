import supabase from '../../supabaseClient';

export interface DeleteCandidateResult {
  success: boolean;
  error: string | null;
}

export async function deleteCandidateForUser(
  userId: string,
  candidateId: string,
): Promise<DeleteCandidateResult> {
  const errors: string[] = [];

  if (!userId) {
    errors.push('Missing userId (user must be authenticated).');
  }

  if (!candidateId) {
    errors.push('Missing candidateId.');
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: errors.join(' | '),
    };
  }

  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', candidateId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting candidate:', error);
    return {
      success: false,
      error: 'Failed to delete candidate',
    };
  }

  return {
    success: true,
    error: null,
  };
}

