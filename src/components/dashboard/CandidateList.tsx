import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import type { Candidate, CandidateStatus } from '../../types/candidateType';
import { updateCandidateForUser } from '../../server/edge-functions/candidates/update-candidate';
import { deleteCandidateForUser } from '../../server/edge-functions/candidates/deleteCandidate';
import { supabase } from '../../server/supabaseClient';

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
    void load(true);

    const channel = supabase
      .channel('realtime-candidates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'candidates' },
        () => {
          void load(false);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
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
    const res = await deleteCandidateForUser(user.id, candidate.id);
    setActionLoadingId(null);

    if (res.error) {
      await Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        text: res.error,
      });
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: 'Deleted',
      timer: 800,
      showConfirmButton: false,
    });
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
    const res = await updateCandidateForUser(user.id, candidate.id, {
      status: nextStatus,
    });
    setActionLoadingId(null);

    if (res.error) {
      await Swal.fire({
        icon: 'error',
        title: 'Update failed',
        text: res.details?.join('\n') ?? res.error,
      });
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: 'Status updated',
      timer: 800,
      showConfirmButton: false,
    });
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