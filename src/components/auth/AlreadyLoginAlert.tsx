import type { Session } from '@supabase/supabase-js';

type AlreadyLoginAlertProps = {
  session: Session;
  error: string | null;
  loading: boolean;
  onLogout: () => void;
};

export default function AlreadyLoginAlert({ session, error, loading, onLogout }: AlreadyLoginAlertProps) {
    return (
        <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-gray-50 p-3 text-sm">
              <div className="font-medium">Signed in</div>
              <div className="text-gray-700 break-all">
                {session.user.email ?? session.user.id}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={onLogout}
              disabled={loading}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
            >
              {loading ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
    )
}