import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Search, User, Copy, List, Palette, CircleCheck, CircleX, Circle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, TriangleAlert, Info } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PREDEFINED_TRACKS = [
  { name: 'Summer 1', id: 'ef949bfd7492a8b329c30fac19713d9ea96256fb8bf1cdb65cb3727c0205b862' },
  { name: 'Summer 2', id: 'cf1ceacd0e3239a44afe8e4c291bd655a80ffffe559964e9a5bc5c3e21c4cafc' },
  { name: 'Summer 3', id: '456a0ac6f849ecf5d4020ade78f4e2e44f3eee3cd21b9452ff8a93e0624dbd2f' },
  { name: 'Summer 4', id: '668c209f6055c04b9f28e37127884039cb1f8710360bfe5b578955295151979f' },
  { name: 'Summer 5', id: 'b31551b1fc3cfdf3f76043b82d0c88d92451ae5246ce3db65bc3979e4912d01f' },
  { name: 'Summer 6', id: 'b6657496f1f25ab8b1599c4cc7d93b2cecebef9bd018032993f9c2f92a9f2851' },
  { name: 'Summer 7', id: 'f3d90e905743a30d4a01ff302be3ae0be38ee055cc1a3b99257752e505765c04' },
  { name: 'Winter 1', id: '94de41605004b67581f7a2a4f68c84d352b5b723a604ccb38e511f5eac9d22a9' },
  { name: 'Winter 2', id: 'f84e5f767fc5d53ae0d3ddf95dfb4a9197f361283cdb049673077b0208d12fe8' },
  { name: 'Winter 3', id: '7a0e04bfe09e1bead36ddd2f7e61d32fd6c1e55e907d60edc6ccd3e17532e1f7' },
  { name: 'Winter 4', id: '39b2d610aeed5d193f3346291fc4000ef23030e5817f471522f167b9e74ed1f5' },
  { name: 'Desert 1', id: '56a5e13736d871f92863cb60ad690e78547f459520e61285fde05bd02bd2d349' },
  { name: 'Desert 2', id: '7425633d9f77c41bbf7486fdd2b3a2ce04aa26bacc870a032929b4c7e33a8cf3' },
  { name: 'Desert 3', id: 'b84107a25d159c6544092903da12b61573971da5a6b3c917e55be30486ccaddd' },
  { name: 'Desert 4', id: '29b6343e99552c610e24a5bfefc8a240800ed151600c0dc8f5c0f3dce334d322' },
    { name: 'Asgaurdia', id: 'b7b253d6b0cc2ce8e6d5fe51cd3365bde09ad5de4e12256128e9b6493969085c' },
    { name: 'Flying Dreams', id: 'da1ef837b8412d32269e305d4031c47b59da08fca2b856d94890eaf58ec29b71' },
    { name: 'Ghost City', id: '7537816191920c597d6a1f0ab03b50c4ae3d74b6e0f6eeb8ddb85653762c7a5d' },
    { name: 'MOS ESPA', id: 'fa1a61bb25e8a5a68f2b30fffe9ca3bdd448f4a5c249f8b2403b4f5323b6de45' },
    { name: 'NatsujŌ', id: 'a054a6277181a7f0a46588f5cccd1b794f537e5efd09a173a9ca7e11d511f304' },
    { name: '90xRESET', id: '4d0f964b159d51d6906478bbb87e1edad21b0f1eb2972af947be34f2d8c49ae9' },
    { name: 'concrete jungle', id: '0544f97453f7b0e2a310dfb0dcd331b4060ae2e9cb14ac27dc5367183dab0513' },
    { name: 'lu muvimento', id: '2ccd83e9419b6071ad9272b73e549e427b1a0f62d5305015839ae1e08fb86ce6' },
    { name: 'Re : Akina', id: 'f112ab979138b9916221cbf46329fa7377a745bdd18cd3d00b4ffd6a8a68f113' },
    { name: "Hyperion's Sanctuary", id: 'b41ac84904b60d00efa5ab8bb60f42c929c16d8ebbfe2f77126891fcddab9c1c' },
    { name: 'Opal Palace - Repolished', id: '89f1a70d0e6be8297ec340a378b890f3fed7d0e20e3ef15b5d32ef4ef7ff1701' },
    { name: 'Snow Park', id: '2978b99f058cb3a2ce6f97c435c803b8d638400532d7c79028b2ec3d5e093882' },
    { name: 'Winter Hollow', id: '2046c377ac7ec5326b263c46587f30b66ba856257ddc317a866e3e7f66a73929' },
    { name: 'Anubis', id: 'b453c3afb4b5872213aee43249d6db38578e8e2ded4a96f840617c9c6e63a6b6' },
    { name: 'Joenail Jones', id: '23a46c3d4978a72be5f4a7fea236797aa31b52e577044ef4c9faa822ecc5cdc0' },
    { name: 'Arabica', id: '1aadcef252749318227d5cd4ce61a4a71526087857104fd57697b6fc63102e8a' },
    { name: 'Clay temples', id: '773eb0b02b97a72f3e482738cda7a5292294800497e16d9366e4f4c88a6f4e2d' },
    { name: 'DESERT STALLION', id: '932da81567f2b223fa1a52d88d6db52016600c5b9df02218f06c9eb832ecddeb' },
    { name: 'Las Calles', id: '97da746d9b3ddd5a861fa8da7fcb6f6402ffa21f8f5cf61029d7a947bad76290' },
    { name: 'Last Remnant', id: '19335bb082dfde2af4f7e73e812cd54cee0039a9eadf3793efee3ae3884ce423' },
    { name: 'Malformations', id: 'bc7d29657a0eb2d0abb3b3639edcf4ade61705132c7ca1b56719a7a110096afd' },
    { name: 'Sandline Ultimatum', id: 'faed71cf26ba4d183795ecc93e3d1b39e191e51d664272b512692b0f4f323ff5' },
];




