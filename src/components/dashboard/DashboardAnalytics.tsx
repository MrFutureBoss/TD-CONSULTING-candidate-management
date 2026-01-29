import { useEffect, useState } from 'react';
import type { Candidate } from '../../types/candidateType';
import { supabase, SUPABASE_ANON_KEY } from '../../server/supabaseClient';

type StatusKey = 'New' | 'Interviewing' | 'Hired';

interface AnalyticsData {
  totalCount: number;
  statusCounts: Record<StatusKey, number>;
  statusPercentages: Record<StatusKey, number>;
  topPositions: { applied_position: string; count: number }[];
  recentCandidates: Candidate[];
}

export default function DashboardAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    async function loadAnalytics(showSpinner: boolean) {
      if (showSpinner) {
        setLoading(true);
      }
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (userError || !user) {
        setError('Please login to see analytics.');
        setData(null);
        if (showSpinner) {
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase.functions.invoke('analytics', {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: {
          userId: user.id,
        },
      });

      if (!isMounted) return;

      if (error || (data && (data as any).error)) {
        const errMsg =
          (data as any)?.error ??
          (data as any)?.details ??
          error?.message ??
          'Failed to load analytics.';
        setError(String(errMsg));
        setData(null);
        if (showSpinner) {
          setLoading(false);
        }
        return;
      }

      setData((data as any).data as AnalyticsData);
      if (showSpinner) {
        setLoading(false);
      }
    }

    async function setupRealtime() {
      await loadAnalytics(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session ?? null;
      const userId = session?.user?.id ?? null;

      const realtimeAny = (supabase as any).realtime;
      if (realtimeAny?.setAuth) {
        realtimeAny.setAuth(session?.access_token ?? '');
      }

      if (!userId) return;

      channel = supabase
        .channel(`realtime-analytics-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'candidates',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            if (!isMounted) return;
            void loadAnalytics(false);
          },
        )
        .subscribe();
    }

    void setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="mb-4 rounded-xl border bg-white p-4 text-sm text-gray-600">
        Loading analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-4 rounded-xl border bg-white p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { totalCount, statusCounts, statusPercentages, topPositions, recentCandidates } = data;

  return (
    <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-base font-semibold">Analytics</h2>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="rounded border px-3 py-2 text-sm">
          <div className="text-xs text-gray-500">Total candidates</div>
          <div className="mt-1 text-xl font-semibold">{totalCount}</div>
        </div>

        <div className="rounded border px-3 py-2 text-sm">
          <div className="text-xs text-gray-500">Status</div>
          <div className="mt-1 space-y-1 text-xs text-gray-700">
            {(['New', 'Interviewing', 'Hired'] as StatusKey[]).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span>{s}</span>
                <span>
                  {statusCounts[s] ?? 0} ({statusPercentages[s] ?? 0}
                  %)
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border px-3 py-2 text-sm">
          <div className="text-xs text-gray-500">Top positions</div>
          <ul className="mt-1 space-y-1 text-xs text-gray-700">
            {topPositions.length === 0 ? (
              <li>No data</li>
            ) : (
              topPositions.map((p) => (
                <li key={p.applied_position} className="flex items-center justify-between">
                  <span>{p.applied_position || 'Unknown'}</span>
                  <span>{p.count}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {recentCandidates.length > 0 && (
        <div className="mt-2">
          <div className="mb-2 text-xs uppercase text-gray-500">
            Top 5 newest candidates in last 7 days
          </div>
          <div className="overflow-x-auto rounded-lg border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-200 text-xs uppercase border-b px-3 py-2">
                <tr>
                  <th className="px-3 py-2 text-left">Full name</th>
                  <th className="px-3 py-2 text-left">Position</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Created at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{c.full_name || '(No name)'}</td>
                    <td className="px-3 py-2 text-gray-700">{c.applied_position || 'N/A'}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {c.status ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

