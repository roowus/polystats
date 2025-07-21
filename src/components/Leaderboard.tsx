import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button'; // Assuming Button is needed elsewhere
import { Input } from '@/components/ui/input'; // Assuming Input is needed elsewhere
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Assuming Card components are needed elsewhere
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Assuming Alert components are needed elsewhere
import { Search, Trophy, User, Circle, CheckCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, File, Copy, List } from 'lucide-react'; // Import Lucide icons
import { cn } from '@/lib/utils'; // Assuming cn utility is available
// Removed import for Switch and Label from @/components/ui
import { motion, AnimatePresence } from 'framer-motion'; // Import AnimatePresence
import { Tooltip } from 'react-tooltip';
import { AlertCircle, TriangleAlert, Info } from 'lucide-react'; // Added Info icon
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; // Assuming Select components are needed elsewhere

interface LeaderboardEntry { id: number; userId: string; name: string; carColors: string; frames: number; verifiedState: number; position: number; rank?: number; percent?: number; }
interface LeaderboardData { total: number; entries: LeaderboardEntry[]; userEntry: LeaderboardEntry | null; }
interface RecordingData { recording: string; frames: number; verifiedState: number; carColors: string; }

const API_BASE_URL = 'https://vps.kodub.com:43273/leaderboard';
const RECORDING_API_BASE_URL = 'https://vps.kodub.com:43273/recordings';
const PROXY_URL = 'https://hi-rewis.maxicode.workers.dev/?url=';
const VERSION = '0.5.0';
const AMOUNT = 10;

// Define the predefined tracks - Added new tracks
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

// Animation variants for smoother transitions
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
  exit: { opacity: 0, y: -20, transition: { duration: 0.3, ease: "easeIn" } },
};

const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

// New variants for title and input section entrance
const titleVariants = {
  hidden: { opacity: 0, y: -50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
};

const inputSectionVariants = {
  hidden: { opacity: 0, y: 50 }, // Animate from the bottom (vertical)
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut", delay: 0.2 } }, // Animate to original position
};


const CopyPopup = ({ text }: { text: string }) => (
  <motion.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }} // Add exit animation
    className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white text-sm px-4 py-2 rounded-md shadow-lg z-50"
  >
    Copied: {text}
  </motion.div>
);

// Function to calculate SHA-256 hash
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

const getMedal = (percent: number | undefined) => {
  if (percent === undefined || typeof percent !== 'number' || isNaN(percent)) return null; // Added isNaN check
  if (percent <= 0.005) return { icon: '♦', label: 'Diamond', color: 'cyan', type: 'mineral' };
  if (percent <= 0.5) return { icon: '♦', label: 'Emerald', color: 'green', type: 'mineral' };
  if (percent <= 5) return { icon: '♦', label: 'Gold', color: 'gold', type: 'mineral' };
  if (percent <= 15) return { icon: '♦', label: 'Silver', color: 'silver', type: 'mineral' };
  // Changed 'bronze' string to a hex code for a bronze color
  if (percent <= 25) return { icon: '♦', label: 'Bronze', color: '#CD7F32', type: 'mineral' }; // Using a hex code for bronze
  return null;
};

const getPosMedal = (position: number | undefined) => {
  if (position === undefined || typeof position !== 'number' || isNaN(position)) return null; // Added isNaN check
  if (position === 1) return { icon: '✦', label: 'WR', color: 'black', type: 'rank' };
  // Changed podium color from 'white' to 'purple'
  if (position <= 5) return { icon: '✦', label: 'Podium', color: 'purple', type: 'rank' };
  return null;
};

