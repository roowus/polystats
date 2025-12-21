import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart2, Users, Settings, ExternalLink, Info, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navigation from './Navigation';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  }
};

const cardHoverVariants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10
    }
  }
};

const Home = () => {
  const navigate = useNavigate();

  const features = [
    {
      title: 'Leaderboards',
      description: 'Explore global rankings across all tracks. View top players, compare times, and analyze performance trends.',
      icon: BarChart2,
      path: '/leaderboard',
      gradient: 'from-purple-500 to-blue-500',
      bgGradient: 'from-purple-500/10 to-blue-500/10'
    },
    {
      title: 'User Statistics',
      description: 'Access comprehensive player statistics including personal bests, averages, and performance analytics across all tracks.',
      icon: Users,
      path: '/user',
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-500/10 to-cyan-500/10'
    },
    {
      title: 'Utilities',
      description: 'Helpful tools to retrieve User IDs, convert tokens, and access other useful Polytrack utilities.',
      icon: Settings,
      path: '/utils',
      gradient: 'from-cyan-500 to-green-500',
      bgGradient: 'from-cyan-500/10 to-green-500/10'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
      <Navigation />

      <div className="pt-24 pb-16 px-4 md:px-8">
        <motion.div
          className="max-w-6xl mx-auto space-y-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Hero Section */}
          <motion.div className="text-center space-y-6" variants={itemVariants}>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 drop-shadow-2xl">
              Welcome to Polystats
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Your comprehensive analytics platform for{' '}
              <a
                href="https://www.kodub.com/apps/polytrack"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 hover:underline"
              >
                Polytrack
                <ExternalLink className="w-4 h-4" />
              </a>
              {' '}data and player statistics
            </p>
          </motion.div>

          {/* Quick Start Card */}
          <motion.div variants={itemVariants}>
            <Card
              className="bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 border-2 border-blue-500/40 backdrop-blur-sm shadow-2xl cursor-pointer hover:shadow-blue-500/20 hover:scale-[1.02] transition-all"
              onClick={() => navigate('/how-to-use')}
            >
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 shrink-0">
                      <Info className="w-8 h-8" />
                    </div>
                    <div className="text-center sm:text-left">
                      <h2 className="text-2xl font-bold text-white mb-2">
                        New to Polystats?
                      </h2>
                      <p className="text-gray-300">
                        Learn how to get your User ID and start exploring your stats
                      </p>
                    </div>
                  </div>
                  <Button
                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:scale-105 transition-all shrink-0 group"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/how-to-use');
                    }}
                  >
                    <span className="flex items-center gap-2">
                      View Guide
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Features Grid */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={containerVariants}
          >
            {features.map((feature) => {
              const Icon = feature.icon;

              return (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  whileHover="hover"
                  initial="rest"
                >
                  <Card className={`h-full bg-gradient-to-br ${feature.bgGradient} border-2 border-purple-500/30 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-shadow cursor-pointer overflow-hidden group`}>
                    <CardContent className="p-6 flex flex-col h-full">
                      <div className="flex-1 space-y-4">
                        <motion.div
                          className={`p-3 rounded-xl bg-gradient-to-r ${feature.gradient} w-fit`}
                          variants={cardHoverVariants}
                        >
                          <Icon className="w-8 h-8 text-white" />
                        </motion.div>

                        <h3 className="text-2xl font-bold text-white">
                          {feature.title}
                        </h3>

                        <p className="text-gray-300 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>

                      <Button
                        onClick={() => navigate(feature.path)}
                        className={`mt-6 w-full bg-gradient-to-r ${feature.gradient} text-white px-6 py-3 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-purple-500 group-hover:shadow-xl`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          Go to {feature.title}
                          <motion.div
                            initial={{ x: 0 }}
                            whileHover={{ x: 5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            →
                          </motion.div>
                        </span>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Footer */}
          <motion.div
            className="text-center text-gray-400 space-y-2 pt-8"
            variants={itemVariants}
          >
            <p className="text-sm">
              Made with ❤️ for the Polytrack community
            </p>
            <p className="text-xs">
              Play Polytrack at{' '}
              <a
                href="https://www.kodub.com/apps/polytrack"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors hover:underline"
              >
                kodub.com
              </a>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;
