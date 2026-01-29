// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CandidateStatus = 'New' | 'Interviewing' | 'Hired';

const ALLOWED_STATUS: CandidateStatus[] = ['New', 'Interviewing', 'Hired'];

interface RequestBody {
  candidateId?: string;
  userId?: string;
  full_name?: string;
  applied_position?: string;
  status?: CandidateStatus;
  resume_url?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(
    supabaseUrl,
    supabaseServiceKey || supabaseAnonKey
  );

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const errors: string[] = [];
  const { candidateId, userId, full_name, applied_position, status, resume_url } =
    body;

  if (!candidateId) {
    errors.push('candidateId is required');
  }

  if (!userId) {
    errors.push('userId is required');
  }

  if (full_name !== undefined && full_name.trim().length === 0) {
    errors.push('full_name cannot be empty when provided');
  }

  if (
    applied_position !== undefined &&
    applied_position.trim().length === 0
  ) {
    errors.push('applied_position cannot be empty when provided');
  }

  if (status !== undefined && !ALLOWED_STATUS.includes(status)) {
    errors.push(
      `status must be one of: ${ALLOWED_STATUS.join(', ')}`,
    );
  }

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({
        data: null,
        error: 'Validation failed',
        details: errors,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
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
    console.error('Error updating candidate (edge):', error);
    return new Response(
      JSON.stringify({
        data: null,
        error: 'Failed to update candidate',
        details: error.message,
        code: (error as any).code,
        hint: (error as any).hint,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      data,
      error: null,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

