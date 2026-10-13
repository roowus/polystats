import { useNavigate } from 'react-router-dom';
import {
  Users, Settings, ExternalLink, Swords, Trophy, CalendarDays, BarChart2, ArrowRight,
} from 'lucide-react';
import Navigation from './Navigation';
import { PageShell, Panel } from './shell';

const FEATURES = [
  {
    title: 'Track of the Week',
    description: 'This week’s community spotlight — live leaderboard, cover art, and a countdown to rotation.',
    icon: CalendarDays,
    path: '/totw',
  },
  {
    title: 'User Statistics',
    description: 'Full per-player breakdown: ranks, WR gaps, medals and percentiles across every track.',
    icon: Users,
    path: '/user',
  },
  {
    title: 'Compare Players',
    description: 'Head-to-head on every shared track, with per-track deltas and a winner for each.',
    icon: Swords,
    path: '/compare',
  },
  {
    title: 'World Records',
    description: 'Every verified world record — official, community and Track of the Week — in one table.',
    icon: Trophy,
    path: '/wr',
  },
  {
    title: 'Leaderboards',
    description: 'Browse any track’s full leaderboard with pagination, verified filters and ghost playback.',
    icon: BarChart2,
    path: '/leaderboard',
  },
  {
    title: 'Utils',
    description: 'Find a User ID from a token or a rank, decode car colors, and more.',
    icon: Settings,
    path: '/utils',
  },
];

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#10102a] text-zinc-100">
      <Navigation />
      <PageShell className="max-w-5xl">
        {/* Hero */}
        <div className="mb-12 text-center">
          <h1 className="font-game text-4xl font-bold uppercase tracking-wide sm:text-5xl">
            <span className="text-white">Poly</span>
            <span className="text-[#7f9cf5]">Stats</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base">
            Deep statistics for{' '}
            <a
              href="https://www.kodub.com/apps/polytrack"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 underline-offset-2 hover:underline"
            >
              PolyTrack
            </a>{' '}
            — player profiles, world records, Track of the Week and head-to-head
            comparisons, powered by the live leaderboards.
          </p>
        </div>

        {/* Feature grid */}
        <div className="pt-enter grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, description, icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="group border border-white/10 bg-[rgba(20,20,45,0.6)] p-5 text-left backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-[rgba(28,28,62,0.7)]"
            >
              <div className="mb-3 inline-flex bg-[#112052] p-2.5 text-[#bed8f7]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="flex items-center gap-1.5 font-semibold">
                {title}
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-300" />
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{description}</p>
            </button>
          ))}
        </div>

        <Panel className="mt-10 flex flex-col items-center justify-between gap-3 p-4 text-xs text-zinc-500 sm:flex-row">
          <span>Data: vps.kodub.com v6 API · game 0.6.3</span>
          <a
            href="https://www.kodub.com/apps/polytrack"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-purple-300 hover:underline"
          >
            Play PolyTrack <ExternalLink className="h-3 w-3" />
          </a>
        </Panel>
      </PageShell>
    </div>
  );
};

export default Home;
