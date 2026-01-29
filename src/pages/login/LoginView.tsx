import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../server/supabaseClient';
import AlreadyLoginAlert from '../../components/auth/AlreadyLoginAlert';
import LoginForm from '../../components/auth/LoginForm';

export default function LoginView() {
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let isMounted = true;

      supabase.auth.getSession().then(({ data, error }) => {
        if (!isMounted) return;
        if (error) setError(error.message);
        setSession(data.session ?? null);
      });

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });

      return () => {
        isMounted = false;
        subscription.subscription.unsubscribe();
      };
    }, []);

    async function handleLogout() {
      setError(null);
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) setError(error.message);
      setLoading(false);
    }

    return (
      <div className="p-4">
      <h1 className="text-lg font-semibold">{session ? 'Already logged in' : 'Login to your account'}</h1>
          {session ? (
            <AlreadyLoginAlert
              session={session}
              error={error}
              loading={loading}
              onLogout={handleLogout}
            />
          ) : (
            <LoginForm />
          )}
            </div>
    )
}