// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CandidateStatus = 'New' | 'Interviewing' | 'Hired';

interface RequestBody {
  userId?: string;
  search?: string;
  status?: CandidateStatus | CandidateStatus[];
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

function calculateRelevanceScore(candidate: any, searchTerm: string): number {
  if (!searchTerm) return 0;
  const term = searchTerm.toLowerCase();
  let score = 0;

  const name = (candidate.full_name || '').toLowerCase();
  const position = (candidate.applied_position || '').toLowerCase();

  if (name.includes(term)) {
    score += name.startsWith(term) ? 10 : 5;
  }
  if (position.includes(term)) {
    score += position.startsWith(term) ? 8 : 4;
  }

  const nameWords = name.split(/\s+/);
  const termWords = term.split(/\s+/);
  termWords.forEach((word) => {
    nameWords.forEach((nw) => {
      if (nw.startsWith(word)) score += 2;
      if (nw.includes(word)) score += 1;
    });
  });

  return score;
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

  const {
    userId,
    search,
    status,
    date_from,
    date_to,
    limit = 100,
    offset = 0,
  } = body;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'userId is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let query = supabase
    .from('candidates')
    .select('*')
    .eq('user_id', userId);

  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status);
    } else {
      query = query.eq('status', status);
    }
  }

  if (date_from) {
    query = query.gte('created_at', date_from);
  }

  if (date_to) {
    query = query.lte('created_at', date_to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error searching candidates:', error);
    return new Response(
      JSON.stringify({
        data: null,
        error: 'Failed to search candidates',
        details: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let results = (data || []) as any[];

  if (search) {
    results = results
      .map((candidate) => ({
        ...candidate,
        relevance: calculateRelevanceScore(candidate, search),
      }))
      .filter((candidate) => candidate.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);
  } else {
    results.sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return bDate - aDate;
    });
  }

  const total = results.length;
  const paginatedResults = results.slice(offset, offset + limit);

  return new Response(
    JSON.stringify({
      data: paginatedResults,
      total,
      limit,
      offset,
      error: null,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
