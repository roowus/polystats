import { Home, BarChart2, Users, Settings, Info, Trophy, Swords, CalendarDays, History } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/totw', icon: CalendarDays, label: 'Track of the Week' },
  { path: '/user', icon: Users, label: 'User Stats' },
  { path: '/compare', icon: Swords, label: 'Compare' },
  { path: '/history', icon: History, label: 'Record History' },
  { path: '/wr', icon: Trophy, label: 'World Records' },
  { path: '/leaderboard', icon: BarChart2, label: 'Leaderboard' },
  { path: '/utils', icon: Settings, label: 'Utils' },
  { path: '/how-to-use', icon: Info, label: 'How To' },
];

const Navigation = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b-2 border-white/12 bg-[#212b58]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="font-game text-base font-bold uppercase tracking-wider opacity-100 transition-opacity duration-200 hover:opacity-60"
          aria-label="PolyStats home"
        >
          <span className="whitespace-nowrap">
            <span className="text-white">Poly</span>
            <span className="text-[#7f9cf5]">Stats</span>
          </span>
        </button>

        <div className="flex h-full items-stretch gap-0.5 px-2">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = pathname === path || (path !== '/' && pathname.startsWith(path));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'pt-skew flex items-center px-3 text-[13px] font-semibold uppercase tracking-wide text-white transition-colors',
                  'border-0', // no borders — the full-height fill is the highlight
                  active ? 'bg-[#1a2450]' : 'hover:bg-white/10'
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden lg:inline">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
