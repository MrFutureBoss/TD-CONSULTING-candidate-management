import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '../../server/supabaseClient';
import type { Candidate } from '../../types/candidateType';

export default function CandidateList() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (userError || !user) {
        setUserId(null);
        setCandidates([]);
        setError('Please login to see your candidates.');
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!isMounted) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setCandidates((data ?? []) as Candidate[]);
      setLoading(false);

      channel = supabase
        .channel(`candidates-by-user-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'candidates',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: RealtimePostgresChangesPayload<Candidate>) => {
            setCandidates((prev) => {
              const current = [...prev];

              if (payload.eventType === 'INSERT' && payload.new) {
                const next = [payload.new as Candidate, ...current];
                return next;
              }

              if (payload.eventType === 'UPDATE' && payload.new) {
                return current.map((c) =>
                  c.id === (payload.new as Candidate).id
                    ? (payload.new as Candidate)
                    : c,
                );
              }

              if (payload.eventType === 'DELETE' && payload.old) {
                return current.filter(
                  (c) => c.id !== (payload.old as Candidate).id,
                );
              }

              return current;
            });
          },
        )
        .subscribe();
    }

    void init();

    return () => {
      isMounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, []);

  if (loading) {
    return <p className="mt-6 text-sm text-gray-600">Loading candidates...</p>;
  }

  if (error && !userId) {
    return (
      <p className="mt-6 text-sm text-red-600">
        {error}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-base font-semibold">Table of candidates</h2>

      {candidates.length === 0 ? (
        <p className="text-sm text-gray-600">
          No candidates yet. Upload a resume to create one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-200 text-xs uppercase border-b px-3 py-2">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Full name</th>
                <th className="px-3 py-2 text-left">Position</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created at</th>
                <th className="px-3 py-2 text-left">Resume</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {candidates.map((c, index) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">
                    {c.full_name || '(No name)'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {c.applied_position || 'N/A'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {c.status ?? 'Unknown'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    {c.resume_url ? (
                      <a
                        href={c.resume_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">No file</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}