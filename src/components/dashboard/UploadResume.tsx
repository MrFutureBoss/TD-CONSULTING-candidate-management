import type { FormEventHandler } from 'react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../../server/supabaseClient';
import { createCandidateForUser } from '../../server/edge-functions/candidates/create-candidate';

const MAX_RESUME_BYTES = 10 * 1024 * 1024;

//This function is used to handle the special characters in the file name
function toSafeStorageFileName(originalName: string) {
  const lastDot = originalName.lastIndexOf('.');
  const base = lastDot > 0 ? originalName.slice(0, lastDot) : originalName;
  const ext = lastDot > 0 ? originalName.slice(lastDot).toLowerCase() : '.pdf';

  const noDiacritics = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');

  const safeBase = noDiacritics
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  const finalExt = ext === '.pdf' ? '.pdf' : '.pdf';
  return `${safeBase || 'resume'}${finalExt}`;
}

export default function UploadResume({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [appliedPosition, setAppliedPosition] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        await Swal.fire({ icon: 'error', title: 'Please login first' });
        return;
      }

      if (!file) {
        await Swal.fire({ icon: 'error', title: 'Please choose a CV file' });
        return;
      }

      const isPdfByName = file.name.toLowerCase().endsWith('.pdf');
      const isPdfByType = !file.type || file.type === 'application/pdf';
      if (!isPdfByName || !isPdfByType) {
        await Swal.fire({ icon: 'error', title: 'PDF only' });
        return;
      }

      if (file.size > MAX_RESUME_BYTES) {
        await Swal.fire({ icon: 'error', title: 'File too large (max 10MB)' });
        return;
      }

      const safeName = toSafeStorageFileName(file.name);
      const path = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('resumes')
        .upload(path, file, {
          upsert: false,
          contentType: file.type || 'application/octet-stream',
        });

      if (uploadError) {
        await Swal.fire({
          icon: 'error',
          title: 'Upload failed',
          text: uploadError.message,
        });
        return;
      }

      const { data: publicData } = supabase.storage
        .from('resumes')
        .getPublicUrl(path);

      const resumeUrl = publicData.publicUrl;

      const result = await createCandidateForUser(user.id, {
        full_name: fullName,
        applied_position: appliedPosition,
        status: 'New',
        resume_url: resumeUrl,
      });

      if (result.error) {
        await Swal.fire({
          icon: 'error',
          title: 'Create candidate failed',
          text: result.details?.join('\n') ?? result.error,
        });
        return;
      }

      await Swal.fire({
        icon: 'success',
        title: 'Created candidate',
        timer: 1200,
        showConfirmButton: false,
      });

      setFullName('');
      setAppliedPosition('');
      setFile(null);
      onCreated?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Upload Resume</h2>
      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <label className="grid gap-1 text-sm">
          <span className="text-gray-700">Full name</span>
          <input
            className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900/20"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-gray-700">Applied position</span>
          <input
            className="rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900/20"
            value={appliedPosition}
            onChange={(e) => setAppliedPosition(e.target.value)}
            required
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-red-500 italic font-bold my-4">(*) PDF only and limit 10MB</span>
          <div className="flex items-center gap-3">
            <input
              id="resume-file"
              className="sr-only"
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const next = e.currentTarget.files?.[0] ?? null;
                if (!next) {
                  setFile(null);
                  return;
                }

                const isPdfByName = next.name.toLowerCase().endsWith('.pdf');
                const isPdfByType = !next.type || next.type === 'application/pdf';
                if (!isPdfByName || !isPdfByType) {
                  e.currentTarget.value = '';
                  setFile(null);
                  void Swal.fire({ icon: 'error', title: 'PDF only' });
                  return;
                }

                if (next.size > MAX_RESUME_BYTES) {
                  e.currentTarget.value = '';
                  setFile(null);
                  void Swal.fire({ icon: 'error', title: 'File too large (max 10MB)' });
                  return;
                }

                setFile(next);
              }}
              required
            />
            <label
              htmlFor="resume-file"
              className="cursor-pointer rounded-lg border-none bg-gray-300 px-2 py-1 text-sm hover:bg-gray-50 hover:border hover:border-dashed"
            >
              Choose file
            </label>
            <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
              {file ? file.name : 'No file chosen'}
            </span>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-1 w-fit rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {loading ? 'Saving...' : 'Upload & Create'}
        </button>
      </form>
    </div>
  );
}