const Leaderboard = () => {
  const [userInput, setUserInput] = useState('');
  const [userInputType, setUserInputType] = useState<'userid' | 'usertoken' | 'rank'>('userid');
  const [userId, setUserId] = useState(''); // This state will now primarily store the *resolved* user ID for display/pagination
  const [trackId, setTrackId] = useState('');
  const [isOtherTrack, setIsOtherTrack] = useState(false); // New state for "Other" track selection
  const [statsData, setStatsData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [userPage, setUserPage] = useState<number | null>(null);
  const [goToPosition, setGoToPosition] = useState('');
  const totalPagesRef = useRef(1);
  const [userData, setUserData] = useState<LeaderboardEntry | null>(null);
  const [onlyVerified, setOnlyVerified] = useState(true);
  const [recordingData, setRecordingData] = useState<(RecordingData | null)[] | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [userNotFoundOnTrack, setUserNotFoundOnTrack] = useState(false); // New state for user not found on track

  const formatTime = (frames: number) => {
    const h = Math.floor(frames / 3600000);
    const m = Math.floor((frames % 3600000) / 60000);
    const s = Math.floor((frames % 60000) / 1000);
    const ms = frames % 1000;
    return `${h > 0 ? `${h}h  ` : ''}${m > 0 || h > 0 ? `${m}m  ` : ''}${s}.${ms.toString().padStart(3, '0')}s`;
  };

  // Function to fetch leaderboard data for a specific page
  const fetchLeaderboardPage = useCallback(async (page = 1, targetTrackId: string, targetOnlyVerified: boolean, targetUserId: string | null = null) => {
    setLoading(true);
    setError(null); // Clear error on new fetch
    setCurrentPage(page);
    setStatsData(null); // Clear previous leaderboard data to show loading state
    setRecordingData(null); // Clear previous recording data
    setUserNotFoundOnTrack(false); // Reset user not found state

    try {
      const skip = (page - 1) * AMOUNT;
      // Include userTokenHash if available, but this fetch is primarily for the list
      const leaderboardUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${targetTrackId}&skip=${skip}&amount=${AMOUNT}&onlyVerified=${targetOnlyVerified}${targetUserId ? `&userTokenHash=${targetUserId}` : ''}`)}`;
      const response = await fetch(leaderboardUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard data: ${response.status}`);
      }
      const data: LeaderboardData = await response.json();

      // Ensure total is a number, default to 0 if not
      const totalEntries = typeof data.total === 'number' ? data.total : 0;
      totalPagesRef.current = Math.ceil(totalEntries / AMOUNT);


      // Fetch recording data for entries on this page
      if (data.entries.length > 0) {
        const recordingIds = data.entries.map((entry) => entry.id).join(',');
        const recordingUrl = `${PROXY_URL}${encodeURIComponent(RECORDING_API_BASE_URL + `?version=${VERSION}&recordingIds=${recordingIds}`)}`;
        const recordingResponse = await fetch(recordingUrl);
        setRecordingData(recordingResponse.ok ? await recordingResponse.json() : Array(data.entries.length).fill(null));
      } else {
        setRecordingData([]);
      }

      // Enrich entries with calculated rank and percent
      const enrichedEntries = data.entries.map((entry, index) => {
          // Rank is based on the index in the current page + the number of skipped entries + 1
          const rank = skip + index + 1;
          // Calculate percent only if totalEntries > 0 and rank is a valid number
          const percent = totalEntries > 0 && typeof rank === 'number' ? (rank / totalEntries) * 100 : undefined;

          return {
              ...entry,
              rank: rank,
              percent: percent
          };
      });


      setStatsData({ ...data, entries: enrichedEntries }); // Update statsData with enriched entries

    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching leaderboard data.');
      setStatsData(null);
      setRecordingData(null);
    } finally {
      setLoading(false); // Ensure loading is set to false regardless of success or failure
    }
  }, [AMOUNT, PROXY_URL, API_BASE_URL, VERSION, RECORDING_API_BASE_URL]); // Dependencies for fetchLeaderboardPage

  // Function to fetch specific user data based on resolved userId and trackId
  const fetchAndSetUserData = useCallback(async (targetUserId: string, targetTrackId: string, targetOnlyVerified: boolean) => {
       setUserData(null); // Clear previous user data
       setUserPage(null); // Clear user page
       setUserNotFoundOnTrack(false); // Reset user not found state

       if (!targetUserId || !targetTrackId) {
           setUserData(null);
           setUserPage(null);
           setUserNotFoundOnTrack(false);
           return null; // Return null if input is invalid
       }

       try {
           // First, fetch just the userEntry to get the position and total count
           const initialUserFetchUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${targetTrackId}&skip=0&amount=1&onlyVerified=${targetOnlyVerified}&userTokenHash=${targetUserId}`)}`;
           const initialUserResponse = await fetch(initialUserFetchUrl);

           if (!initialUserResponse.ok) {
               console.warn(`Initial user fetch failed: ${initialUserResponse.status}`);
               // This might be a network error, not necessarily user not found
               setUserData(null);
               setUserPage(null);
               setUserNotFoundOnTrack(false); // Don't set true for general fetch error
               return null;
           }

           const initialUserData: LeaderboardData = await initialUserResponse.json();

           // Check if userEntry is null in the initial fetch result
           if (!initialUserData.userEntry) {
               console.log(`User ${targetUserId} not found on track ${targetTrackId}.`);
               setUserData(null);
               setUserPage(null);
               setUserNotFoundOnTrack(true); // Set user not found state to true
               return null; // User not found, stop here
           }

           // Extract user position and total entries from the initial fetch
           const userPosition = initialUserData.userEntry && typeof initialUserData.userEntry.position === 'number'
                                ? initialUserData.userEntry.position
                                : undefined;
           const totalEntries = typeof initialUserData.total === 'number' ? initialUserData.total : 0;


           // Now, fetch the specific entry using the determined position (if available)
           // We still need this second fetch to get the full entry details like name, colors, frames
           const specificUserSkip = typeof userPosition === 'number' ? Math.max(0, userPosition - 1) : 0; // Use position for skip if available
           const specificUserFetchUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${targetTrackId}&skip=${specificUserSkip}&amount=1&onlyVerified=${targetOnlyVerified}${targetUserId ? `&userTokenHash=${targetUserId}` : ''}`)}`;
           const specificUserResponse = await fetch(specificUserFetchUrl);

           if (!specificUserResponse.ok) {
               console.warn(`Specific user fetch failed: ${specificUserResponse.status}`);
               setUserData(null);
               setUserPage(null);
               setUserNotFoundOnTrack(false); // Don't set true for general fetch error
               return null;
           }

           const specificUserData: LeaderboardData = await specificUserResponse.json();

           // Ensure entries array exists and contains at least one entry, and that it matches the target user
           if (specificUserData.entries && specificUserData.entries.length > 0 && specificUserData.entries[0].userId === targetUserId) {
               const userEntry = specificUserData.entries[0]; // The user's entry should be the first (and only) one

                // Use the userPosition from the initial fetch for rank calculation
                const rank = userPosition;
                // Calculate percent only if totalEntries > 0 && rank is a valid number
                const percent = totalEntries > 0 && typeof rank === 'number' ? (rank / totalEntries) * 100 : undefined;


                const finalUserEntry: LeaderboardEntry = {
                    id: userEntry.id,
                    userId: userEntry.userId || 'ID Unavailable',
                    name: userEntry.name || 'Name Unavailable',
                    carColors: userEntry.carColors || '',
                    frames: userEntry.frames,
                    verifiedState: userEntry.verifiedState,
                    position: userEntry.position, // Keep original position from second fetch if needed elsewhere
                    rank: rank, // Assign rank from initial fetch
                    percent: percent // Assign calculated percent
                };
                setUserData(finalUserEntry);
                // Only set userPage if rank is a valid number
                if (typeof rank === 'number') {
                    setUserPage(Math.ceil(rank / AMOUNT));
                } else {
                    setUserPage(null);
                }
                setUserNotFoundOnTrack(false); // User found, ensure this is false
                return finalUserEntry; // Return the fetched user data
           } else {
               console.warn('Specific user fetch returned no entries or mismatched user.');
               setUserData(null);
               setUserPage(null);
               setUserNotFoundOnTrack(true); // Set user not found state to true
               return null;
           }

       } catch (err: any) {
           console.error('Error in fetchAndSetUserData:', err);
           setUserData(null);
           setUserPage(null);
           setUserNotFoundOnTrack(false); // Don't set true for general fetch error
           setError(err.message || 'An error occurred while fetching user data.'); // Set a general error for fetch issues
           return null;
       } finally {
           // This finally block is not needed here as loading state is managed by processUserInputAndFetchData
           // but keeping it consistent with the previous structure.
       }
   }, [AMOUNT, PROXY_URL, API_BASE_URL, VERSION]); // Dependencies for fetchAndSetUserData


  // Combined function to process input, fetch user data, and then fetch leaderboard data
  const processUserInputAndFetchData = useCallback(async () => {
      setError(null); // Clear error at the start of processing
      setUserId(''); // Clear resolved userId when input changes
      setUserData(null); // Clear user data when input changes
      setStatsData(null); // Clear stats data when input changes
      setRecordingData(null); // Clear recording data when input changes
      setUserNotFoundOnTrack(false); // Reset user not found state

      if (!userInput || !trackId) { // Track ID is now required for all input types
         if (!userInput) {
             const inputTypeLabel = userInputType === 'userid' ? 'User ID' : userInputType === 'usertoken' ? 'User Token' : 'Rank';
             setError(`Please enter a value for ${inputTypeLabel}.`);
         } else if (!trackId) {
             setError('Please select or enter a Track ID.');
         }
        setLoading(false); // Ensure loading is false if inputs are missing
        return;
      }

      setLoading(true); // Set loading true when processing starts

      let targetUserId = '';
      let processingError: string | null = null; // Use a local variable for errors during processing

      if (userInputType === 'userid') {
        targetUserId = userInput;
      } else if (userInputType === 'usertoken') {
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
            // Fetch the entry at rank - 1 with amount 1 to get the user ID
            const skip = Math.max(0, rank - 1);
            const rankLookupUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${trackId}&skip=${skip}&amount=1&onlyVerified=${onlyVerified}`)}`;
            const response = await fetch(rankLookupUrl);

            if (!response.ok) {
              throw new Error(`Failed to fetch user by rank: ${response.status}`);
            }

            const data: LeaderboardData = await response.json();

            if (data.entries && data.entries.length > 0) {
              targetUserId = data.entries[0].userId;
            } else {
              processingError = `No user found at rank ${rank} on this track.`; // More specific message
              setUserNotFoundOnTrack(true); // Set user not found state
            }
          } catch (err: any) {
            processingError = err.message || 'An error occurred while fetching user by rank.';
          }
        } else {
          processingError = 'Please enter a valid positive number for Rank.';
        }
      }

      // If there was a processing error, set the error state and stop
      if (processingError) {
          setError(processingError);
          setLoading(false);
          return;
      }

      // If we successfully determined a targetUserId and have a trackId, proceed with fetching
      if (targetUserId && trackId) {
          setUserId(targetUserId); // Set the resolved userId for display/pagination

          // Fetch user specific data first
          const fetchedUserData = await fetchAndSetUserData(targetUserId, trackId, onlyVerified);

          // Then fetch leaderboard data for the first page, including the targetUserId
          // Pass the targetUserId to fetchLeaderboardPage so it can potentially highlight the user
          // Only fetch leaderboard if user data fetch didn't indicate user not found on track
          if (!userNotFoundOnTrack) { // Check the state variable
             fetchLeaderboardPage(1, trackId, onlyVerified, targetUserId);
          } else {
              setLoading(false); // Stop loading if user not found on track
          }


      }
      else {
          setLoading(false);
      }

  }, [userInput, userInputType, trackId, onlyVerified, fetchAndSetUserData, fetchLeaderboardPage, PROXY_URL, API_BASE_URL, VERSION, userNotFoundOnTrack]); // Added userNotFoundOnTrack to dependencies


  const handlePageChange = (newPage: number) => {
      // Only proceed if not currently loading and we have a trackId
      // Pass the current resolved userId to highlight it on the new page
      if (!loading && trackId) {
         fetchLeaderboardPage(newPage, trackId, onlyVerified, userId); // Changed back to fetchData for pagination
      } else if (loading) {
          setError('Already loading data. Please wait.');
      } else {
          setError('Please enter Track ID first.');
      }
  };

  const handleGoToPage = () => {
    const pos = parseInt(goToPosition, 10);
    // Only proceed if not currently loading, inputs are valid, and we have a trackId
    if (!loading && trackId && !isNaN(pos) && pos > 0 && statsData?.total !== undefined && pos <= statsData.total) { // Check against total entries
      // Pass the current resolved userId to highlight it on the new page
      fetchLeaderboardPage(Math.ceil(pos / AMOUNT), trackId, onlyVerified, userId); // Changed back to fetchData
      setGoToPosition('');
    } else if (loading) {
        setError('Already loading data. Please wait.');
    } else if (!trackId) {
        setError('Please enter Track ID first.');
    }
     else if (statsData?.total === undefined) {
         setError('Total entries not available yet.');
     }
    else {
      setError(`Invalid position. Please enter a number between 1 and ${statsData?.total ?? 'N/A'}.`);
    }
  };

   const inputPlaceholder = userInputType === 'userid' ? 'User ID' :
                             userInputType === 'usertoken' ? 'User Token' :
                             'Rank';

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
    if (!carColors) return 'No Color Data';
    const colors = carColors.match(/.{1,6}/g);
    if (!colors) return 'Invalid Color Data';
    return (
      <div className="flex gap-2 items-center flex-wrap justify-start">
        {colors.map((c, i) => {
          const hex = `#${c.padEnd(6, '0')}`;
          return (
            <motion.div
              key={i}
              style={{ backgroundColor: hex, cursor: 'pointer' }}
              className="w-4 h-4 rounded-full"
              // Add tooltip attributes
              data-tooltip-id="colorTooltip"
              data-tooltip-content={hex}
              onClick={() => copyToClipboard(hex)}
              whileHover={{ scale: 1.2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            />
          );
        })}
        {/* Car Colors Copy Button - Styled like User ID/Recording copy buttons */}
        <Button
          variant="ghost" // Use ghost variant
          size="sm"
          onClick={() => copyToClipboard(carColors)}
          className="p-1 h-auto text-gray-400 hover:text-white hover:bg-gray-700/20 flex-shrink-0" // Added hover background
          title="Copy Car Colors"
        >
          <Copy className="w-3 h-3" />
        </Button>
        {/* Tooltip for color circles */}
        <Tooltip id="colorTooltip" className="rounded-md" style={{ backgroundColor: "rgb(27, 21, 49)", color: "white", fontSize: "1rem", padding: "0.25rem 0.5rem" }} />
      </div>
    );
  };

  const VerifiedStateIcon = ({ verifiedState }: { verifiedState: number }) => {
    const icons = [
      <Circle className="w-4 h-4 text-gray-400" key="unverified" />, // Assuming 0 is unverified
      <CheckCircle className="w-4 h-4 text-green-500" key="verified" />, // Assuming 1 is verified
      <Circle className="w-4 h-4 text-gray-400" key="unknown" />, // Default or other states
    ];
    // Use verifiedState to index, with a fallback
    return icons[verifiedState] || icons[2];
  };


  const displayRecording = (rec: string | null, isUserEntry: boolean, textColorClass: string = 'text-blue-400') => {
    if (!rec) {
      return <span className="text-gray-400">No Data</span>;
    }

    return (
      <div className="flex items-center gap-2 overflow-hidden"> {/* Flex container for text and button */}
        <span className={cn("font-mono text-sm truncate", textColorClass)}> {/* Applied text color class */}
          {rec}
        </span>
        {/* Recording Data Copy Button - Added grey/transparent hover */}
        <Button
          variant="ghost" // Use ghost variant for a subtle button
          size="sm"
          onClick={() => copyToClipboard(rec)}
          className="p-1 h-auto text-gray-400 hover:text-white hover:bg-gray-700/20 flex-shrink-0" // Added hover background
          title="Copy Recording Data"
        >
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    );
  };

  // Determine if the current error suggests an input type issue
  const showErrorSuggestion = error && (
      error.includes("User not found") ||
      error.includes("Could not find user data") ||
      error.includes("No user found at rank") ||
      error.includes("valid positive number for Rank") ||
      error.includes("Failed to hash user token") ||
      // Also check for generic fetch errors if inputs are present, as it could be a type issue
      (error.includes("Failed to fetch") && (userInput || trackId))
  );


  return (
    // Main container with background and consistent flex centering
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-4 md:p-8 flex flex-col justify-center items-center"> {/* Added flex-col for consistent centering */}
      <AnimatePresence>
        {copiedText && <CopyPopup text={copiedText} />}
      </AnimatePresence>
      {/* Motion div for the main content block */}
      <motion.div
        // Add initial and animate for the fade-in and slide-up animation on load
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "w-full space-y-6", // Base classes
          statsData || userNotFoundOnTrack ? "max-w-6xl" : "max-w-2xl" // Conditionally apply max-width based on statsData or userNotFoundOnTrack
        )}
        layout // Enable layout animations for smooth size changes
      >
        {/* Increased font size for the title - Animated separately */}
        <motion.h1
          variants={titleVariants} // Use new title variants
          initial="hidden"
          animate="visible"
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"
        >
          Leaderboard
        </motion.h1>

        {/* Animated Card wrapping the input section */}
        <motion.div
           variants={cardVariants} // Use card variants for the input card
           initial="hidden"
           animate="visible"
           layout // Enable layout animations for smooth size changes
        >
          <Card className="bg-gray-800/50 text-white border-purple-500/30 shadow-lg"> {/* Added styling classes */}
              <CardHeader>
                  <CardTitle className="text-blue-400 text-2xl">Leaderboard Search</CardTitle> {/* Updated Title */}
                  <CardDescription className="text-gray-400">
                      Search the leaderboard by User ID, User Token, or Rank.
                  </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  {/* Animated Input/Select Row */}
                  <motion.div variants={itemVariants} initial="hidden" animate="visible">
                      <div className="flex flex-col sm:flex-row gap-4 items-center">
                          {/* User Input Type Select */}
                          <Select onValueChange={(value: 'userid' | 'usertoken' | 'rank') => {
                              setUserInputType(value);
                              setUserInput('');
                              setUserId(''); // Clear resolved user ID
                              setUserData(null); // Clear user data
                              setStatsData(null); // Clear stats data
                              setRecordingData(null); // Clear recording data
                              setError(null);
                              setUserPage(null); // Clear user page
                              setGoToPosition(''); // Clear go to position
                              setUserNotFoundOnTrack(false); // Reset user not found state
                          }} defaultValue={userInputType}>
                              <SelectTrigger className="w-[180px] bg-black/20 text-white border-purple-500/30 focus:ring-purple-500/50">
                                  <SelectValue placeholder="Select Input Type" />
                              </SelectTrigger>
                              <SelectContent className="bg-gray-800 text-white border-purple-500/30">
                                  <SelectItem value="userid">User ID</SelectItem>
                                  <SelectItem value="usertoken">User Token</SelectItem>
                                  <SelectItem value="rank">Rank</SelectItem>
                              </SelectContent>
                          </Select>

                          {/* User Input Field */}
                          <Input
                            type={userInputType === 'rank' ? 'number' : 'text'}
                            placeholder={inputPlaceholder}
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            className="flex-1 bg-black/20 text-white border-purple-500/30 placeholder:text-gray-500 focus:ring-purple-500/50"
                          />
                      </div>
                  </motion.div>

                  {/* Conditional Note for User Token (Animated) */}
                  <AnimatePresence>
                    {userInputType === 'usertoken' && (
                       <motion.div variants={alertVariants} initial="initial" animate="animate" exit="exit">
                       </motion.div>
                    )}
                  </AnimatePresence>


                  {/* Conditional rendering for Track ID input/select (now for all input types) */}
                  <AnimatePresence>
                  {(userInputType === 'rank' || userInputType === 'userid' || userInputType === 'usertoken') && ( // Show for all input types
                      <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="exit"> {/* Animated container for track specific inputs */}
                          <> {/* Fragment to group conditional elements */}
                              {/* Corrected: Use local trackId state for the input field */}
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
                                          setTrackId(''); // Clear trackId when switching to 'Other'
                                      } else {
                                          setIsOtherTrack(false); // Already false, but good practice
                                          setTrackId(value);
                                      }
                                  }} value={trackId || ''}>
                                      <SelectTrigger className="flex-1 bg-black/20 text-white border-purple-500/30 focus:ring-purple-500/50">
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
                               {/* Warning Message for Rank method (Animated) - Only show for Rank input */}
                               <AnimatePresence>
                                   {userInputType === 'rank' && (
                                       <motion.div variants={alertVariants} initial="initial" animate="animate" exit="exit">
                                       </motion.div>
                                   )}
                               </AnimatePresence>
                          </>
                      </motion.div>
                  )}
                  </AnimatePresence>

                   {/* Only Verified Switch (Animated) - Implemented with standard HTML and Tailwind */}
                   <motion.div variants={itemVariants} initial="hidden" animate="visible" exit="hidden">
                       <div className="flex items-center space-x-2">
                           {/* Custom Switch Implementation */}
                           <button
                               role="switch"
                               aria-checked={onlyVerified}
                               onClick={() => setOnlyVerified(!onlyVerified)}
                               className={cn(
                                   "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black",
                                   onlyVerified ? 'bg-purple-500' : 'bg-gray-700', // Track color based on state
                                   'focus:ring-purple-500' // Focus ring
                               )}
                           >
                               <span className="sr-only">Toggle verified filter</span>
                               <span
                                   aria-hidden="true"
                                   className={cn(
                                       "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                       onlyVerified ? 'translate-x-5' : 'translate-x-0' // Thumb position based on state
                                   )}
                               ></span>
                           </button>
                           {/* Custom Label Implementation */}
                           <label htmlFor="verified-toggle" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-white">
                             Only Verified
                           </label>
                       </div>
                   </motion.div>


                  {/* Search Button (Animated) */}
                  <motion.div variants={itemVariants} initial="hidden" animate="visible">
                      <Button
                        onClick={processUserInputAndFetchData}
                        // Corrected: Disable if input or trackId is empty (now required for all)
                        disabled={loading || !userInput || !trackId}
                        className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-3 rounded-full transition-all duration-300 hover:from-purple-600 hover:to-blue-600 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-0"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading...
                          </>
                        ) : (
                          <>
                            <Search className="w-5 h-5" />
                            Search
                           </>
                         )}
                       </Button>
                   </motion.div>
               </CardContent>
           </Card>
        </motion.div>


         {/* Error Message - Animated */}
         <AnimatePresence>
           {error && (
             <motion.div
               initial="initial"
               animate="animate"
               exit="exit"
               variants={alertVariants}
             >
               <Alert variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/30">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Error</AlertTitle>
                 <AlertDescription>{error}</AlertDescription>
               </Alert>
             </motion.div>
           )}
         </AnimatePresence>


         {/* Conditional suggestion below the error message with box and border - Animated */}
         <AnimatePresence>
           {showErrorSuggestion && (
             <motion.div
               initial="initial"
               animate="animate"
               exit="exit"
               variants={alertVariants}
               className="flex items-center justify-center gap-2 text-yellow-400 text-sm text-center mt-2 p-3 border border-yellow-400 rounded-md bg-yellow-400/20"
             >
                 <TriangleAlert className="h-4 w-4" /> {/* Changed icon */}
                 <span>Suggestion: Please double-check the input value and ensure the correct input type is selected (User ID, User Token, or Rank).</span>
             </motion.div>
           )}
         </AnimatePresence>


         {/* Stats and Leaderboard Section - Render only when statsData is available OR userNotFoundOnTrack is true */}
         <AnimatePresence mode="wait"> {/* Use mode="wait" to finish exit animation before new enters */}
           {(statsData && statsData.entries) || userNotFoundOnTrack ? ( // Render if statsData is available OR userNotFoundOnTrack is true
             <motion.div
               key="leaderboard-results" // Unique key for AnimatePresence
               initial={{ opacity: 0, y: 50 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 50 }}
               transition={{ duration: 0.5 }}
               className="space-y-4"
               layout // Enable layout animations for smooth size changes
             >
               {/* User Stats Card */}
               {/* Conditional rendering for User Stats */}
               {loading ? (
                   <Card className="bg-black/20 text-white border-purple-500/30 shadow-lg w-full">
                       <CardHeader>
                           <CardTitle className="flex items-center gap-2 text-purple-400">
                               <User className="w-5 h-5" />
                               Your Stats
                           </CardTitle>
                       </CardHeader>
                       <CardContent>
                           <p>Loading user stats...</p>
                       </CardContent>
                   </Card>
               ) : error ? (
                    // Error message is already handled by the main error alert
                    null
               ) : userNotFoundOnTrack ? (
                   <Card className="bg-black/20 text-white border-purple-500/30 shadow-lg w-full">
                       <CardHeader>
                           <CardTitle className="flex items-center gap-2 text-purple-400">
                               <User className="w-5 h-5" />
                               Your Stats
                           </CardTitle>
                       </CardHeader>
                       <CardContent>
                           <p>User not found on this track.</p> {/* Specific message */}
                       </CardContent>
                   </Card>
               ) : userData ? (
                 <>
                   <div className="text-center">
                     <p className="text-lg sm:text-xl font-semibold text-purple-300 tracking-wide mb-2 flex items-center justify-center gap-2">
                       <User className="w-5 h-5" />
                       Your Stats
                     </p>
                     <p className="text-gray-400">Your personal performance.</p>
                   </div>
                   {/* Determine box and text styles for Your Stats based on userData */}
                   {(() => {
                       const medal = getMedal(userData.percent as number | undefined);
                       const posMedal = getPosMedal(userData.rank as number | undefined);
                       let userStatsBoxStyle = 'bg-black/20 border-purple-500/30';
                       let userStatsDataTextStyle = 'text-blue-400';

                       if (posMedal && posMedal.color === 'black') { // WR
                           userStatsBoxStyle = 'bg-black/20 border-2 border-black/50';
                           userStatsDataTextStyle = 'text-gray-100';
                       } else if (posMedal && posMedal.color === 'purple') { // Podium (Updated condition to 'purple')
                           userStatsBoxStyle = 'bg-purple-500/20 border-2 border-purple-500/50';
                           userStatsDataTextStyle = 'text-purple-300';
                       } else if (medal) { // Mineral medals
                           switch (medal.color) {
                               case 'cyan':
                                   userStatsBoxStyle = 'bg-cyan-500/20 border-2 border-cyan-500/50';
                                   userStatsDataTextStyle = 'text-cyan-300';
                                   break;
                               case 'green':
                                   userStatsBoxStyle = 'bg-green-500/20 border-2 border-green-500/50';
                                   userStatsDataTextStyle = 'text-green-300';
                                   break;
                               case 'gold': // Using yellow for gold
                                   userStatsBoxStyle = 'bg-yellow-500/20 border-2 border-yellow-500/50';
                                   userStatsDataTextStyle = 'text-yellow-300';
                                   break;
                               case 'silver': // Using gray for silver
                                   userStatsBoxStyle = 'bg-gray-400/20 border-2 border-gray-400/50';
                                   userStatsDataTextStyle = 'text-gray-200';
                                   break;
                               case '#CD7F32': // Using the hex code for bronze
                                   userStatsBoxStyle = 'bg-orange-700/20 border-2 border-orange-700/50'; // Still using orange-700 for background
                                   userStatsDataTextStyle = 'text-orange-300'; // Still using orange-300 for text
                                   break;
                               default: // Fallback
                                   userStatsBoxStyle = 'bg-black/20 border-purple-500/30';
                                   userStatsDataTextStyle = 'text-blue-400';
                           }
                       }

                       // Simplified iconColor calculation
                       const iconColor = posMedal?.color;

                       return (
                           <Card className={cn("text-white shadow-lg w-full", userStatsBoxStyle)}>
                               <CardHeader>
                                   <CardTitle className={cn("text-2xl sm:text-3xl font-bold text-center flex items-center justify-center gap-2 flex-wrap", userStatsDataTextStyle)}>
                                       {/* Display rank medal */}
                                       {posMedal ? (
                                           <>
                                               <span data-tooltip-id="statsPosMedal"
                                                     data-tooltip-content={posMedal?.label} style={{ color: iconColor }}>
                                                   {posMedal?.icon}
                                               </span>
                                               <Tooltip id="statsPosMedal" className="rounded-md" style={{ backgroundColor: "rgb(27, 21, 49)", color: iconColor, fontSize: "1rem", padding: "0.25rem 0.5rem" }} />
                                           </>
                                       ) : null}
                                       <span className='truncate'>{userData.name || 'Name Unavailable'}</span>
                                       {/* Display mineral medal */}
                                       {medal ? (
                                           <>
                                               <span data-tooltip-id="statsMedal"
                                                     data-tooltip-content={medal?.label} style={{ color: medal?.color }}>
                                                   {medal?.icon}
                                               </span>
                                               <Tooltip id="statsMedal" className="rounded-md" style={{ backgroundColor: "rgb(27, 21, 49)", color: medal?.color, fontSize: "1rem", padding: "0.25rem 0.5rem" }} />
                                           </>
                                       ) : null}
                                   </CardTitle>
                                   <CardDescription className={cn("text-xl text-center", userStatsDataTextStyle)}>
                                       {formatTime(userData.frames)}
                                   </CardDescription>
                               </CardHeader>
                               <CardContent className="space-y-4">
                                   <div className="grid grid-cols-1 gap-4">
                                       <p><span className="font-semibold text-gray-300">Rank:</span> <span className={userStatsDataTextStyle}>{typeof userData.rank === 'number' ? userData.rank : 'N/A'}</span></p>
                                       <p><span className="font-semibold text-gray-300">Top:</span> <span className={userStatsDataTextStyle}>{typeof userData.percent === 'number' ? `${userData.percent.toFixed(4)}%` : 'N/A'}</span></p>
                                       <div className="flex items-center gap-2">
                                           <p className="font-semibold text-gray-300">User ID:</p>
                                           <span className={cn('break-all', userStatsDataTextStyle)}>{userData.userId || 'ID Unavailable'}</span>
                                           {userData.userId && (
                                               <Button
                                                   variant="ghost"
                                                   size="sm"
                                                   onClick={() => copyToClipboard(userData.userId)}
                                                   className="p-1 h-auto text-gray-400 hover:text-white hover:bg-gray-700/20"
                                                   title="Copy User ID"
                                               >
                                                   <Copy className="w-3 h-3" />
                                               </Button>
                                           )}
                                       </div>
                                       <p><span className="font-semibold text-gray-300">Car Colors:</span> {displayCarColors(userData.carColors || '')}</p>
                                       <p><span className="font-semibold text-gray-300">Frames:</span> <span className={userStatsDataTextStyle}>{userData.frames} ({formatTime(userData.frames)})</span></p>
                                       <p className="flex items-center gap-1"><span className="font-semibold text-gray-300">Verified:</span><VerifiedStateIcon verifiedState={userData.verifiedState} /></p>
                                   </div>
                                   {/* Recording data integrated directly */}
                                   <div className="space-y-2">
                                       <p className="font-semibold text-gray-300">Recording:</p>
                                       {recordingData && recordingData[0] ? displayRecording(recordingData[0].recording, true, userStatsDataTextStyle) : displayRecording(null, true, userStatsDataTextStyle)}
                                   </div>
                               </CardContent>
                           </Card>
                       );
                   })()}
                 </>
               ) : (
                 // This block will now only show if not loading, no error, user not found is false, and userData is null (initial state)
                 <Card className="bg-black/20 text-white border-purple-500/30 shadow-lg w-full">
                   <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-purple-400">
                       <User className="w-5 h-5" />
                       Your Stats
                     </CardTitle>
                   </CardHeader>
                   <CardContent>
                     <p>Error loading your stats, make sure the User ID/Token and Track ID is correct.</p> {/* Updated initial message */}
                   </CardContent>
                 </Card>
               )}
               {/* Leaderboard Section - Only render if statsData is available */}
               {statsData && statsData.entries && (
                   <>
                     <div className="text-center">
                       <p className="text-lg sm:text-xl font-semibold text-blue-300 tracking-wide mb-2 flex items-center justify-center gap-2">
                         <Trophy className="w-5 h-5" />
                         Leaderboard
                       </p>
                       <p className="text-gray-400">Total Entries: {statsData?.total ?? 'N/A'}</p>
                     </div>
                     <Card className="bg-black/20 text-white border-purple-500/30 shadow-lg w-full">
                       <CardHeader />
                       <CardContent>
                         <div className="space-y-4">
                           {/* AnimatePresence for the list items */}
                           <AnimatePresence>
                             {statsData?.entries.map((entry, index) => {
                               const medal = getMedal(entry.percent as number | undefined);
                               const posMedal = getPosMedal(entry.rank as number | undefined);

                               // Determine text color and box style based on whether it's the user's entry
                               const isCurrentUserEntry = entry.userId === userId;
                               let entryBoxStyle = 'bg-gray-800/50 border border-gray-700';
                               let entryDataTextStyle = 'text-blue-300'; // Default color for non-user entry data

                               if (isCurrentUserEntry) {
                                 // User's entry - apply specific styles based on rank/medal
                                 if (posMedal && posMedal.color === 'black') { // WR
                                     entryBoxStyle = 'bg-black/20 border-2 border-black/50';
                                     entryDataTextStyle = 'text-gray-100'; // White/gray for contrast
                                 } else if (posMedal && posMedal.color === 'purple') { // Podium (Updated condition to 'purple')
                                     entryBoxStyle = 'bg-purple-500/20 border-2 border-purple-500/50';
                                     entryDataTextStyle = 'text-purple-300';
                                 } else if (medal) { // Mineral medals
                                     switch (medal.color) {
                                         case 'cyan':
                                             entryBoxStyle = 'bg-cyan-500/20 border-2 border-cyan-500/50';
                                             entryDataTextStyle = 'text-cyan-300';
                                             break;
                                         case 'green':
                                             entryBoxStyle = 'bg-green-500/20 border-2 border-green-500/50';
                                             entryDataTextStyle = 'text-green-300';
                                             break;
                                         case 'gold': // Using yellow for gold
                                             entryBoxStyle = 'bg-yellow-500/20 border-2 border-yellow-500/50';
                                             entryDataTextStyle = 'text-yellow-300';
                                             break;
                                         case 'silver': // Using gray for silver
                                             entryBoxStyle = 'bg-gray-400/20 border-2 border-gray-400/50';
                                             entryDataTextStyle = 'text-gray-200';
                                             break;
                                         case '#CD7F32': // Using the hex code for bronze
                                          entryBoxStyle = 'bg-orange-700/20 border-2 border-orange-700/50'; // Still using orange-700 for background
                                          entryDataTextStyle = 'text-orange-300'; // Still using orange-300 for text
                                             break;
                                         default: // Fallback for other mineral colors or issues
                                             entryBoxStyle = 'bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-2 border-purple-500/50';
                                             entryDataTextStyle = 'text-white';
                                     }
                                 } else { // Default user highlight (if no specific medal/rank)
                                   entryBoxStyle = 'bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-2 border-purple-500/50';
                                   entryDataTextStyle = 'text-white';
                                 }
                               } else {
                                 // Not the user's entry - apply default styles
                                 entryBoxStyle = 'bg-gray-800/50 border border-gray-700';
                                 entryDataTextStyle = 'text-blue-300'; // User ID and other data text color
                               }

                               // Simplified iconColor calculation
                               const iconColor = posMedal?.color;

                               return (
                                 // motion.div for each list item
                                 <motion.div
                                   key={entry.id} // Use entry.id as key for consistent animation
                                   variants={listItemVariants}
                                   initial="hidden"
                                   animate="visible"
                                   exit="hidden" // Animate out when removed (e.g., changing page)
                                   layout // Enable layout animations
                                   className={cn(
                                     'p-4 rounded-lg',
                                     entryBoxStyle, // Use the determined box style
                                     'overflow-hidden'
                                   )}
                                 >
                                   {/* Horizontal layout for main data with consistent gap and wrapping */}
                                   <div className="flex flex-wrap items-center gap-x-4"> {/* Using gap-x for horizontal spacing */}
                                     {/* Rank */}
                                     <div className="flex items-center gap-1">
                                       <span className="font-semibold text-gray-300">Rank:</span>
                                       <span className={entryDataTextStyle}>{typeof entry.rank === 'number' ? entry.rank : 'N/A'}</span>
                                        {/* Display rank with fallback */}
                                       <div className="flex items-center justify-center w-6"> {/* Centering container */}
                                         {posMedal ? (
                                           <span data-tooltip-id={`posMedal-${entry.id}`} data-tooltip-content={posMedal?.label} style={{ color: iconColor }}>{posMedal.icon}</span>
                                         ) : null}
                                       </div>
                                     </div>
                                     {/* Name */}
                                      <div className="flex items-center gap-1 flex-1 min-w-0 truncate"> {/* Added min-w-0 to allow shrinking */}
                                        <span className="font-semibold text-gray-300">Name:</span>
                                        <span className={entryDataTextStyle + ' truncate'}>{entry.name}</span>
                                      </div>
                                     {/* Time */}
                                     <div className="flex items-center gap-1">
                                         <span className="font-semibold text-gray-300">Time:</span> {/* Changed label from Frames to Time */}
                                         <span className={entryDataTextStyle}>{formatTime(entry.frames)}</span>
                                     </div>
                                     {/* Top % */}
                                     <div className="flex items-center gap-1">
                                       <span className="font-semibold text-gray-300">Top:</span>
                                        {/* Display top % with fallback and formatting */}
                                       <span className={entryDataTextStyle}>{typeof entry.percent === 'number' ? `${entry.percent.toFixed(4)}%` : 'N/A'}</span>
                                       <div className="flex items-center justify-center w-6"> {/* Centering container */}
                                         {medal && medal.type === 'mineral' ? (
                                           <span className="ml-1" data-tooltip-id={`medal-${entry.id}`} data-tooltip-content={medal?.label} style={{ color: medal?.color }}>{medal ? medal.icon : ''}</span>
                                         ) : null}
                                       </div>
                                       <Tooltip id={`medal-${entry.id}`} className="rounded-md" style={{ backgroundColor: "rgb(27, 21, 49)", color: medal?.color, fontSize: "1rem", padding: "0.25rem 0.5rem" }} />
                                       <Tooltip id={`posMedal-${entry.id}`} className="rounded-md" style={{ backgroundColor: "rgb(27, 21, 49)", color: iconColor, fontSize: "1rem", padding: "0.25rem 0.5rem" }} />
                                     </div>
                                     {/* Verified */}
                                     <div className="flex items-center gap-1">
                                         <span className="font-semibold text-gray-300">Verified:</span>
                                         <VerifiedStateIcon verifiedState={entry.verifiedState} /> {/* Icon color is handled within the component */}
                                     </div>
                                     {/* Car Colors */}
                                     <div className="flex items-center gap-1">
                                         <span className="font-semibold text-gray-300">Colors:</span> {/* Changed label to Colors */}
                                         {displayCarColors(entry.carColors)} {/* Color display is handled within the function */}
                                     </div>
                                   </div>
                                   {/* User ID on a separate line */}
                                   <div className="mt-2 flex items-center gap-2"> {/* Added margin-top and flex container for User ID and Copy button */}
                                     <span className="font-semibold text-gray-300">User ID:</span>
                                     <span className={cn('break-all', entryDataTextStyle)}>{entry.userId}</span> {/* Applied entryDataTextStyle and break-all */}
                                     {entry.userId && (
                                         // User ID Copy Button - Added grey/transparent hover
                                         <Button
                                             variant="ghost" // Use ghost variant for a subtle button
                                             size="sm"
                                             onClick={() => copyToClipboard(entry.userId)}
                                             className="p-1 h-auto text-gray-400 hover:text-white hover:bg-gray-700/20" // Added hover background
                                             title="Copy User ID"
                                         >
                                             <Copy className="w-3 h-3" />
                                         </Button>
                                     )}
                                   </div>
                                   {/* Recording data on a separate line */}
                                   <div className="mt-2 overflow-x-auto no-scroll"> {/* Added margin-top for separation */}
                                     <span className="font-semibold text-gray-300">Recording:</span>
                                     {/* Pass isCurrentUserEntry flag to displayRecording */}
                                     {recordingData && recordingData[index] ? displayRecording(recordingData[index]?.recording || null, isCurrentUserEntry, entryDataTextStyle) : displayRecording(null, isCurrentUserEntry, entryDataTextStyle)}
                                   </div>
                                 </motion.div>
                               );
                             })}
                           </AnimatePresence>
                         </div>
                         {/* Pagination */}
                         <div className="flex items-center justify-center gap-2 mt-4">
                           <Button variant="outline" size="icon" onClick={() => handlePageChange(1)} disabled={currentPage === 1 || loading} className="bg-gray-800/50 text-white hover:bg-gray-700/50 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed">
                             <ChevronsLeft className="h-4 w-4" />
                           </Button>
                           <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loading} className="bg-gray-800/50 text-white hover:bg-gray-700/50 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed">
                             <ChevronLeft className="h-4 w-4" />
                           </Button>
                           <span className="text-gray-300">Page {currentPage} of {totalPagesRef.current}</span>
                           <Button variant="outline" size="icon" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPagesRef.current || loading} className="bg-gray-800/50 text-white hover:bg-gray-700/50 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed">
                             <ChevronRight className="h-4 w-4" />
                           </Button>
                            <Button variant="outline" size="icon" onClick={() => handlePageChange(Math.min(currentPage + 10, totalPagesRef.current))} disabled={currentPage + 10 > totalPagesRef.current || loading} className="bg-gray-800/50 text-white hover:bg-gray-700/50 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed">
                               +{10}
                           </Button>
                           <Button variant="outline" size="icon" onClick={() => handlePageChange(totalPagesRef.current)} disabled={currentPage === totalPagesRef.current || loading} className="bg-gray-800/50 text-white hover:bg-gray-700/50 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed">
                             <ChevronsRight className="h-4 w-4" />
                           </Button>
                           {userPage && (
                             <Button variant="outline" onClick={() => handlePageChange(userPage)} disabled={loading} className="bg-purple-900/50 text-white hover:bg-purple-800/50 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed">
                               Go to User's Page ({userPage})
                             </Button>
                           )}
                           <div className="flex items-center gap-2">
                             <Input
                               type="text"
                               placeholder="Go to pos."
                               value={goToPosition}
                               onChange={(e) => setGoToPosition(e.target.value)}
                               className="w-24 bg-gray-800/50 text-white border-gray-700 placeholder:text-gray-500 focus:ring-purple-500/50"
                               onKeyDown={(e) => { if (e.key === 'Enter') handleGoToPage(); }}
                             />
                             <Button onClick={handleGoToPage} disabled={loading} className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed">
                               Go
                             </Button>
                           </div>
                         </div>
                       </CardContent>
                     </Card>
                   </>
               )}
             </motion.div>
           ) : null} {/* Render nothing if neither statsData nor userNotFoundOnTrack is true */}
         </AnimatePresence>
       </motion.div>
       {/* Version and Link - Positioned outside the animated motion.div */}
       {/* Conditionally render this div based on whether statsData is null AND userNotFoundOnTrack is false */}
       {!statsData && !userNotFoundOnTrack && (
         <div className="text-center text-gray-500 text-sm mt-4 absolute bottom-4 left-1/2 transform -translate-x-1/2">
           <p>Version: {VERSION}</p>
           <p>
             Play the game: <a href="https://www.kodub.com/apps/polytrack" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Polytrack</a>
           </p>
         </div>
       )}
       <style>{
         `.no-scroll::-webkit-scrollbar {
           display: none;
         }
         .no-scroll {
           -ms-overflow-style: none;
           scrollbar-width: none;
         }`
       }</style>
     </div>
   );
 };

 export default Leaderboard;

