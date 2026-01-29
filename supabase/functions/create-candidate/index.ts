// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CandidateStatus = 'New' | 'Interviewing' | 'Hired';

const ALLOWED_STATUS: CandidateStatus[] = ['New', 'Interviewing', 'Hired'];

interface RequestBody {
  user_id?: string;
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
  const { user_id, full_name, applied_position, status, resume_url } = body;

  if (!user_id || user_id.trim().length === 0) {
    errors.push('user_id is required');
  }

  if (!full_name || full_name.trim().length === 0) {
    errors.push('full_name is required');
  }

  if (!applied_position || applied_position.trim().length === 0) {
    errors.push('applied_position is required');
  }

  if (!status || !ALLOWED_STATUS.includes(status)) {
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

  const { data, error } = await supabase
    .from('candidates')
    .insert({
      user_id,
      full_name,
      applied_position,
      status,
      resume_url: resume_url ?? null,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error inserting candidate (edge):', error);
    return new Response(
      JSON.stringify({
        data: null,
        error: 'Failed to create candidate',
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

