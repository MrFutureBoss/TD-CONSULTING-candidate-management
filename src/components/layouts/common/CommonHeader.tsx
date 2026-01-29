import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../../server/supabaseClient';


export default function CommonHeader() {
    const [session, setSession] = useState<Session | null>(null);

    useEffect(() => {
      let isMounted = true;

      supabase.auth.getSession().then(({ data }) => {
        if (!isMounted) return;
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

    const displayName =
      session?.user.user_metadata?.name ||
      session?.user.email ||
      (session ? session.user.id : null);

    return (
        <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 p-4">
          <Link className="font-semibold" to="/">
            Candidate Management
          </Link>

          <div className="ml-auto flex gap-3 text-sm text-gray-700">
            {session ? (
              <span className=" border border-zinc-500 rounded-xl px-2 py-1 text-sm text-blue-500">{displayName}</span>
            ) : (
              <>
                <Link className="hover:underline" to="/login">
                  Login
                </Link>
                <Link className="hover:underline" to="/register">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    )
}