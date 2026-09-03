import LogoutButton from './LogoutButton';
import { useUser } from '../../context/UserContext';

export default function UserMenu() {
  const { user } = useUser();
  if (!user || !user.email) return null;
  return (
    <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
      <span className="hidden max-w-32 truncate text-sm font-semibold text-slate-700 xl:block" title={user.email}>
        {user.firstName || user.email}
      </span>
      <LogoutButton />
    </div>
  );
}
