import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, User, Copy, List, Circle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, TriangleAlert, Info } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import Navigation from './Navigation';
// Track catalog and API client (v6 API) — see src/lib
import { buildLeaderboardUrl, fetchUser, normalizeEntry, sha256Hex, API_VERSION } from '@/lib/polytrack';
import { OFFICIAL_TRACKS, COMMUNITY_TRACKS } from '@/lib/tracks';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PREDEFINED_TRACKS = [...OFFICIAL_TRACKS, ...COMMUNITY_TRACKS];

interface BasicUserData {
  name: string;
  carColors: string;
  isVerifier: boolean | 'N/A';
}

const titleVariants = {
  hidden: { opacity: 0, y: -50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const alertVariants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.3, ease: "easeIn" } },
};

const CopyPopup = ({ text }: { text: string }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-sm px-4 py-2 shadow-lg z-50"
  >
    Copied: {text}
  </motion.div>
);



const Utils = () => {
  const [userInput, setUserInput] = useState('');
  const [userInputType, setUserInputType] = useState<'usertoken' | 'rank'>('usertoken');
  const [trackId, setTrackId] = useState('');
  const [isOtherTrack, setIsOtherTrack] = useState(false);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [basicUserData, setBasicUserData] = useState<BasicUserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAndDisplayUserData = useCallback(async (userId: string, inputToken: string | null = null, rankEntryData: any | null = null) => {
    setUserLoading(true);
    setUserError(null);
    setBasicUserData(null);
    if (!userId) {
      setUserLoading(false);
      return;
    }

    let fetchedBasicData: BasicUserData | null = null;

    if (rankEntryData) {
      fetchedBasicData = {
        name: rankEntryData.name || 'Name Unavailable',
        carColors: rankEntryData.carColors || '',
        isVerifier: 'N/A'
      };
    }

    if (inputToken) {
      try {
        const data = await fetchUser(inputToken);
          if (data) {
            fetchedBasicData = {
              name: data.name || (fetchedBasicData?.name || 'Name Unavailable'),
              carColors: data.carColors || (fetchedBasicData?.carColors || ''),
              isVerifier: data.isVerifier
            };
          } else {
            console.warn("Incomplete data from /user endpoint.");
            if (fetchedBasicData) {
              fetchedBasicData.isVerifier = 'N/A';
            }
          }
      } catch (e) {
        console.error("Error fetching basic user data from /user:", e);
        if (fetchedBasicData) {
          fetchedBasicData.isVerifier = 'N/A';
        }
      }
    }

    if (!fetchedBasicData || fetchedBasicData.name === undefined || fetchedBasicData.carColors === undefined) {
      const summer1TrackId = PREDEFINED_TRACKS.find(track => track.name === 'Summer 1')?.id;
      if (summer1TrackId) {
        try {
          const userEntryUrl = buildLeaderboardUrl({ trackId: summer1TrackId, skip: 0, amount: 1, onlyVerified: false, userTokenHash: userId });
          const userEntryResponse = await fetch(userEntryUrl);
          if (userEntryResponse.ok) {
            const userEntryData: { userEntry: any | null } = await userEntryResponse.json().then((d) => ({ userEntry: d.userEntry ? normalizeEntry(d.userEntry) : null }));
            if (userEntryData.userEntry) {
              fetchedBasicData = {
                name: userEntryData.userEntry.name || 'Name Unavailable',
                carColors: userEntryData.userEntry.carColors || '',
                isVerifier: 'N/A'
              };
            } else {
              console.warn("User entry not found on Summer 1 leaderboard.");
            }
          } else {
            console.warn(`Failed to fetch user entry from Summer 1: ${userEntryResponse.status}`);
          }
        } catch (e) {
          console.error("Error fetching user entry from Summer 1:", e);
        }
      }
    }

    if (fetchedBasicData) {
      setBasicUserData(fetchedBasicData);
    } else {
      setUserError('Could not fetch user basic data.');
      setBasicUserData({ name: 'Unavailable', carColors: '', isVerifier: 'N/A' });
    }

    setUserLoading(false);
  }, [fetchUser, buildLeaderboardUrl, PREDEFINED_TRACKS]);

  const processInputAndGetUserId = useCallback(async () => {
    setError(null);
    setUserError(null);
    setResolvedUserId(null);
    setBasicUserData(null);
    setLoading(true);

    if (!userInput) {
      const inputTypeLabel = userInputType === 'usertoken' ? 'User Token' : 'Rank';
      setError(`Please enter a value for ${inputTypeLabel}.`);
      setLoading(false);
      return;
    }

    if (userInputType === 'rank' && !trackId) {
      setError('Please select or enter a Track ID to lookup by Rank.');
      setLoading(false);
      return;
    }

    let targetUserId = '';
    let processingError: string | null = null;
    let rankEntryData: any | null = null;

    try {
      if (userInputType === 'usertoken') {
        try {
          targetUserId = await sha256Hex(userInput);
        } catch (e: any) {
          processingError = 'Failed to hash user token.';
          console.error('Hashing error:', e);
        }
      } else if (userInputType === 'rank') {
        const rank = parseInt(userInput, 10);
        if (!isNaN(rank) && rank > 0) {
          try {
            const skip = Math.max(0, rank - 1);
            const rankLookupUrl = buildLeaderboardUrl({ trackId, skip, amount: 1, onlyVerified: false });
            const response = await fetch(rankLookupUrl);

            if (!response.ok) {
              let errorDetail = `Failed to fetch user by rank: ${response.status}`;
              try {
                const errorJson = await response.json();
                if (errorJson && errorJson.message) {
                  errorDetail = `Failed to fetch user by rank: ${errorJson.message}`;
                }
              } catch (parseError) {
                console.warn("Could not parse error response body:", parseError);
              }
              throw new Error(errorDetail);
            }

            const data: any = await response.json().then((d) => ({ ...d, entries: (d.entries ?? []).map(normalizeEntry) }));
            if (data.entries && data.entries.length > 0) {
              targetUserId = data.entries[0].userId;
              rankEntryData = data.entries[0];
            } else {
              processingError = `No user found at rank ${rank} on this track.`;
            }
          } catch (err: any) {
            processingError = err.message || 'An error occurred while fetching user by rank.';
          }
        } else {
          processingError = 'Please enter a valid positive number for Rank.';
        }
      }

      if (processingError) {
        setError(processingError);
        setResolvedUserId(null);
      } else if (targetUserId) {
        setResolvedUserId(targetUserId);
        setError(null);
        fetchAndDisplayUserData(targetUserId, userInputType === 'usertoken' ? userInput : null, rankEntryData);
      } else {
        setError('Could not determine User ID.');
        setResolvedUserId(null);
        setBasicUserData(null);
        setUserError(null);
      }
    } catch (err: any) {
      processingError = err.message || 'An unexpected error occurred during processing.';
      setError(processingError);
      setResolvedUserId(null);
      setBasicUserData(null);
      setUserError(null);
    } finally {
      setLoading(false);
    }
  }, [userInput, userInputType, trackId, fetchAndDisplayUserData]);

  const copyToClipboard = (text: string) => {
    if (!navigator.clipboard) {
      console.warn('Clipboard API is not available in this context.');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedText(text);
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopiedText(null), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
      });
  };

  const displayCarColors = (carColors: string) => {
    if (!carColors) return <span className="text-gray-400">No Color Data</span>;
    const colors = carColors.match(/.{1,6}/g);
    if (!colors) return <span className="text-gray-400">Invalid Color Data</span>;

    return (
      <div className="flex gap-1 items-center flex-wrap justify-start">
        {colors.map((c, i) => {
          const hex = `#${c.padEnd(6, '0')}`;
          const tooltipId = `color-tip-${i}`;
          return (
            <motion.div
              key={i}
              style={{ backgroundColor: hex, cursor: 'pointer' }}
              className="w-4 h-4 rounded-full border border-gray-600"
              onClick={() => copyToClipboard(hex)}
              whileHover={{ scale: 1.2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              data-tooltip-id={tooltipId}
            >
              <Tooltip id={tooltipId}>
                <span className="text-xs">{hex}</span>
              </Tooltip>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const showErrorSuggestion = error && (
    error.includes("User not found") ||
    error.includes("No user found at rank") ||
    error.includes("valid positive number for Rank") ||
    error.includes("Failed to hash user token") ||
    error.includes("Please enter a value for") ||
    (userInputType === 'rank' && error.includes("Please select or enter a Track ID")) ||
    (error.includes("Failed to fetch") && (userInput || trackId))
  );

  const inputPlaceholder = userInputType === 'usertoken' ? 'User Token' : 'Rank (e.g., 1)';

  // This variable indicates if the user data section is currently visible
  const isUserDataSectionVisible = userLoading || basicUserData || userError || resolvedUserId; // Include resolvedUserId here

  return (
    <>
      <Navigation />
      <div className={cn(
        "min-h-screen bg-[#212b58] px-4 pt-24 pb-16 sm:px-6"
      )}>
        <AnimatePresence>
          {copiedText && <CopyPopup text={copiedText} />}
        </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        layout
        className={cn(
          "mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6",
          "mx-auto"
        )}
      >
        <motion.h1
          variants={titleVariants}
          initial="hidden"
          animate="visible"
          className="font-game inline-block -skew-x-[6deg] text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl"
        >
          Utils
        </motion.h1>

        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="pt-panel">
            <CardHeader>
              <CardTitle className="text-blue-400 text-2xl">User ID Finder</CardTitle>
              <CardDescription className="text-gray-400">
                Enter a User Token or a Rank and Track ID to find the corresponding User ID and data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <motion.div variants={itemVariants} initial="hidden" animate="visible">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                  <Select onValueChange={(value: 'usertoken' | 'rank') => {
                    setUserInputType(value);
                    setUserInput('');
                    setResolvedUserId(null);
                    setBasicUserData(null);
                    setError(null);
                    setUserError(null);
                  }} defaultValue={userInputType}>
                    <SelectTrigger className="w-[180px] border-white/10 bg-[#102052] focus:border-white/40">
                      <SelectValue placeholder="Select Input Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-white/15">
                      <SelectItem value="usertoken">User Token</SelectItem>
                      <SelectItem value="rank">Rank and Track ID</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type={userInputType === 'rank' ? 'number' : 'text'}
                    placeholder={inputPlaceholder}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="flex-1 border-white/10 bg-[#102052] placeholder:text-zinc-500 focus:border-white/40"
                  />
                </div>
              </motion.div>

              <AnimatePresence>
                {userInputType === 'usertoken' && (
                  <motion.div
                    key="usertoken-note"
                    variants={alertVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    layout
                  >
                    <Alert variant="default" className="bg-blue-500/10 text-blue-400 border-blue-500/30 mt-2">
                      <AlertTitle>Note:</AlertTitle>
                      <AlertDescription className="flex items-center gap-2 text-purple-300">
                        <span className="text-blue-400">
                          <Info className="h-4 w-4" />
                        </span>
                        Your User Token is confidential and not saved or shared by this website.
                      </AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {userInputType === 'rank' && (
                  <motion.div
                    key="rank-inputs"
                    variants={itemVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    layout
                  >
                    <>
                      {isOtherTrack ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            placeholder="Enter Track ID"
                            value={trackId}
                            onChange={(e) => setTrackId(e.target.value)}
                            className="flex-1 border-white/10 bg-[#102052] placeholder:text-zinc-500 focus:border-white/40"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setIsOtherTrack(false);
                              setTrackId('');
                            }}
                            className="pt-panel text-white hover:bg-gray-700/50 focus:outline-none focus:ring-0"
                            title="Select from predefined tracks"
                          >
                            <List className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Select onValueChange={(value) => {
                          if (value === 'other') {
                            setIsOtherTrack(true);
                            setTrackId('');
                          } else {
                            setIsOtherTrack(false);
                            setTrackId(value);
                          }
                        }} value={trackId || ''}>
                          <SelectTrigger className="w-full border-white/10 bg-[#102052] focus:border-white/40">
                            <SelectValue placeholder="Select Track" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 text-white border-white/15">
                            {PREDEFINED_TRACKS.map((track) => (
                              <SelectItem key={track.id} value={track.id}>
                                {track.name}
                              </SelectItem>
                            ))}
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <motion.div
                        key="rank-warning"
                        variants={alertVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        layout
                      >
                        <Alert variant="default" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 mt-2">
                          <AlertTitle>Note:</AlertTitle>
                          <AlertDescription className="flex items-center gap-2 text-orange-300">
                            <span className="text-yellow-400">
                              <TriangleAlert className="h-4 w-4" />
                            </span>
                            Rank is based on live leaderboard data, which updates frequently. Results may change.
                          </AlertDescription>
                        </Alert>
                      </motion.div>
                    </>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div variants={itemVariants} initial="hidden" animate="visible">
                <Button
                  onClick={processInputAndGetUserId}
                  disabled={loading || !userInput || (userInputType === 'rank' && !trackId)}
                  className="pt-btn w-full"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5" />
                      Get User ID
                    </>
                  )}
                </Button>
              </motion.div>

              <AnimatePresence>
                {(userLoading || basicUserData || userError || resolvedUserId) && ( // Include resolvedUserId here
                  <motion.div
                    key="user-data-section"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    layout
                    className="mt-4"
                  >
                    {/* Always display User Information header and User ID if resolvedUserId exists */}
                    {resolvedUserId && (
                      <div className="space-y-2">
                         <h3 className="text-purple-400 text-xl font-semibold flex items-center gap-2 border-b border-white/15 pb-2">
                          <User className="w-5 h-5" /> User Information
                        </h3>
                        <p className="text-gray-300 flex items-center">
                          User ID:
                          <span className="font-mono text-sm text-gray-400 ml-2 break-all sm:break-words">{resolvedUserId}</span>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={() => copyToClipboard(resolvedUserId)}
                            className="text-blue-400 p-0 ml-1"
                            title="Copy User ID"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </p>
                        {/* Conditionally display basic user data if available and not 'Unavailable' */}
                        {basicUserData && basicUserData.name !== 'Unavailable' && (
                           <p className="text-gray-300">Name: <span className="font-semibold text-blue-300">{basicUserData.name}</span></p>
                        )}
                         {basicUserData && basicUserData.carColors && (
                          <div className="flex items-center text-gray-300">
                            Car Colors: <span className="ml-2">{displayCarColors(basicUserData.carColors)}</span>
                          </div>
                        )}
                         {basicUserData && basicUserData.isVerifier !== 'N/A' && (
                          <p className="text-gray-300 flex items-center">
                            Is Verifier: <span className="ml-2">
                              {basicUserData.isVerifier ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-400" />}
                            </span>
                          </p>
                        )}
                        {/* Conditional note for Rank input type - still relevant */}
                        {userInputType === 'rank' && (
                          <p className="text-sm text-gray-400 italic">
                            Is Verifier status cannot be determined when looking up by Rank. A User Token is required for this information.
                          </p>
                        )}
                         {/* Display user data fetch error below the ID if it occurred */}
                         {userError && (
                           <Alert variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/30 mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>User Data Fetch Error</AlertTitle>
                            <AlertDescription>{userError}</AlertDescription>
                          </Alert>
                         )}
                      </div>
                    )}

                    {/* Display loading state if userLoading is true */}
                    {userLoading && (
                      <div className="flex items-center justify-center gap-2 text-blue-400">
                        <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Fetching user data...
                      </div>
                    )}

                    {/* Display user error if userError is true AND resolvedUserId is null (initial fetch failed completely) */}
                    {userError && !resolvedUserId && (
                       <Alert variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/30">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>User Data Error</AlertTitle>
                        <AlertDescription>{userError}</AlertDescription>
                      </Alert>
                    )}

                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              key="main-error"
              variants={alertVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
            >
              <Alert variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/30">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showErrorSuggestion && (
            <motion.div
              key="suggestion-alert"
              variants={alertVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              layout
            >
              <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm text-center mt-2 p-3 border border-yellow-400 bg-yellow-400/20">
                <TriangleAlert className="h-4 w-4" />
                <span>Suggestion: Please double-check your input and ensure the correct Input Type is selected. If using Rank, make sure a Track ID is also provided.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div> 

      <Tooltip id="verifier-tip-true" place="top" />
      <Tooltip id="verifier-tip-false" place="top" />

      {/* Conditionally render the version and game link */}
      {!isUserDataSectionVisible && (
        <div
          className="absolute bottom-0 left-0 right-0 text-center text-gray-400 text-sm space-y-2 p-4"
        >
          <p>Game version: {API_VERSION}</p>
          <p>Play the game: <a href="https://www.kodub.com/apps/polytrack" className="text-purple-400 hover:underline">Polytrack</a></p>
        </div>
      )}
    </div>
    </>
  );
};

export default Utils;
