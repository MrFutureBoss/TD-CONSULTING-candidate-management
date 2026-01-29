import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import type { Candidate, CandidateStatus } from '../../types/candidateType';
import { supabase, SUPABASE_ANON_KEY } from '../../server/supabaseClient';

interface FilterState {
  search: string;
  status: CandidateStatus | '';
  date_from: string;
  date_to: string;
}

export default function CandidateList() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: '',
    date_from: '',
    date_to: '',
  });

  async function load(showSpinner: boolean, useFilters = false) {
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

    if (useFilters && (filters.search || filters.status || filters.date_from || filters.date_to)) {
      const { data, error } = await supabase.functions.invoke('search-candidates', {
        headers: {
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: {
          userId: user.id,
          search: filters.search || undefined,
          status: filters.status || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
        },
      });

      if (error || (data && (data as any).error)) {
        const errMsg = (data as any)?.error ?? error?.message ?? 'Unknown error';
        setError(errMsg);
        setRows([]);
        if (showSpinner) {
          setLoading(false);
        }
        return;
      }

      setRows((data?.data ?? []) as Candidate[]);
      if (showSpinner) {
        setLoading(false);
      }
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

  function handleFilterChange(key: keyof FilterState, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleResetFilters() {
    setFilters({
      search: '',
      status: '',
      date_from: '',
      date_to: '',
    });
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

  useEffect(() => {
    const hasFilters = !!(filters.search || filters.status || filters.date_from || filters.date_to);
    void load(false, hasFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search, filters.status, filters.date_from, filters.date_to]);

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

      <div className="mb-4 rounded-lg border bg-white p-4">
        <div className="mb-3 text-sm font-semibold">Filter & Search</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs text-gray-700">Search (Full-text)</label>
            <input
              type="text"
              placeholder="Search name, position..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="filter-status" className="mb-1 block text-xs text-gray-700">Status</label>
            <select
              id="filter-status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm"
            >
              <option value="">All</option>
              <option value="New">New</option>
              <option value="Interviewing">Interviewing</option>
              <option value="Hired">Hired</option>
            </select>
          </div>
          <div>
            <label htmlFor="filter-date-from" className="mb-1 block text-xs text-gray-700">Date From</label>
            <input
              id="filter-date-from"
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label htmlFor="filter-date-to" className="mb-1 block text-xs text-gray-700">Date To</label>
            <input
              id="filter-date-to"
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>
        <div className="mt-3">
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded border bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-gray-600">Loading candidates...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">
          No candidates found. {filters.search || filters.status || filters.date_from || filters.date_to ? 'Try adjusting your filters.' : 'Upload a resume to create one.'}
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