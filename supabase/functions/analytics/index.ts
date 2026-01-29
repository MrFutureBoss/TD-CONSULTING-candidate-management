// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

type CandidateStatus = 'New' | 'Interviewing' | 'Hired';

interface RequestBody {
  userId?: string;
  days?: number;
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
    supabaseServiceKey || supabaseAnonKey,
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

  const { userId, days = 7 } = body;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: 'userId is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Total candidates
  const { count: totalCount, error: totalError } = await supabase
    .from('candidates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (totalError) {
    console.error('Error totalCount:', totalError);
    return new Response(
      JSON.stringify({ error: 'Failed to load total count', details: totalError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const total = totalCount ?? 0;

  // Status counts
  const statuses: CandidateStatus[] = ['New', 'Interviewing', 'Hired'];
  const statusCounts: Record<string, number> = {};

  for (const s of statuses) {
    const { count, error } = await supabase
      .from('candidates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', s);

    if (error) {
      console.error(`Error statusCount ${s}:`, error);
      return new Response(
        JSON.stringify({ error: 'Failed to load status counts', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    statusCounts[s] = count ?? 0;
  }

  const statusPercentages: Record<string, number> = {};
  for (const s of statuses) {
    statusPercentages[s] = total > 0 ? +((statusCounts[s] / total) * 100).toFixed(1) : 0;
  }

  // Top 3 positions
  const { data: allPositions, error: posError } = await supabase
    .from('candidates')
    .select('applied_position')
    .eq('user_id', userId);

  if (posError) {
    console.error('Error positions:', posError);
    return new Response(
      JSON.stringify({ error: 'Failed to load top positions', details: posError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const positionCounts: Record<string, number> = {};
  (allPositions || []).forEach((row: any) => {
    const key = row.applied_position || 'Unknown';
    positionCounts[key] = (positionCounts[key] || 0) + 1;
  });

  const topPositions = Object.entries(positionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([applied_position, count]) => ({ applied_position, count }));

  // Recent candidates in last N days
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentCandidates, error: recentError } = await supabase
    .from('candidates')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5);

  if (recentError) {
    console.error('Error recentCandidates:', recentError);
    return new Response(
      JSON.stringify({ error: 'Failed to load recent candidates', details: recentError.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return new Response(
    JSON.stringify({
      data: {
        totalCount: total,
        statusCounts,
        statusPercentages,
        topPositions,
        recentCandidates: recentCandidates ?? [],
      },
      error: null,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
