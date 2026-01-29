import { Link } from 'react-router-dom';


export default function CommonHeader() {
    return (
        <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 p-4">
          <Link className="font-semibold" to="/">
            Candidate Management
          </Link>
          <nav className="flex gap-3 text-sm text-gray-700">
            <Link className="hover:underline" to="/">
              Dashboard
            </Link>
            <Link className="hover:underline" to="/login">
              Login
            </Link>
            <Link className="hover:underline" to="/register">
              Register
            </Link>
          </nav>
        </div>
      </header>
    )
}