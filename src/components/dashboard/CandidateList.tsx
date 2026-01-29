import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import type { Candidate, CandidateStatus } from '../../types/candidateType';
import { supabase, SUPABASE_ANON_KEY } from '../../server/supabaseClient';

export default function CandidateList() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  async function load(showSpinner: boolean) {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setRows([]);
      if (showSpinner) {
        setLoading(false);
      }
      setError('Please login to see your candidates.');
      return;
    }

    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setRows([]);
      if (showSpinner) {
        setLoading(false);
      }
      return;
    }

    setRows((data ?? []) as Candidate[]);
    if (showSpinner) {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    let channel: any = null;

    async function setupRealtime() {
      await load(true);

      const { data } = await supabase.auth.getSession();
      const session = data.session ?? null;
      const userId = session?.user?.id ?? null;

      // Ensure realtime uses the latest auth token (if available)
      const realtimeAny = (supabase as any).realtime;
      if (realtimeAny?.setAuth) {
        realtimeAny.setAuth(session?.access_token ?? '');
      }

      if (!userId) return;

      channel = supabase
        .channel(`realtime-candidates-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'candidates',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            void load(false);
          },
        )
        .subscribe();
    }

    void setupRealtime();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!isMounted) return;

        const realtimeAny = (supabase as any).realtime;
        if (realtimeAny?.setAuth) {
          realtimeAny.setAuth(session?.access_token ?? '');
        }

        if (channel) {
          await supabase.removeChannel(channel);
          channel = null;
        }

        // Reload list for new auth state and recreate channel if logged in
        void load(false);

        const userId = session?.user?.id ?? null;
        if (!userId) return;

        channel = supabase
          .channel(`realtime-candidates-${userId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'candidates',
              filter: `user_id=eq.${userId}`,
            },
            () => {
              void load(false);
            },
          )
          .subscribe();
      },
    );

    return () => {
      isMounted = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
      authListener?.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(candidate: Candidate) {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete candidate?',
      text: 'This action cannot be undone.',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
    });

    if (!confirm.isConfirmed) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await Swal.fire({
        icon: 'error',
        title: 'Please login first',
      });
      return;
    }

    setActionLoadingId(candidate.id);
    const { data, error } = await supabase.functions.invoke('delete-candidate', {
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: { candidateId: candidate.id, userId: user.id },
    });
    setActionLoadingId(null);

    const edgeError = (data as any)?.error ?? error?.message ?? null;
    if (edgeError) {
      await Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        text: edgeError,
      });
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: 'Deleted',
      timer: 800,
      showConfirmButton: false,
    });
      void load(false);
  }

  async function handleUpdateStatus(candidate: Candidate) {
    const currentStatus: CandidateStatus = (candidate.status as CandidateStatus) ?? 'New';

    const { value: nextStatus, isConfirmed } = await Swal.fire<
      CandidateStatus | null
    >({
      title: 'Update status',
      input: 'select',
      inputValue: currentStatus,
      inputOptions: {
        New: 'New',
        Interviewing: 'Interviewing',
        Hired: 'Hired',
      },
      showCancelButton: true,
      confirmButtonText: 'Update',
    });

    if (!isConfirmed || !nextStatus || nextStatus === currentStatus) return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      await Swal.fire({
        icon: 'error',
        title: 'Please login first',
      });
      return;
    }

    setActionLoadingId(candidate.id);
    const { data, error } = await supabase.functions.invoke('update-candidate', {
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: {
        candidateId: candidate.id,
        status: nextStatus,
        userId: user.id,
      },
    });
    setActionLoadingId(null);

    const edgeError = (data as any)?.error ?? error?.message ?? null;
    if (edgeError) {
      await Swal.fire({
        icon: 'error',
        title: 'Update failed',
        text: (data as any)?.details?.join('\n') ?? edgeError,
      });
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: 'Status updated',
      timer: 800,
      showConfirmButton: false,
    });
      void load(false);
  }

  if (error) {
    return (
      <p className="mt-6 text-sm text-red-600">
        {error}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="mb-3 text-base font-semibold">Table of candidates</h2>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-gray-600">Loading candidates...</p>
      ) : rows.length === 0 ? (
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
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((c, index) => (
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
                  <td className="px-3 py-2 space-x-2 text-xs">
                    <button
                      type="button"
                      className="rounded border bg-white px-2 py-1"
                      disabled={actionLoadingId === c.id}
                      onClick={() => handleUpdateStatus(c)}
                    >
                      {actionLoadingId === c.id ? 'Saving...' : 'Update'}
                    </button>
                    <button
                      type="button"
                      className="rounded border bg-red-50 px-2 py-1 text-red-600"
                      disabled={actionLoadingId === c.id}
                      onClick={() => handleDelete(c)}
                    >
                      {actionLoadingId === c.id ? 'Deleting...' : 'Delete'}
                    </button>
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