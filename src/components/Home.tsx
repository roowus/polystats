import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-[#0a0714] text-zinc-100">
      <Navigation />
      <PageShell className="max-w-5xl">
        {/* Hero */}
        <div className="mb-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-4xl font-bold tracking-tight sm:text-5xl"
          >
            <span className="bg-gradient-to-r from-violet-300 via-purple-300 to-fuchsia-300 bg-clip-text text-transparent">
              Poly
            </span>
            <span className="text-zinc-100">Stats</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="mx-auto mt-3 max-w-xl text-sm text-zinc-400 sm:text-base"
          >
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
          </motion.p>
        </div>

        {/* Feature grid */}
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
        >
          {FEATURES.map(({ title, description, icon: Icon, path }) => (
            <motion.button
              key={path}
              onClick={() => navigate(path)}
              variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } }}
              whileHover={{ y: -3 }}
              className="group rounded-2xl border border-white/8 bg-white/[0.03] p-5 text-left backdrop-blur-sm transition-colors hover:border-purple-500/40 hover:bg-purple-500/[0.06]"
            >
              <div className="mb-3 inline-flex rounded-xl bg-purple-500/12 p-2.5 text-purple-300">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="flex items-center gap-1.5 font-semibold">
                {title}
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-purple-300" />
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{description}</p>
            </motion.button>
          ))}
        </motion.div>

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
