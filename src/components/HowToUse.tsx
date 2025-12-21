import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, Key, Hash, Info, Search, Trophy, Share2 } from 'lucide-react';
import Navigation from './Navigation';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
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

const HowToUse = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black text-white">
      <Navigation />

      <div className="pt-24 pb-16 px-4 md:px-8">
        <motion.div
          className="max-w-5xl mx-auto space-y-10"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div className="text-center space-y-4" variants={itemVariants}>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500">
                <Info className="w-8 h-8" />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 drop-shadow-2xl">
              How to Use Polystats
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto">
              Learn how to get started with Polystats and make the most of your{' '}
              <a
                href="https://www.kodub.com/apps/polytrack"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 hover:underline"
              >
                Polytrack
                <ExternalLink className="w-4 h-4" />
              </a>
              {' '}analytics experience
            </p>
          </motion.div>

          {/* Main Content */}
          <motion.div className="space-y-6" variants={itemVariants}>
            <Card className="bg-gradient-to-br from-black/40 to-black/20 border-2 border-blue-500/30 backdrop-blur-sm shadow-2xl">
              <CardContent className="p-8 space-y-8">
                {/* Introduction */}
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-blue-400 flex items-center gap-2">
                    <Search className="w-6 h-6" />
                    Getting Started
                  </h2>
                  <p className="text-gray-300 leading-relaxed">
                    Polystats uses two primary types of identifiers to access player data: <strong className="text-white">User ID</strong> and <strong className="text-white">User Token</strong> (also known as User Key). These identifiers allow you to view detailed statistics, leaderboard positions, and performance analytics.
                  </p>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

                {/* User ID Section */}
                <motion.div
                  className="space-y-4 p-6 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <div className="flex items-center gap-3 text-blue-400">
                    <Hash className="w-6 h-6" />
                    <h3 className="font-semibold text-2xl">Getting Your User ID</h3>
                  </div>

                  <p className="text-gray-300">
                    Your User ID is a unique identifier used across Polystats to retrieve your player statistics. Follow these steps to obtain it:
                  </p>

                  <ol className="space-y-4 text-gray-300">
                    <li className="flex gap-3">
                      <span className="text-blue-400 font-bold text-lg min-w-[24px]">1.</span>
                      <div>
                        <p className="font-semibold text-white mb-1">Navigate to the Utils page</p>
                        <p className="text-sm">Click on "Utils" in the navigation menu at the top of the page.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-blue-400 font-bold text-lg min-w-[24px]">2.</span>
                      <div>
                        <p className="font-semibold text-white mb-1">Choose your input method</p>
                        <p className="text-sm">You can retrieve your User ID by either:</p>
                        <ul className="list-disc list-inside mt-2 ml-4 space-y-1 text-sm">
                          <li>Entering your <strong className="text-white">User Token</strong> (recommended)</li>
                          <li>Selecting a track and entering your <strong className="text-white">Rank</strong> on that track</li>
                        </ul>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-blue-400 font-bold text-lg min-w-[24px]">3.</span>
                      <div>
                        <p className="font-semibold text-white mb-1">Copy your User ID</p>
                        <p className="text-sm">Once retrieved, your User ID will be displayed. Click the copy button to save it for use in other Polystats features.</p>
                      </div>
                    </li>
                  </ol>

                  <Button
                    onClick={() => navigate('/utils')}
                    className="mt-4 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg hover:scale-105 transition-all"
                  >
                    Go to Utils Page →
                  </Button>
                </motion.div>

                <div className="h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

                {/* User Token Section */}
                <motion.div
                  className="space-y-4 p-6 rounded-lg bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <div className="flex items-center gap-3 text-purple-400">
                    <Key className="w-6 h-6" />
                    <h3 className="font-semibold text-2xl">Getting Your User Token</h3>
                  </div>

                  <p className="text-gray-300">
                    Your User Token is a private key provided by Polytrack that authenticates your identity. Here's how to find it:
                  </p>

                  <ol className="space-y-4 text-gray-300">
                    <li className="flex gap-3">
                      <span className="text-purple-400 font-bold text-lg min-w-[24px]">1.</span>
                      <div>
                        <p className="font-semibold text-white mb-1">Visit Polytrack</p>
                        <p className="text-sm">
                          Go to{' '}
                          <a
                            href="https://www.kodub.com/apps/polytrack"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            kodub.com/apps/polytrack
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-purple-400 font-bold text-lg min-w-[24px]">2.</span>
                      <div>
                        <p className="font-semibold text-white mb-1">Access your profile</p>
                        <p className="text-sm">Navigate to your profile section in Polytrack.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-purple-400 font-bold text-lg min-w-[24px]">3.</span>
                      <div>
                        <p className="font-semibold text-white mb-1">Export your profile</p>
                        <p className="text-sm">Select a profile and click the <strong className="text-white">Export</strong> button. A disclaimer will appear.</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-purple-400 font-bold text-lg min-w-[24px]">4.</span>
                      <div>
                        <p className="font-semibold text-white mb-1">Copy your token</p>
                        <p className="text-sm">Your User Token will be displayed. Copy it and use it in Polystats to access your statistics.</p>
                      </div>
                    </li>
                  </ol>
                </motion.div>

                <div className="h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

                {/* Using Polystats Features */}
                <motion.div
                  className="space-y-4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <h3 className="text-2xl font-bold text-cyan-400 flex items-center gap-2">
                    <Trophy className="w-6 h-6" />
                    Using Polystats Features
                  </h3>

                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                      <CardContent className="p-4 space-y-2">
                        <h4 className="font-semibold text-lg text-purple-400">Leaderboards</h4>
                        <p className="text-sm text-gray-300">
                          View global rankings for any track. Enter a User ID or User Token to highlight your position.
                        </p>
                        <Button
                          onClick={() => navigate('/leaderboard')}
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300 text-xs p-0"
                        >
                          View Leaderboards →
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                      <CardContent className="p-4 space-y-2">
                        <h4 className="font-semibold text-lg text-blue-400">User Stats</h4>
                        <p className="text-sm text-gray-300">
                          Access comprehensive statistics including personal bests, averages, and performance trends.
                        </p>
                        <Button
                          onClick={() => navigate('/user')}
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300 text-xs p-0"
                        >
                          View User Stats →
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-cyan-500/10 to-green-500/10 border border-cyan-500/20">
                      <CardContent className="p-4 space-y-2">
                        <h4 className="font-semibold text-lg text-cyan-400">Utilities</h4>
                        <p className="text-sm text-gray-300">
                          Convert between User Tokens and User IDs, and access other helpful tools.
                        </p>
                        <Button
                          onClick={() => navigate('/utils')}
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300 text-xs p-0"
                        >
                          Access Utils →
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sharing Feature */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-2 border-indigo-500/30 backdrop-blur-sm shadow-2xl">
              <CardContent className="p-8 space-y-4">
                <div className="flex items-center gap-3 text-indigo-400">
                  <Share2 className="w-6 h-6" />
                  <h3 className="font-semibold text-2xl">Sharing Your Stats</h3>
                </div>

                <p className="text-gray-300">
                  Want to share your Polytrack achievements with friends? Polystats makes it easy!
                </p>

                <div className="space-y-3 p-4 rounded-lg bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                  <h4 className="font-semibold text-white">How it works:</h4>
                  <ol className="space-y-2 text-gray-300 text-sm">
                    <li className="flex gap-2">
                      <span className="text-indigo-400 font-semibold">1.</span>
                      <span>Search for your stats on the <strong className="text-white">Leaderboard</strong> page using your User ID or User Token</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-400 font-semibold">2.</span>
                      <span>The URL will automatically update with your stats information</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-indigo-400 font-semibold">3.</span>
                      <span>Simply copy and share the URL - anyone who opens it will see your stats!</span>
                    </li>
                  </ol>

                  <div className="mt-4 p-3 rounded bg-blue-500/10 border border-blue-500/20">
                    <p className="text-sm text-blue-300">
                      <strong>🔒 Privacy Note:</strong> If you enter a User Token, it's automatically converted to a User ID before being added to the URL. This means your private token is never exposed in shareable links!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Privacy & Beta Notice */}
          <motion.div className="space-y-4" variants={itemVariants}>
            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 backdrop-blur-sm">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-green-400 mb-3">🔒 Privacy & Security</h3>
                <p className="text-gray-300 text-sm">
                  <strong>Polystats does not store, save, or share any of your user data.</strong> All data is fetched directly from the Polytrack API in real-time and is never saved to our servers. Your User Token and User ID are only used for querying the API.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 backdrop-blur-sm">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-yellow-400 mb-3">⚠️ Beta Notice</h3>
                <p className="text-gray-300 text-sm">
                  Polystats is currently in beta and may have bugs or incomplete features. If you encounter any issues or have suggestions for improvement, please contact <strong className="text-white">roowus</strong> on Discord.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Footer */}
          <motion.div
            className="text-center text-gray-400 space-y-2 pt-8"
            variants={itemVariants}
          >
            <p className="text-sm">
              Ready to explore your stats?
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => navigate('/')}
                variant="ghost"
                className="text-blue-400 hover:text-blue-300"
              >
                ← Back to Home
              </Button>
              <Button
                onClick={() => navigate('/user')}
                className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-2 rounded-lg hover:scale-105 transition-all"
              >
                Get Started →
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default HowToUse;
