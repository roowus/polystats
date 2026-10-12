import { Home, BarChart2, Users, Settings, Info, Trophy, Swords, CalendarDays } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BrandMark } from './BrandMark';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/totw', icon: CalendarDays, label: 'Track of the Week' },
  { path: '/user', icon: Users, label: 'User Stats' },
  { path: '/compare', icon: Swords, label: 'Compare' },
  { path: '/wr', icon: Trophy, label: 'World Records' },
  { path: '/leaderboard', icon: BarChart2, label: 'Leaderboard' },
  { path: '/utils', icon: Settings, label: 'Utils' },
  { path: '/how-to-use', icon: Info, label: 'How To' },
];

const Navigation = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b-2 border-white/12 bg-[#10102a]">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 font-game text-base font-bold uppercase tracking-wider"
          aria-label="PolyStats home"
        >
          <BrandMark />
          <span className="text-white">Poly</span>
          <span className="text-[#7f9cf5]">Stats</span>
        </button>

        <div className="flex items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = pathname === path || (path !== '/' && pathname.startsWith(path));
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={cn(
                  'pt-skew relative px-2.5 py-1.5 text-[13px] font-semibold uppercase tracking-wide transition-colors',
                  active
                    ? 'bg-[#112052] text-white ring-2 ring-white/30'
                    : 'text-zinc-400 hover:text-white hover:bg-white/8'
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
