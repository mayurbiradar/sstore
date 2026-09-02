import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function LogoutButton() {
  const navigate = useNavigate();
  const { logout } = useUser();
  const onLogout = async () => {
    await logout();
    navigate('/login', { state: {} });
  };
  return (
    <button
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
      onClick={onLogout}
      title="Sign out"
    >
      Sign out
    </button>
  );
}
