import type { FormEventHandler } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { supabase } from '../../server/supabaseClient';

export default function RegisterForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
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
      title: 'Register success',
      timer: 1200,
      showConfirmButton: false,
    });

    navigate('/');
    setLoading(false);
  };

  return (
    <form className="mt-4 space-y-3" onSubmit={handleRegister}>
      <label className="block text-left">
        <span>Email</span>
        <input
          className="mt-1 w-full border px-3 py-2"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className="block text-left">
        <span>Password</span>
        <input
          className="mt-1 w-full border px-3 py-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>

      {error && (
        <div className="border border-red-300 p-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}