const API_BASE_URL_LEADERBOARD = 'https://vps.kodub.com/leaderboard';
const API_BASE_URL_USER = 'https://vps.kodub.com/user';
const PROXY_URL = 'https://hi-rewis.maxicode.workers.dev/?url=';
const VERSION = '0.5.1';
const AMOUNT = 10;

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
    className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-sm px-4 py-2 rounded-md shadow-lg z-50"
  >
    Copied: {text}
  </motion.div>
);

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

const parseCarColors = (colorString: string): string[] => {
  if (!colorString || colorString.length !== 24) {
    console.error("Invalid carColors string format:", colorString);
    return [];
  }
  const colors: string[] = [];
  for (let i = 0; i < 24; i += 6) {
    colors.push('#' + colorString.substring(i, 6));
  }
  return colors;
};

const VerifiedStateIcon = ({ isVerifier }: { isVerifier: boolean | undefined | 'N/A' }) => {
  if (isVerifier === undefined || isVerifier === 'N/A') return null;
  const tooltipId = `verifier-tip-${isVerifier}`;
  return (
    <>
      <Tooltip id={tooltipId}>
        <span className="text-xs">{isVerifier ? 'Verifier' : 'Not a Verifier'}</span>
      </Tooltip>
      {isVerifier ? (
        <CircleCheck data-tooltip-id={tooltipId} className="w-4 h-4 text-green-500" />
      ) : (
        <CircleX data-tooltip-id={tooltipId} className="w-4 h-4 text-gray-400" />
      )}
    </>
  );
};

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
        const userApiUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL_USER + `?version=${VERSION}&userToken=${inputToken}`)}`;
        const response = await fetch(userApiUrl);
        if (response.ok) {
          const data = await response.json();
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
        } else {
          console.warn(`Failed to fetch basic user data from /user: ${response.status}`);
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
          const userEntryUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL_LEADERBOARD + `?version=${VERSION}&trackId=${summer1TrackId}&skip=0&amount=1&onlyVerified=${false}&userTokenHash=${userId}`)}`;
          const userEntryResponse = await fetch(userEntryUrl);
          if (userEntryResponse.ok) {
            const userEntryData: { userEntry: any | null } = await userEntryResponse.json();
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
  }, [PROXY_URL, API_BASE_URL_USER, API_BASE_URL_LEADERBOARD, VERSION, PREDEFINED_TRACKS]);

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
          targetUserId = await sha256(userInput);
        } catch (e: any) {
          processingError = 'Failed to hash user token.';
          console.error('Hashing error:', e);
        }
      } else if (userInputType === 'rank') {
        const rank = parseInt(userInput, 10);
        if (!isNaN(rank) && rank > 0) {
          try {
            const skip = Math.max(0, rank - 1);
            const rankLookupUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL_LEADERBOARD + `?version=${VERSION}&trackId=${trackId}&skip=${skip}&amount=1&onlyVerified=${false}`)}`;
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

            const data: any = await response.json();
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
  }, [userInput, userInputType, trackId, fetchAndDisplayUserData, PROXY_URL, API_BASE_URL_LEADERBOARD, VERSION]);

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
    <div className={cn(
      "min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-4 md:p-8 flex flex-col justify-center items-center relative"
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
          "max-w-2xl w-full space-y-6",
          "mx-auto"
        )}
      >
        <motion.h1
          variants={titleVariants}
          initial="hidden"
          animate="visible"
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"
        >
          Utils
        </motion.h1>

        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="bg-gray-800/50 text-white border-purple-500/30 shadow-lg">
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
                    <SelectTrigger className="w-[180px] bg-black/20 text-white border-purple-500/30 focus:ring-purple-500/50">
                      <SelectValue placeholder="Select Input Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 text-white border-purple-500/30">
                      <SelectItem value="usertoken">User Token</SelectItem>
                      <SelectItem value="rank">Rank and Track ID</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type={userInputType === 'rank' ? 'number' : 'text'}
                    placeholder={inputPlaceholder}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="flex-1 bg-black/20 text-white border-purple-500/30 placeholder:text-gray-500 focus:ring-purple-500/50"
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
                            className="flex-1 bg-black/20 text-white border-purple-500/30 placeholder:text-gray-500 focus:ring-purple-500/50"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setIsOtherTrack(false);
                              setTrackId('');
                            }}
                            className="bg-gray-800/50 text-white hover:bg-gray-700/50 focus:outline-none focus:ring-0"
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
                          <SelectTrigger className="w-full bg-black/20 text-white border-purple-500/30 focus:ring-purple-500/50">
                            <SelectValue placeholder="Select Track" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 text-white border-purple-500/30">
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
                  className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-full transition-all duration-300 hover:from-purple-600 hover:to-blue-600 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-0"
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
                         <h3 className="text-purple-400 text-xl font-semibold flex items-center gap-2 border-b border-purple-500/30 pb-2">
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
              <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm text-center mt-2 p-3 border border-yellow-400 rounded-md bg-yellow-400/20">
                <TriangleAlert className="h-4 w-4" />
                <span>Suggestion: Please double-check your input and ensure the correct Input Type is selected. If using Rank, make sure a Track ID is also provided.</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div> {/* Closing tag for the main content motion.div */}

      <Tooltip id="verifier-tip-true" place="top" />
      <Tooltip id="verifier-tip-false" place="top" />

      {/* Conditionally render the version and game link */}
      {!isUserDataSectionVisible && (
        <div
          className="absolute bottom-0 left-0 right-0 text-center text-gray-400 text-sm space-y-2 p-4"
        >
          <p>Version: {VERSION}</p>
          <p>Play the game: <a href="https://www.kodub.com/apps/polytrack" className="text-purple-400 hover:underline">Polytrack</a></p>
        </div>
      )}
    </div> // Closing tag for the main div
  );
};

export default Utils;
