import type { FormEventHandler } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../server/supabaseClient';
import Swal from 'sweetalert2';


export default function LoginForm() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);  

  const handleLogin: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    await Swal.fire({
      icon: 'success',
      title: 'Login success',
      timer: 1200,
      showConfirmButton: false,
    });
    navigate('/');
    setLoading(false);
  };

    return (
        <form className="mt-6 space-y-3" onSubmit={handleLogin}>
        <label className="block text-sm">
          <span className="text-gray-700">Email</span>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900/20"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="text-gray-700">Password</span>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-gray-900/20"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    )
}