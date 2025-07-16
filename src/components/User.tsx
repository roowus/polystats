import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Fixed import syntax
import { Search, Trophy, User, Circle, CheckCircle, Copy, AlertCircle, TriangleAlert, ArrowUpDown, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip } from 'react-tooltip';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Define interfaces for API data
interface LeaderboardEntry {
    id: number;
    userId: string;
    name: string;
    carColors: string;
    frames: number;
    verifiedState?: number; // Made optional as it might be missing
    position: number; // Position is crucial for fetching the full entry
    rank?: number; // Rank is often the same as position but included for clarity
    percent?: number;
    wrTime?: number;
    wrTimeGap?: number;
    wrPercentGap?: number;
}

type LeaderboardEntryWithTrackName = LeaderboardEntry & { trackName: string; trackId: string };

interface UserBasicData {
    name: string;
    carColors: string;
    isVerifier: boolean | 'N/A';
}

interface AverageStats {
    avgTime: string;
    avgRank: string | number;
    avgPercent: string | number;
    rawAvgRank: number | undefined;
    rawAvgPercent: number | undefined;
    avgWrTimeGap?: string;
    avgWrPercentGap?: string;
    rawAvgPercentGap?: number; // Added raw average percent gap
}

interface Medal {
    icon: string;
    label: string;
    color: string;
    type: 'mineral' | 'rank' | 'wr_percent_gap'; // Added new medal type
}

interface BestWorstStats {
    bestTime?: LeaderboardEntryWithTrackName;
    worstTime?: LeaderboardEntryWithTrackName;
    bestRank?: LeaderboardEntryWithTrackName;
    worstRank?: LeaderboardEntryWithTrackName;
    bestPercent?: LeaderboardEntryWithTrackName;
    worstPercent?: LeaderboardEntryWithTrackName;
    bestWrTimeGap?: LeaderboardEntryWithTrackName;
    worstWrTimeGap?: LeaderboardEntryWithTrackName;
    bestWrPercentGap?: LeaderboardEntryWithTrackName;
    worstWrPercentGap?: LeaderboardEntryWithTrackName;
}

interface TrackWithUserData {
    trackName: string;
    trackId: string;
    originalIndex: number;
    userData?: LeaderboardEntry | { error: string, retryCount: number } | null;
    wrTime?: number | null;
}


// Define the predefined tracks - ENSURE THESE ARE UNCHANGED
const OFFICIAL_TRACKS = [
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
];

const COMMUNITY_TRACKS = [
    { name: '90xRESET', id: '4d0f964b159d51d6906478bbb87e1edad21b0f1eb2972af947be34f2d8c49ae9' },
    { name: 'concrete jungle', id: '0544f97453f7b0e2a310dfb0dcd331b4060ae2e9cb14ac27dc5367183dab0513' },
    { name: 'lu muvimento', id: '2ccd83e9419b6071ad9272b73e549e427b1a0f62d5305015839ae1e08fb86ce6' },
    { name: 'Re : Akina', id: 'f112ab979138b9916221cbf46329fa7377a745bdd18cd3d00b4ffd6a8a68f113' },
    { name: "Hyperion's Sanctuary", id: 'b41ac84904b60d00efa5ab8bb60f42c929c16d8ebbfe2f77126891fcddab9c1c' },
    { name: 'Opal Palace - Repolished', id: '89f1a70d0e6be8297ec340a378b890f3fed7d0e20e3ef15b5d32ef4ef7ff1701' },
    { name: 'Snow Park', id: '2978b99f058cb3a2ce6f97c435c803b8d638400532d7c79028b2ec3d5e093882' },
    { name: 'Winter Hollow', id: '2046c377ac7ec5326b263c46587f30b66ba856257ddc317a866e3e7f66a73929' },
    { name: 'Arabica', id: '1aadcef252749318227d5cd4ce61a4a71526087857104fd57697b6fc63102e8a' },
    { name: 'Clay temples', id: '773eb0b02b97a72f3e482738cda7a5292294800497e16d9366e4f4c88a6f4e2d' }, // Corrected ID
    { name: 'DESERT STALLION', id: '932da81567f2b223fa1a52d88d6db52016600c5b9df02218f06c9eb832ecddeb' },
    { name: 'Las Calles', id: '97da746d9b3ddd5a861fa8da7fcb6f6402ffa21f8f5cf61029d7a947bad76290' },
    { name: 'Last Remnant', id: '19335bb082dfde2af4f7e73e812cd54cee0039a9eadf3793efee3ae3884ce423' },
    { name: 'Malformations', id: 'bc7d29657a0eb2d0abb3b3639edcf4ade61705132c7ca1b56719a7a110096afd' },
    { name: 'Sandline Ultimatum', id: 'faed71cf26ba4d183795ecc93e3d1b39e191e51d664272b512692b0f4f323ff5' },
];

const ALL_TRACKS = [...OFFICIAL_TRACKS, ...COMMUNITY_TRACKS]; // Combined list for searching basic data

const API_BASE_URL = 'https://vps.kodub.com:43273/leaderboard';
const USER_API_BASE_URL = 'https://vps.kodub.com:43273/user'; // User specific API
const PROXY_URL = 'https://hi-rewis.maxicode.workers.dev/?url='; // Using the provided proxy
const VERSION = '0.5.0'; // Version number
const MAX_RETRY_ATTEMPTS = 5; // Maximum number of auto-retries per track
const AUTO_RETRY_INTERVAL = 7000; // Interval to check for failed tracks (7 seconds)


// Function to calculate SHA-256 hash
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Helper to format frames into time string (frames are in milliseconds)
const formatTime = (frames: number | undefined | null) => { // Added null to type
    if (typeof frames !== 'number' || isNaN(frames) || frames < 0) return 'N/A';

    // Total milliseconds
    const totalMilliseconds = frames;

    // Calculate hours, minutes, seconds, and milliseconds
    const ms = Math.round(totalMilliseconds % 1000); // Round milliseconds to nearest integer
    const totalSeconds = Math.floor(totalMilliseconds / 1000);

    // Corrected calculation for hours, minutes, and seconds
    const h = Math.floor(totalSeconds / 3600);
    const remainingSecondsAfterHours = totalSeconds % 3600;
    const m = Math.floor(remainingSecondsAfterHours / 60);
    const s = remainingSecondsAfterHours % 60;

    // Always include milliseconds with 3 digits
    const formattedTime = `${h > 0 ? `${h}h ` : ''}${m > 0 || h > 0 ? `${m}m ` : ''}${s}.${ms.toString().padStart(3, '0')}s`;

    return formattedTime;
  };

// Helper to get medal based on percent rank - Updated to return CSS color
const getMedal = (percent: number | undefined): Medal | null => {
  if (percent === undefined || isNaN(percent)) return null;
  // Using standard CSS color values (hex or names)
  if (percent <= 0.005) return { icon: '♦', label: 'Diamond', color: '#67E8F9', type: 'mineral' }; // Cyan 400
  if (percent <= 0.5) return { icon: '♦', label: 'Emerald', color: '#22C55E', type: 'mineral' }; // Green 500
  if (percent <= 5) return { icon: '♦', label: 'Gold', color: '#FACC15', type: 'mineral' }; // Amber 400
  if (percent <= 15) return { icon: '♦', label: 'Silver', color: '#9CA3AF', type: 'mineral' }; // Gray 400
  // Updated Bronze color to CD7F32
  if (percent <= 25) return { icon: '♦', label: 'Bronze', color: '#CD7F32', type: 'mineral' };
  return null;
};

// Helper to get medal based on rank (position or average rank) - Renamed from getPosMedal
const getRankMedal = (rank: number | undefined): Medal | null => { // Renamed from getPosMedal
  if (rank === undefined || isNaN(rank) || rank <= 0) return null;
  // Using standard CSS color values (hex or names)
  if (rank === 1) return { icon: '✦', label: 'WR', color: '#000000', type: 'rank' }; // Black
  if (rank <= 5) return { icon: '✦', label: 'Podium', color: '#5A32A3', type: 'rank' }; // Darker Purple
  // New tiers for average ranks
  if (rank <= 10) return { icon: '✦', label: 'Top 10', color: '#9370DB', type: 'rank' }; // MediumPurple
  if (rank <= 25) return { icon: '✦', label: 'Top 25', color: '#4169E1', type: 'rank' }; // RoyalBlue
  if (rank <= 50) return { icon: '✦', label: 'Top 50', color: '#87CEEB', type: 'rank' }; // SkyBlue
  // Add a "Participant" medal for ranks > 50 to ensure a medal is always shown if rank is present
  if (rank > 50) return { icon: '✦', label: 'Participant', color: '#A0A0A0', type: 'rank' }; // Grey
  return null; // Should not be reached if rank is a positive number
};

// New Helper to get medal based on WR Percent Gap - Adjusted Thresholds for Mythic
const getWrPercentGapMedal = (percentGap: number | undefined): Medal | null => {
    if (percentGap === undefined || isNaN(percentGap) || percentGap < 0) return null;

    // Define tiers and colors for WR Percent Gap medal
    // Using a star icon ★
    if (percentGap === 0) return { icon: '★', label: 'Perfect', color: '#FFD700', type: 'wr_percent_gap' }; // Gold
    if (percentGap < 0.1) return { icon: '★', label: 'Legendary', color: '#9400D3', type: 'wr_percent_gap' }; // DarkViolet - Adjusted from < 0.5
    // Changed Mythic color to purple hex #800080
    if (percentGap < 0.5) return { icon: '★', label: 'Mythic', color: '#800080', type: 'wr_percent_gap' }; // Purple - New medal
    if (percentGap < 2) return { icon: '★', label: 'Epic', color: '#FF1493', type: 'wr_percent_gap' }; // DeepPink - Adjusted from < 2
    if (percentGap < 7) return { icon: '★', label: 'Great', color: '#00BFFF', type: 'wr_percent_gap' }; // DeepSkyBlue - Adjusted from < 7
    if (percentGap < 15) return { icon: '★', label: 'Good', color: '#32CD32', type: 'wr_percent_gap' }; // LimeGreen - Adjusted from < 15
    if (percentGap < 30) return { icon: '★', label: 'Decent', color: '#FFA500', type: 'wr_percent_gap' }; // Orange - Adjusted from < 30
    return null; // No medal for gaps >= 30%
};


// Component for the copy popup animation
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

const UserViewer = () => {
  const [userInput, setUserInput] = useState('');
  const [userInputType, setUserInputType] = useState<'userid' | 'usertoken'>('userid');
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null); // The actual user ID hash
  const [basicUserData, setBasicUserData] = useState<UserBasicData | null>(null); // User's basic info
  // State to store fetched user entries, indexed by track ID for quick lookup
  // This map will now store LeaderboardEntry | { error: string, retryCount: number } | null
  const [userEntriesByTrack, setUserEntriesByTrack] = useState<Map<string, LeaderboardEntry | { error: string, retryCount: number } | null>>(() => new Map());
  // State to store fetched WR times, indexed by track ID
  const [wrTimesByTrack, setWrTimesByTrack] = useState<Map<string, number | null>>(() => new Map());


  // Keep track of tracks where user has entries for averages/best/worst/medals
  // These lists will only contain successful LeaderboardEntryWithTrackName objects
  const [officialTracksWithEntries, setOfficialTracksWithEntries] = useState<LeaderboardEntryWithTrackName[]>([]);
  const [communityTracksWithEntries, setCommunityTracksWithEntries] = useState<LeaderboardEntryWithTrackName[]>([]);


  const [officialSortBy, setOfficialSortBy] = useState<'trackOrder' | 'lowestPercent' | 'highestRank' | 'fastestTime' | 'alphabetical' | 'lowestWrTimeGap' | 'lowestWrPercentGap'>('trackOrder'); // Added WR gap sort options
  const [communitySortBy, setCommunitySortBy] = useState<'trackOrder' | 'lowestPercent' | 'highestRank' | 'fastestTime' | 'alphabetical' | 'lowestWrTimeGap' | 'lowestWrPercentGap'>('trackOrder'); // Added WR gap sort options
  const [reverseOfficialSort, setReverseOfficialSort] = useState(false); // State for reverse button
  const [reverseCommunitySort, setReverseCommunitySort] = useState(false); // State for reverse button


  const [officialAverageStats, setOfficialAverageStats] = useState<AverageStats | null>(null);
  const [communityAverageStats, setCommunityAverageStats] = useState<AverageStats | null>(null);
  const [overallAverageStats, setOverallAverageStats] = useState<AverageStats | null>(null);

  // State to store tracks per medal type, not just counts
  const [medalTracks, setMedalTracks] = useState<{ [key: string]: LeaderboardEntryWithTrackName[] }>({});
  // State to track which medal box is hovered to show tracks
  const [hoveredMedal, setHoveredMedal] = useState<string | null>(null);

  // New state for best/worst stats
  const [officialBestWorst, setOfficialBestWorst] = useState<BestWorstStats>({});
  const [communityBestWorst, setCommunityBestWorst] = useState<BestWorstStats>({});
  const [overallBestWorst, setOverallBestWorst] = useState<BestWorstStats>({});


  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string | null>(null); // New state for loading step text
  const [error, setError] = useState<string | null>(null); // General error message

  const [copiedText, setCopiedText] = useState<string | null>(null);
  // Corrected initialization: Initialize useRef with null
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [displayMode, setDisplayMode] = useState<'input' | 'allTrackStats'>('input');


  // Function to fetch the World Record for a specific track
  const fetchTrackWR = useCallback(async (trackId: string): Promise<number | null> => {
      try {
          // Fetch the first entry (skip=0, amount=1) which should be the WR
          // Assuming WRs are always verified, use onlyVerified=true
          const wrFetchUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${trackId}&skip=0&amount=1&onlyVerified=true`)}`;
          const wrResponse = await fetch(wrFetchUrl);

          if (!wrResponse.ok) {
               // If it's a 404, there might be no verified entries yet, which is not a hard error.
              if (wrResponse.status === 404) {
                  console.warn(`No verified entries found for WR on track ${trackId}.`);
                  return null; // Return null if no verified entries
              }
              // For other non-OK responses, throw an Error(`HTTP error fetching WR! status: ${wrResponse.status}`);
              throw new Error(`HTTP error fetching WR! status: ${wrResponse.status}`);
          }

          const wrData: { entries: LeaderboardEntry[] } = await wrResponse.json();

          if (wrData.entries && wrData.entries.length > 0) {
              return wrData.entries[0].frames; // Return the frames of the first entry (the WR)
          } else {
              // If entries array is empty, there's no WR yet
              console.warn(`No WR entry found in response for track ${trackId}.`);
              return null;
          }

      } catch (err: any) {
          // Provide a more descriptive error message if err.message is empty
          const errorMessage = err.message || `Unknown error fetching WR for track ${trackId}`;
          console.error(`Failed to fetch WR for track ${trackId}:`, errorMessage, err);
          return null; // Return null on error
      }
  }, [PROXY_URL, API_BASE_URL, VERSION]);


  // Function to fetch user's entry for a specific track with retry logic
  // This function now handles the two-step process to get verifiedState and full entry details
  const fetchUserTrackEntry = useCallback(async (userId: string, trackId: string, wrTime: number | null, retries = 3, delay = 500): Promise<LeaderboardEntry | { error: string, retryCount: number } | null> => {
      for (let i = 0; i <= retries; i++) {
          try {
              // Step 1: Fetch user entry using userTokenHash to get position and total count
              const firstCallUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${trackId}&skip=0&amount=1&onlyVerified=false&userTokenHash=${userId}`)}`;
              const firstResponse = await fetch(firstCallUrl);

              if (!firstResponse.ok) {
                  if (firstResponse.status === 404) {
                       console.warn(`User not found on track ${trackId} (first call).`);
                       return null; // User not found on this track
                  }
                  throw new Error(`HTTP error (first call)! status: ${firstResponse.status}`);
              }

              const firstData: { total: number; userEntry: LeaderboardEntry | null } = await firstResponse.json();

              if (!firstData.userEntry || firstData.userEntry.position === undefined) {
                   console.warn(`User entry or position not found in first call response for track ${trackId}.`);
                   return null; // User not found or entry incomplete
              }

              const userPosition = firstData.userEntry.position;
              const totalEntries = typeof firstData.total === 'number' ? firstData.total : 0; // Get total from first call
              const skipAmount = userPosition > 1 ? userPosition - 1 : 0; // Calculate skip amount

              // Calculate rank and percent based on the basic entry and total from the first call
              const calculatedRank = userPosition;
              const calculatedPercent = totalEntries > 0 && typeof calculatedRank === 'number' ? (calculatedRank / totalEntries) * 100 : undefined;

              let wrTimeGap = undefined;
              let wrPercentGap = undefined;
              if (wrTime !== null && typeof firstData.userEntry.frames === 'number' && firstData.userEntry.frames >= 0) {
                  wrTimeGap = firstData.userEntry.frames - wrTime;
                  if (firstData.userEntry.frames > 0) {
                      wrPercentGap = ((firstData.userEntry.frames - wrTime) / firstData.userEntry.frames) * 100;
                  } else {
                      wrPercentGap = 0;
                  }
              }


              // Step 2: Fetch the user's entry from the full leaderboard list to get verifiedState and full details
              const secondCallUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${trackId}&skip=${skipAmount}&amount=1&onlyVerified=false`)}`; // Fetch the specific entry by position
              const secondResponse = await fetch(secondCallUrl);

              if (!secondResponse.ok) {
                  if (secondResponse.status === 404) {
                       console.warn(`User entry not found on track ${trackId} at position ${userPosition} (second call).`);
                       // If the second call fails, return the basic entry from the first call
                       // with calculated rank/percent and WR gaps, and verifiedState undefined.
                       return {
                           ...firstData.userEntry, // Use data from the first call
                           rank: calculatedRank, // Use calculated rank
                           percent: calculatedPercent, // Use calculated percent
                           wrTime: wrTime === null ? undefined : wrTime,
                           wrTimeGap: wrTimeGap,
                           wrPercentGap: wrPercentGap,
                           verifiedState: undefined, // Explicitly set to undefined if second call fails
                       };
                  }
                  throw new Error(`HTTP error (second call)! status: ${secondResponse.status}`);
              }

              const secondData: { entries: LeaderboardEntry[] } = await secondResponse.json();

              if (secondData.entries && secondData.entries.length > 0 && secondData.entries[0].userId === userId) {
                  // Found the user's entry in the entries array - this has the verifiedState and full details
                  const fullEntry = secondData.entries[0];

                  // Return the full entry with calculated rank, percent, and WR gaps
                  return {
                      ...fullEntry, // Use data from the second call (includes verifiedState)
                      rank: calculatedRank, // Use calculated rank
                      percent: calculatedPercent, // Use calculated percent
                      wrTime: wrTime === null ? undefined : wrTime,
                      wrTimeGap: wrTimeGap,
                      wrPercentGap: wrPercentGap,
                  };

              } else {
                   console.warn(`User entry not found in second call entries array for track ${trackId} at skip ${skipAmount}.`);
                   // If the user's entry isn't found in the second call's entries array (shouldn't happen if first call was successful),
                   // return the basic entry from the first call but with verifiedState undefined.
                   return {
                       ...firstData.userEntry, // Use data from the first call
                       rank: calculatedRank, // Use calculated rank
                       percent: calculatedPercent, // Use calculated percent
                       wrTime: wrTime === null ? undefined : wrTime,
                       wrTimeGap: wrTimeGap,
                       wrPercentGap: wrPercentGap,
                       verifiedState: undefined, // Explicitly set to undefined
                   };
              }


          } catch (err: any) {
              // Provide a more descriptive error message if err.message is empty
              const errorMessage = err.message || `Unknown error fetching entry for track ${trackId}`;
              console.error(`Attempt ${i + 1} failed for track ${trackId}:`, errorMessage, err);
              if (i < retries) {
                  await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i))); // Exponential backoff delay
              } else {
                  // After last retry, return error indicator with retryCount
                  console.error(`Max retries reached for track ${trackId}.`);
                  return { error: errorMessage, retryCount: i + 1 }; // Include retryCount in the returned error object
              }
          }
      }
      // Should not be reached if retries > 0, but as a fallback
      return { error: 'Failed to load data after retries', retryCount: retries + 1 }; // Include retryCount in the fallback
  }, [PROXY_URL, API_BASE_URL, VERSION]); // Added dependencies


  // Function to fetch user's basic data (if using token)
  const fetchUserBasicData = useCallback(async (userToken: string): Promise<UserBasicData | null> => {
      try {
          const userApiUrl = `${PROXY_URL}${encodeURIComponent(USER_API_BASE_URL + `?version=${VERSION}&userToken=${userToken}`)}`;
          const response = await fetch(userApiUrl);

          if (!response.ok) {
              throw new Error(`Failed to fetch user basic data: ${response.status}`);
          }
          const data: UserBasicData = await response.json();
          return data;
      } catch (err: any) {
           const errorMessage = err.message || 'An unknown error occurred while fetching user basic data.';
          console.error("Error fetching user basic data:", errorMessage, err);
          setError(errorMessage);
          return null;
      }
  }, [PROXY_URL, USER_API_BASE_URL, VERSION]);

  // Helper function to calculate averages from a list of entries
  const calculateAverages = (entries: LeaderboardEntry[]): AverageStats | null => {
      if (entries.length === 0) return null;

      const totalFrames = entries.reduce((sum, entry) => sum + entry.frames, 0);
      // Only include entries with a valid rank in average rank calculation
      const rankedEntries = entries.filter(entry => entry.rank !== undefined && typeof entry.rank === 'number' && !isNaN(entry.rank));
      const totalRanks = rankedEntries.reduce((sum, entry) => sum + entry.rank!, 0);

       // Only include entries with a valid percent in average percent calculation
      const percentedEntries = entries.filter(entry => entry.percent !== undefined && typeof entry.percent === 'number' && !isNaN(entry.percent));
      const totalPercents = percentedEntries.reduce((sum, entry) => sum + (entry.percent || 0), 0);

       // Only include entries with valid WR gap data for average WR gap calculation
       const wrGapEntries = entries.filter(entry =>
           entry.wrTimeGap !== undefined && typeof entry.wrTimeGap === 'number' && !isNaN(entry.wrTimeGap) &&
           entry.wrPercentGap !== undefined && typeof entry.wrPercentGap === 'number' && !isNaN(entry.wrPercentGap)
       );
       const totalWrTimeGap = wrGapEntries.reduce((sum, entry) => sum + entry.wrTimeGap!, 0);
       const totalWrPercentGap = wrGapEntries.reduce((sum, entry) => sum + entry.wrPercentGap!, 0);


      const rawAvgRank = rankedEntries.length > 0 ? totalRanks / rankedEntries.length : undefined;
      const rawAvgPercent = percentedEntries.length > 0 ? totalPercents / percentedEntries.length : undefined;
       // Calculate raw average WR percent gap
       const rawAvgPercentGap = wrGapEntries.length > 0 ? totalWrPercentGap / wrGapEntries.length : undefined;


      // Calculate average frames and convert to seconds
      const rawAvgFrames = totalFrames / entries.length;
      const avgSeconds = rawAvgFrames / 1000;

      // Format average time to 3 decimal places for seconds
      const avgTime = `${avgSeconds.toFixed(3)}s`;

      // Increased decimal places for average percent
      const avgRank = rawAvgRank !== undefined ? rawAvgRank.toFixed(2) : 'N/A';
      const avgPercent = rawAvgPercent !== undefined ? rawAvgPercent.toFixed(4) + '%' : 'N/A'; // Increased to 4 decimal places

       // Calculate and format average WR gaps
       const avgWrTimeGapFrames = wrGapEntries.length > 0 ? totalWrTimeGap / wrGapEntries.length : undefined;
       const avgWrTimeGap = avgWrTimeGapFrames !== undefined ? formatTime(avgWrTimeGapFrames) : 'N/A';


       const avgWrPercentGap = rawAvgPercentGap !== undefined ? rawAvgPercentGap.toFixed(4) + '%' : 'N/A';


      return { avgTime, avgRank, avgPercent, rawAvgRank, rawAvgPercent, avgWrTimeGap, avgWrPercentGap: avgWrPercentGap, rawAvgPercentGap }; // Include rawAvgPercentGap
  };

    // Helper function to find best and worst stats from a list of entries
    const findBestWorstStats = (entries: LeaderboardEntryWithTrackName[]): BestWorstStats => {
        if (entries.length === 0) return {};

        // Filter out entries without valid frames before finding best/worst time
        const entriesWithTime = entries.filter(entry => typeof entry.frames === 'number' && !isNaN(entry.frames) && entry.frames >= 0);
        // Filter out entries without valid WR gap data
        const entriesWithWrGap = entries.filter(entry =>
            entry.wrTimeGap !== undefined && typeof entry.wrTimeGap === 'number' && !isNaN(entry.wrTimeGap) &&
            entry.wrPercentGap !== undefined && typeof entry.wrPercentGap === 'number' && !isNaN(entry.wrPercentGap)
        );


        let bestTime = entriesWithTime.length > 0 ? entriesWithTime[0] : undefined;
        let worstTime = entriesWithTime.length > 0 ? entriesWithTime[0] : undefined;
        let bestRank = entries.find(entry => entry.rank !== undefined && typeof entry.rank === 'number' && !isNaN(entry.rank)) || undefined;
        let worstRank = entries.find(entry => entry.rank !== undefined && typeof entry.rank === 'number' && !isNaN(entry.rank)) || undefined;
        let bestPercent = entries.find(entry => entry.percent !== undefined && typeof entry.percent === 'number' && !isNaN(entry.percent)) || undefined;
        let worstPercent = entries.find(entry => entry.percent !== undefined && typeof entry.percent === 'number' && !isNaN(entry.percent)) || undefined;
         // Initialize best/worst WR gap entries
        let bestWrTimeGap = entriesWithWrGap.length > 0 ? entriesWithWrGap[0] : undefined;
        let worstWrTimeGap = entriesWithWrGap.length > 0 ? entriesWithWrGap[0] : undefined;
        let bestWrPercentGap = entriesWithWrGap.length > 0 ? entriesWithWrGap[0] : undefined;
        let worstWrPercentGap = entriesWithWrGap.length > 0 ? entriesWithWrGap[0] : undefined;


        entriesWithTime.forEach(entry => {
            // Time (lower is better)
            if (bestTime === undefined || entry.frames < bestTime.frames) bestTime = entry; // Added check for undefined
            if (worstTime === undefined || entry.frames > worstTime.frames) worstTime = entry; // Added check for undefined
        });

         entries.forEach(entry => {
            // Rank (lower is better) - only compare if rank is valid
            if (entry.rank !== undefined && typeof entry.rank === 'number' && !isNaN(entry.rank)) {
                if (!bestRank || entry.rank < bestRank.rank!) bestRank = entry;
                if (!worstRank || entry.rank > worstRank.rank!) worstRank = entry;
            }

            // Percent (lower is better) - only compare if percent is valid
            if (entry.percent !== undefined && typeof entry.percent === 'number' && !isNaN(entry.percent)) {
                if (!bestPercent || entry.percent < bestPercent.percent!) bestPercent = entry;
                if (!worstPercent || entry.percent > worstPercent.percent!) worstPercent = entry;
            }
        });

        entriesWithWrGap.forEach(entry => {
            // WR Time Gap (lower is better)
            if (bestWrTimeGap === undefined || entry.wrTimeGap! < bestWrTimeGap.wrTimeGap!) bestWrTimeGap = entry; // Added check for undefined
            if (worstWrTimeGap === undefined || entry.wrTimeGap! > worstWrTimeGap.wrTimeGap!) worstWrTimeGap = entry; // Added check for undefined

            // WR Percent Gap (lower is better)
            if (bestWrPercentGap === undefined || entry.wrPercentGap! < bestWrPercentGap.wrPercentGap!) bestWrPercentGap = entry; // Added check for undefined
            if (worstWrPercentGap === undefined || entry.wrPercentGap! > worstWrPercentGap.wrPercentGap!) worstWrPercentGap = entry; // Added check for undefined
        });


        return {
            bestTime,
            worstTime,
            bestRank,
            worstRank,
            bestPercent,
            worstPercent,
            bestWrTimeGap,
            worstWrTimeGap,
            bestWrPercentGap,
            worstWrPercentGap,
        };
    };


  // Helper function to group entries by medal type
  const groupEntriesByMedal = (entries: LeaderboardEntryWithTrackName[]): { [key: string]: LeaderboardEntryWithTrackName[] } => {
      const medalMap: { [key: string]: LeaderboardEntryWithTrackName[] } = {};
      // Filter for entries that actually have a medal
      const medalEligibleEntries = entries.filter(entry => getMedal(entry.percent) || getRankMedal(entry.position) || getWrPercentGapMedal(entry.wrPercentGap));

      medalEligibleEntries.forEach(entry => {
          const percentMedal = getMedal(entry.percent);
          if (percentMedal) {
              if (!medalMap[percentMedal.label]) {
                  medalMap[percentMedal.label] = []; // Corrected typo here
              }
              // Check if the entry is already added under this medal label to avoid duplicates
              if (!medalMap[percentMedal.label].some(existingEntry => existingEntry.trackId === entry.trackId)) {
                  medalMap[percentMedal.label].push(entry);
              }
          }
          const posMedal = getRankMedal(entry.position); // Changed to getRankMedal
          if (posMedal) {
             if (!medalMap[posMedal.label]) {
                 medalMap[posMedal.label] = [];
             }
             // Check if the entry is already added under this medal label
             if (!medalMap[posMedal.label].some(existingEntry => existingEntry.trackId === entry.trackId)) {
                 medalMap[posMedal.label].push(entry);
             }
          }
           const wrGapMedal = getWrPercentGapMedal(entry.wrPercentGap);
           if (wrGapMedal) {
              if (!medalMap[wrGapMedal.label]) {
                  medalMap[wrGapMedal.label] = [];
              }
               // Check if the entry is already added under this medal label
              if (!medalMap[wrGapMedal.label].some(existingEntry => existingEntry.trackId === entry.trackId)) {
                  medalMap[wrGapMedal.label].push(entry);
              }
           }
      });
      return medalMap;
  };

  // Helper to get a medal object by its label for consistent icon/color display
  const getMedalByLabel = (label: string): Medal | null => {
      switch (label) {
          case 'WR': return getRankMedal(1); // Changed to getRankMedal
          case 'Podium': return getRankMedal(2); // Changed to getRankMedal
          case 'Top 10': return getRankMedal(10); // Added for new tier
          case 'Top 25': return getRankMedal(25); // Added for new tier
          case 'Top 50': return getRankMedal(50); // Added for new tier
          case 'Participant': return getRankMedal(51); // Added for new tier
          case 'Diamond': return getMedal(0.001); // Using a value within the range
          case 'Emerald': return getMedal(0.1); // Using a value within the range
          case 'Gold': return getMedal(1); // Using a value within the range
          case 'Silver': return getMedal(10); // Using a value within the range
          case 'Bronze': return getMedal(20); // Using a value within the range
          // New WR Gap % medals
          case 'Perfect': return getWrPercentGapMedal(0);
          case 'Legendary': return getWrPercentGapMedal(0.05); // Value within range
          case 'Mythic': return getWrPercentGapMedal(0.25); // Value within range
          case 'Epic': return getWrPercentGapMedal(1); // Value within range
          case 'Great': return getWrPercentGapMedal(4); // Value within range
          case 'Good': return getWrPercentGapMedal(10); // Value within range
          case 'Decent': return getWrPercentGapMedal(20); // Value within range
          default: return null;
      }
  };

    // Function to scroll to a specific track entry
    const scrollToTrack = useCallback((trackId: string) => {
        const targetElement = document.getElementById(`track-${trackId}`);
        if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth' });
        }
    }, []);


  // Function to handle retrying a single track
  const handleRetryTrack = useCallback(async (trackId: string, trackName: string, isAutoRetry: boolean = false) => {
       if (!resolvedUserId) return; // Only retry if a user is loaded

       // Get current entry state to determine retry count
       const currentEntry = userEntriesByTrack.get(trackId);
       const currentRetryCount = (currentEntry && typeof currentEntry === 'object' && 'error' in currentEntry) ? currentEntry.retryCount : 0;

       // If this is an auto-retry and we've reached the max attempts, stop
       if (isAutoRetry && currentRetryCount >= MAX_RETRY_ATTEMPTS) {
           return;
       }


       // Set loading state for this specific track, incrementing retry count for errors
       setUserEntriesByTrack(prevMap => {
           const newMap = new Map(prevMap);
           const existingEntry = newMap.get(trackId);
           const newRetryCount = (existingEntry && typeof existingEntry === 'object' && 'error' in existingEntry) ? existingEntry.retryCount + 1 : 1;
           newMap.set(trackId, { error: 'Retrying...', retryCount: newRetryCount }); // Indicate retrying and update count
           return newMap;
       });

       // Clear the general error message if this was the only failed track (excluding the one being retried)
       const failedTracksBeforeRetry = Array.from(userEntriesByTrack.entries())
           .filter(([id, entryOrError]) =>
               id !== trackId && // Exclude the current track
               entryOrError &&
               typeof entryOrError === 'object' &&
               'error' in entryOrError &&
               entryOrError.error !== 'Retrying...' // Exclude tracks already marked as retrying
           );
       if (error && failedTracksBeforeRetry.length === 0) {
           setError(null);
       }

       // Fetch the WR time for this track first
       const wrTime = await fetchTrackWR(trackId);
       // Update the WR time map
       setWrTimesByTrack(prevMap => new Map(prevMap).set(trackId, wrTime));


       // Fetch the track entry with retry logic (internal retries within fetchUserTrackEntry)
       // Pass the fetched WR time to fetchUserTrackEntry
       const entry = await fetchUserTrackEntry(resolvedUserId, trackId, wrTime); // Removed onlyVerified argument

       // Update the map with the new result
       setUserEntriesByTrack(prevMap => {
            const newMap = new Map(prevMap);
            // If the new entry is still an error, preserve the incremented retry count
            if (entry && typeof entry === 'object' && 'error' in entry) {
                 const existingErrorEntry = newMap.get(trackId);
                 const retryCount = (existingErrorEntry && typeof existingErrorEntry === 'object' && 'error' in existingErrorEntry) ? existingErrorEntry.retryCount : 0;
                 newMap.set(trackId, { error: entry.error, retryCount: retryCount }); // Keep the incremented count
            } else {
                 newMap.set(trackId, entry); // Update with successful entry or null
            }


            // Re-calculate averages, best/worst, and medals if a successful entry was added or an error was resolved
            // Filter for successful entries only for these calculations
            const allTracksWithUserData: TrackWithUserData[] = ALL_TRACKS.map((track, index) => ({ // Added index here
                trackName: track.name,
                trackId: track.id,
                originalIndex: index, // Store original index
                userData: newMap.get(track.id) as LeaderboardEntry | { error: string, retryCount: number } | null,
                wrTime: wrTimesByTrack.get(track.id) // Include the fetched WR time
            }));

            const successfulEntries = allTracksWithUserData.filter(t =>
                t.userData !== null && !(typeof t.userData === 'object' && 'error' in t.userData)
            ).map(t => ({
                ...t.userData as LeaderboardEntry, // Spread the LeaderboardEntry properties
                trackName: t.trackName, // Add trackName
                trackId: t.trackId, // Add trackId
                 // Ensure WR data is included even if not originally in userData
                wrTime: t.wrTime,
                wrTimeGap: (t.userData as LeaderboardEntry)?.wrTimeGap,
                wrPercentGap: (t.userData as LeaderboardEntry)?.wrPercentGap,
            })) as LeaderboardEntryWithTrackName[]; // Cast the result to the correct type


            const updatedOfficial = successfulEntries.filter(entry => OFFICIAL_TRACKS.some(ot => ot.id === entry.trackId));
            const updatedCommunity = successfulEntries.filter(entry => COMMUNITY_TRACKS.some(ct => ct.id === entry.trackId));


            setOfficialTracksWithEntries(updatedOfficial);
            setCommunityTracksWithEntries(updatedCommunity);
            setOfficialAverageStats(calculateAverages(updatedOfficial));
            setCommunityAverageStats(calculateAverages(updatedCommunity));
            setOverallAverageStats(calculateAverages([...updatedOfficial, ...updatedCommunity]));
            setMedalTracks(groupEntriesByMedal([...updatedOfficial, ...updatedCommunity]));
            setOfficialBestWorst(findBestWorstStats(updatedOfficial));
            setCommunityBestWorst(findBestWorstStats(updatedCommunity));
            setOverallBestWorst(findBestWorstStats([...updatedOfficial, ...updatedCommunity]));

            return newMap;
       });

        // Re-evaluate general error message after updating the map
        const failedTracksAfterRetry = Array.from(userEntriesByTrack.values()).some(entry => entry && typeof entry === 'object' && 'error' in entry && entry.error !== 'Retrying...'); // Exclude 'Retrying...' from the count
        if (failedTracksAfterRetry) {
            setError('Some track data failed to load. You can try retrying individual tracks.');
        } else {
            setError(null); // Clear general error if all retries were successful
        }

  }, [resolvedUserId, fetchUserTrackEntry, userEntriesByTrack, error, ALL_TRACKS, OFFICIAL_TRACKS, COMMUNITY_TRACKS, calculateAverages, groupEntriesByMedal, findBestWorstStats, fetchTrackWR, wrTimesByTrack]); // Added dependencies


  // Function to fetch user stats for all tracks
  const fetchAllUserTrackStats = useCallback(async (userId: string) => {
      setLoading(true);
      setLoadingStep('Fetching World Records...'); // Set loading step
      setError(null); // Clear general error at the start
      setUserEntriesByTrack(new Map()); // Clear previous entries map
      setWrTimesByTrack(new Map()); // Clear previous WR times map
      setOfficialTracksWithEntries([]); // Clear previous tracks with entries
      setCommunityTracksWithEntries([]); // Clear previous tracks with entries
      setOfficialAverageStats(null);
      setCommunityAverageStats(null);
      setOverallAverageStats(null);
      setMedalTracks({}); // Clear previous medal data
      setHoveredMedal(null); // Clear hovered medal state
      setOfficialBestWorst({}); // Clear best/worst stats
      setCommunityBestWorst({});
      setOverallBestWorst({});

      // First, fetch all WR times concurrently
      const wrFetchPromises = ALL_TRACKS.map(track =>
           // Added a small delay before starting WR fetch for each track
           new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 10)).then(() => // Random delay between 10ms and 110ms
               fetchTrackWR(track.id)
                   .then(wrTime => ({ trackId: track.id, wrTime: wrTime })) // Wrap result with track info
                   .catch(error => ({ trackId: track.id, error: error.message || 'Unknown WR error' })) // Catch any unexpected errors, provide fallback message
           )
      );

      const wrResults = await Promise.allSettled(wrFetchPromises);
      const fetchedWrTimesMap = new Map<string, number | null>();
      wrResults.forEach(result => {
        if (result.status === 'fulfilled') {
            // Check if the fulfilled value has the wrTime property
            if (result.value && typeof result.value === 'object' && 'wrTime' in result.value) {
                 fetchedWrTimesMap.set(result.value.trackId, result.value.wrTime);
            } else if (result.value && typeof result.value === 'object' && 'error' in result.value) {
                 // If the fulfilled value is an error object (from the inner catch)
                 console.error(`Failed to fetch WR for track ${result.value.trackId}:`, result.value.error);
                 fetchedWrTimesMap.set(result.value.trackId, null); // Store null for failed WR fetches
            } else {
                // Handle unexpected structure of fulfilled value
                console.error('Unexpected fulfilled WR result structure:', result.value);
            }
        } else { // result.status === 'rejected'
            // Access reason for rejected promises
            const rejectedReason = result.reason as any; // Cast reason to any
            const trackId = rejectedReason.trackId || 'unknown'; // Access trackId from the casted object with fallback
            console.error(`Failed to fetch WR for track ${trackId}:`, rejectedReason.error || 'Unknown error'); // Use trackId and error from casted object
            fetchedWrTimesMap.set(trackId, null); // Store null for failed WR fetches
        }
      });
      setWrTimesByTrack(fetchedWrTimesMap); // Set the fetched WR times map

      setLoadingStep('Fetching User Entries...'); // Set loading step


      // Then, fetch user entries concurrently, passing the fetched WR time
      const userFetchPromises = ALL_TRACKS.map((track, index) =>
          // Added a small delay before starting user entry fetch for each track
          new Promise(resolve => setTimeout(resolve, index * 20 + Math.random() * 50)).then(() => { // Added random delay
              const wrTimeForTrack = fetchedWrTimesMap.get(track.id) || null; // Get WR time from the map
              // Pass the WR time to the updated fetchUserTrackEntry
              return fetchUserTrackEntry(userId, track.id, wrTimeForTrack)
                  .then(entry => ({ trackId: track.id, trackName: track.name, result: entry })) // Wrap result with track info
                  .catch(error => ({ trackId: track.id, trackName: track.name, error: error.message || 'Unknown error' })); // Catch any unexpected errors, provide fallback message
          })
      );

      const userResults = await Promise.allSettled(userFetchPromises); // Use allSettled

      const fetchedEntriesMap = new Map<string, LeaderboardEntry | { error: string, retryCount: number } | null>(); // Map can now store errors or null
      const officialTracksWithEntries: LeaderboardEntryWithTrackName[] = [];
      const communityTracksWithEntries: LeaderboardEntryWithTrackName[] = [];

      userResults.forEach(result => {
          let trackId: string;
          let trackName: string;
          let entryOrError: LeaderboardEntry | { error: string, retryCount: number } | null = null; // Initialize entryOrError

          if (result.status === 'fulfilled') {
              trackId = result.value.trackId;
              trackName = result.value.trackName;
              // Access the actual result from the fulfilled value
              // Check if result.value exists, is an object, and has the 'result' property
              if (result.value && typeof result.value === 'object' && 'result' in result.value) {
                   entryOrError = result.value.result;

                   // If it's a specific error object from fetchUserTrackEntry, initialize retry count
                   if (entryOrError && typeof entryOrError === 'object' && 'error' in entryOrError) {
                        // Ensure retryCount is included even if the error came from fetchUserTrackEntry's catch
                        fetchedEntriesMap.set(trackId, { error: entryOrError.error, retryCount: (entryOrError as any).retryCount || 0 }); // Use (entryOrError as any).retryCount to access it if present, fallback to 0
                   } else if (entryOrError !== null) {
                       // It's a successful entry (not null)
                       fetchedEntriesMap.set(trackId, entryOrError);
                       // Correctly construct LeaderboardEntryWithTrackName
                       const trackWithEntry: LeaderboardEntryWithTrackName = { trackName: trackName, trackId: trackId, ...entryOrError };
                       if (OFFICIAL_TRACKS.some(ot => ot.id === trackId)) {
                           officialTracksWithEntries.push(trackWithEntry);
                       } else {
                           communityTracksWithEntries.push(trackWithEntry);
                       }
                   } else {
                        // entryOrError is null, meaning user has no entry on this track
                        fetchedEntriesMap.set(trackId, null); // Store null explicitly
                   }
              } else {
                   // This case implies result.value was fulfilled but didn't have the expected 'result' property,
                   // or was the inner error structure itself. Treat as a fetch error.
                   console.error(`Fulfilled promise value did not have expected 'result' structure for track ${trackName}. Value:`, result.value);
                   fetchedEntriesMap.set(trackId, { error: 'Unexpected data structure', retryCount: 0 });
              }
          } else { // result.status === 'rejected'
              // Access reason for rejected promises
              trackId = result.reason.trackId;
              trackName = result.reason.trackName;
               console.error(`Promise rejected for track ${trackName}:`, result.reason.error);
               // Initialize retry count for unexpected errors
               // FIX: Ensure rejected promises also set retryCount to 0
               // The reason from Promise.allSettled might not have retryCount, add it here.
               fetchedEntriesMap.set(trackId, { error: result.reason.error || 'Unknown error', retryCount: 0 });
          }
      });


      setUserEntriesByTrack(fetchedEntriesMap); // Store the map with entries and errors
      setOfficialTracksWithEntries(officialTracksWithEntries); // These lists only contain successful entries for averages etc.
      setCommunityTracksWithEntries(communityTracksWithEntries);

      setLoadingStep('Calculating Statistics...'); // Set loading step

      // Calculate and set individual and overall averages using only tracks with entries
      setOfficialAverageStats(calculateAverages(officialTracksWithEntries));
      setCommunityAverageStats(calculateAverages(communityTracksWithEntries));
      setOverallAverageStats(calculateAverages([...officialTracksWithEntries, ...communityTracksWithEntries]));

      // Group entries by medal and set the state using only tracks with entries
      setMedalTracks(groupEntriesByMedal([...officialTracksWithEntries, ...communityTracksWithEntries]));

      // Calculate and set best/worst stats using only tracks with entries
      setOfficialBestWorst(findBestWorstStats(officialTracksWithEntries));
      setCommunityBestWorst(findBestWorstStats(communityTracksWithEntries));
      setOverallBestWorst(findBestWorstStats([...officialTracksWithEntries, ...communityTracksWithEntries]));


      setDisplayMode('allTrackStats'); // Switch display mode

      // Check if any tracks failed to load and set a general error message if needed
      const failedTracks = Array.from(fetchedEntriesMap.values()).some(entry => entry && typeof entry === 'object' && 'error' in entry);
      if (failedTracks) {
          setError('Some track data failed to load. Auto-retrying failed tracks...');
      } else {
          setError(null); // Clear general error if all retries were successful
      }


      setLoading(false);
      setLoadingStep(null); // Clear loading step

  }, [fetchUserTrackEntry, calculateAverages, groupEntriesByMedal, findBestWorstStats, ALL_TRACKS, OFFICIAL_TRACKS, COMMUNITY_TRACKS, basicUserData, fetchTrackWR]); // Added ALL_TRACKS etc. to dependencies


    // Effect to set basic user data to 'not found' if no entries are returned after loading
    // This effect is less critical now that basic data is fetched upfront for User ID,
    // but kept as a fallback in case of unexpected API behavior or if the initial lookup fails
    // but track entries are somehow still returned (unlikely but safer).
    useEffect(() => {
        // Only run if resolvedUserId is set, basicUserData is not null/undefined,
        // loading is finished, and no entries are returned in the main fetch.
        // Refined the condition to explicitly check basicUserData != null and use optional chaining for name
        if (resolvedUserId && basicUserData != null && (basicUserData.name === 'Searching for user...' || basicUserData.name === 'Fetching Name...') && !loading && officialTracksWithEntries.length === 0 && communityTracksWithEntries.length === 0) {
             setBasicUserData({
                 name: 'User Not Found on any tracks',
                 carColors: '',
                 isVerifier: 'N/A',
             });
             // Also set an error if no tracks were found after a successful ID resolution
             setError('User ID found, but no entries were found on any tracks.');
        }
    }, [resolvedUserId, basicUserData, officialTracksWithEntries, communityTracksWithEntries, loading]); // Depend on these states

    // Effect for auto-retrying failed tracks
    useEffect(() => {
        if (!resolvedUserId) return; // Only run if a user is loaded

        const retryInterval = setInterval(() => {
            const failedTracksToRetry = Array.from(userEntriesByTrack.entries())
                .filter(([trackId, entryOrError]) =>
                    entryOrError &&
                    typeof entryOrError === 'object' &&
                    'error' in entryOrError &&
                    entryOrError.error !== 'Retrying...' && // Don't retry tracks already marked as retrying
                    entryOrError.retryCount < MAX_RETRY_ATTEMPTS // Only retry if retry count is below max
                );

            if (failedTracksToRetry.length > 0) {
                failedTracksToRetry.forEach(([trackId, entryOrError]) => {
                    // Add a slightly offset random delay between retries
                     const delay = Math.random() * 2000 + 500; // Random delay between 500ms and 2500ms
                     setTimeout(() => {
                         // Find the track name from ALL_TRACKS using the trackId
                         const trackName = ALL_TRACKS.find(t => t.id === trackId)?.name || trackId;
                         handleRetryTrack(trackId, trackName, true); // Pass true for isAutoRetry
                     }, delay);
                });
            }

        }, AUTO_RETRY_INTERVAL); // Check every 7 seconds for failed tracks

        // Cleanup function to clear the interval when the component unmounts or dependencies change
        return () => clearInterval(retryInterval);

    }, [userEntriesByTrack, resolvedUserId, handleRetryTrack, ALL_TRACKS]);


  // Function to copy text to clipboard
  const copyToClipboard = useCallback((text: string) => {
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
  }, []);

  // Function to display car colors with copy functionality and tooltips
  const displayCarColors = useCallback((carColors: string) => {
    if (!carColors) return <span className="text-gray-400">No Color Data</span>;
    const colors = carColors.match(/.{1,6}/g);
    if (!colors) return <span className="text-gray-400">Invalid Color Data</span>;
    return (
      <div className="flex gap-2 items-center flex-wrap justify-start">
        {colors.map((c, i) => {
          const hex = `#${c.padEnd(6, '0')}`;
          // Use a unique ID for each tooltip based on index and hex code
          const tooltipId = `color-tooltip-${i}-${hex.replace('#', '')}`;
          return (
            <motion.div
              key={i}
              style={{ backgroundColor: hex, cursor: 'pointer' }}
              className="w-4 h-4 rounded-full border border-gray-600" // Added border for visibility on light backgrounds
              title={hex} // Keep title for fallback
              onClick={() => copyToClipboard(hex)}
              whileHover={{ scale: 1.2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              data-tooltip-id={tooltipId} // Add data-tooltip-id
              data-tooltip-content={hex} // Add data-tooltip-content
            />
            );
        })}
        {/* Add Tooltip components for the color circles */}
        {colors.map((c, i) => {
             const hex = `#${c.padEnd(6, '0')}`;
             const tooltipId = `color-tooltip-${i}-${hex.replace('#', '')}`;
             return <Tooltip key={tooltipId} id={tooltipId} place="top" className="!text-xs !bg-gray-700 !text-white" />;
        })}

        <Button
          variant="link"
          size="sm"
          onClick={() => copyToClipboard(carColors)}
          className="text-blue-400 font-mono text-xs truncate p-0 ml-1"
        >
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    );
  }, [copyToClipboard]);

  // Component to display Verified State icon (now only returns the icon)
  const VerifiedStateIcon = useCallback(({ verifiedState }: { verifiedState: number | undefined }) => {
    // Check if verifiedState is a valid number (0, 1, or 2)
    if (typeof verifiedState === 'number' && verifiedState >= 0 && verifiedState <= 2) {
        if (verifiedState === 1) {
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        } else if (verifiedState === 0) {
            return <Circle className="w-4 h-4 text-gray-400" />;
        } else {
             // Handle state 2 (currently unused in API but good to handle)
            return <Circle className="w-4 h-4 text-gray-400" />;
        }
    } else {
        // Return the gray circle for undefined or invalid numbers
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  }, []);


  // Memoized sorted track stats for display (includes tracks with and without entries)
  const sortedTrackDisplayStats = useMemo(() => {
      // Combine all predefined tracks with their user data (if available from the map)
      const allTracksWithUserData: TrackWithUserData[] = ALL_TRACKS.map((track, index) => ({ // Added index here
          trackName: track.name,
          trackId: track.id,
          originalIndex: index, // Store original index
          userData: userEntriesByTrack.has(track.id) ? userEntriesByTrack.get(track.id) : undefined, // Get user data, error, or null from the map
          wrTime: wrTimesByTrack.get(track.id) // Get the fetched WR time for this track
      }));

      // Separate into official and community for sorting
      const officialDisplayStats = allTracksWithUserData.filter(track => OFFICIAL_TRACKS.some(ot => ot.id === track.trackId));
      const communityDisplayStats = allTracksWithUserData.filter(track => COMMUNITY_TRACKS.some(ct => ct.id === track.trackId));


      // Helper to handle undefined/NaN/Error values, pushing them to the end for sorting
      // Updated type annotation for valA and valB to include TrackWithUserData
      const compareValues = (valA: LeaderboardEntry | { error: string, retryCount: number } | null | TrackWithUserData | undefined, valB: LeaderboardEntry | { error: string, retryCount: number } | null | TrackWithUserData | undefined, ascending: boolean, isNumeric: boolean, sortByMetric?: 'rank' | 'frames' | 'percent' | 'originalIndex' | 'wrTimeGap' | 'wrPercentGap') => { // Added WR gap metrics
           // Treat errors and nulls as larger than any valid number/string for sorting purposes
           const isAErrorOrNull = valA === undefined || valA === null || (typeof valA === 'object' && 'error' in valA);
           const isBErrorOrNull = valB === undefined || valB === null || (typeof valB === 'object' && 'error' in valB);

           if (isAErrorOrNull && isBErrorOrNull) return 0; // Both are errors/null, maintain relative order
           if (isAErrorOrNull) return 1; // A is error/null, push to end
           if (isBErrorOrNull) return -1; // B is error/null, push to end

            // Now we know both are not errors/null. They could be LeaderboardEntry or TrackWithUserData (for alphabetical sort).
           if (isNumeric && sortByMetric) {
               // Further check if they are actually LeaderboardEntry objects (unless sorting by originalIndex)
               if (sortByMetric !== 'originalIndex') {
                   // For WR gaps, we need the LeaderboardEntry object
                   if (typeof valA !== 'object' || valA === null || 'error' in valA) return 1; // A is not a valid entry, push to end
                   if (typeof valB !== 'object' || valB === null || 'error' in valB) return -1; // B is not a valid entry, push to end
               }


               let numA, numB;
               if (sortByMetric === 'rank') {
                   numA = (valA as LeaderboardEntry).rank;
                   numB = (valB as LeaderboardEntry).rank;
               } else if (sortByMetric === 'frames') {
                   numA = (valA as LeaderboardEntry).frames;
                   numB = (valB as LeaderboardEntry).frames;
               } else if (sortByMetric === 'percent') {
                   numA = (valA as LeaderboardEntry).percent;
                   numB = (valB as LeaderboardEntry).percent;
               } else if (sortByMetric === 'wrTimeGap') { // Handle WR Time Gap sort
                    numA = (valA as LeaderboardEntry).wrTimeGap;
                    numB = (valB as LeaderboardEntry).wrTimeGap;
               } else if (sortByMetric === 'wrPercentGap') { // Handle WR Percent Gap sort
                    numA = (valA as LeaderboardEntry).wrPercentGap;
                    numB = (valB as LeaderboardEntry).wrPercentGap;
               } else if (sortByMetric === 'originalIndex') { // Handle originalIndex sort
                    numA = (valA as TrackWithUserData).originalIndex;
                    numB = (valB as TrackWithUserData).originalIndex;
               } else {
                   return 0; // Should not happen
               }

               // Handle potential undefined/NaN within valid entries
                if (numA === undefined || isNaN(numA as number)) return 1;
                if (numB === undefined || isNaN(numB as number)) return -1;

               return ascending ? (numA as number) - (numB as number) : (numB as number) - (numA as number);
           } else if (!isNumeric) {
               // Alphabetical comparison (for trackName)
               // In this case, valA and valB are the TrackWithUserData objects themselves
               const nameA = (valA as TrackWithUserData).trackName;
               const nameB = (valB as TrackWithUserData).trackName;
               // Handle cases where trackName might be missing (though unlikely with current data structure)
               if (!nameA) return 1;
               if (!nameB) return -1;
               return ascending ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
           }

           return 0; // Should not be reached
      };


      const sortStats = (stats: TrackWithUserData[], sortBy: typeof officialSortBy, reverseSort: boolean) => {
          const sorted = [...stats]; // Create a copy to sort

          sorted.sort((a, b) => {
              const aData = a.userData;
              const bData = b.userData;

              let comparison = 0; // Default to 0 for trackOrder

              switch (sortBy) {
                  case 'lowestPercent':
                      // Sort by percent, ascending (lower percent is better)
                      comparison = compareValues(aData, bData, true, true, 'percent');
                      break;
                  case 'highestRank':
                      // Sort by rank, ascending (lower rank number is higher rank)
                      comparison = compareValues(aData, bData, true, true, 'rank');
                      break;
                  case 'fastestTime':
                      // Sort by frames, ascending (lower frames is faster time)
                      comparison = compareValues(aData, bData, true, true, 'frames');
                      break;
                  case 'lowestWrTimeGap':
                       // Sort by WR Time Gap, ascending (lower gap is better)
                       comparison = compareValues(aData, bData, true, true, 'wrTimeGap');
                       break;
                  case 'lowestWrPercentGap':
                       // Sort by WR Percent Gap, ascending (lower gap is better)
                       comparison = compareValues(aData, bData, true, true, 'wrPercentGap');
                       break;
                  case 'alphabetical':
                       // Sort by track name, ascending
                       // Pass the TrackWithUserData objects themselves for alphabetical sort
                      comparison = compareValues(a, b, true, false);
                       break;
                  case 'trackOrder':
                  default:
                      // Sort by original index for track order
                      comparison = compareValues(a, b, true, true, 'originalIndex'); // Use originalIndex for track order
                      break;
              }

               // Apply reverse if needed
               return reverseSort ? -comparison : comparison;
          });

          return sorted;
      };


      return {
          official: sortStats(officialDisplayStats, officialSortBy, reverseOfficialSort), // Pass reverse state
          community: sortStats(communityDisplayStats, communitySortBy, reverseCommunitySort), // Pass reverse state
      };

  }, [userEntriesByTrack, officialSortBy, communitySortBy, reverseOfficialSort, reverseCommunitySort, ALL_TRACKS, OFFICIAL_TRACKS, COMMUNITY_TRACKS, wrTimesByTrack]);


  // Function to render a list of track stats (used for Official and Community sections)
  const renderTrackStatsList = useCallback((stats: TrackWithUserData[], title: string, sortBy: typeof officialSortBy, setSortBy: typeof setOfficialSortBy, reverseSort: boolean, setReverseSort: (reverse: boolean) => void) => {
    const sortOptions = [
        { value: 'trackOrder', label: 'Track Order' },
        { value: 'lowestPercent', label: 'Percent (Lowest)' },
        { value: 'highestRank', label: 'Rank (Highest)' },
        { value: 'fastestTime', label: 'Time (Fastest)' },
        { value: 'lowestWrTimeGap', label: 'WR Time Gap (Lowest)' }, // Added WR Time Gap sort option
        { value: 'lowestWrPercentGap', label: 'WR % Gap (Lowest)' }, // Added WR % Gap sort option
        { value: 'alphabetical', label: 'Alphabetical' },
    ];


    return (
      <Card className="bg-gray-800/50 text-white border-purple-500/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"> {/* Adjusted header for layout */}
              <CardTitle className="text-purple-400">{title}</CardTitle>
              {/* Sort Controls */}
              <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-300">Sort by:</span>
                  <Select onValueChange={(value: typeof sortBy) => setSortBy(value)} defaultValue={sortBy}>
                      <SelectTrigger className="w-[180px] bg-black/20 text-white border-purple-500/30 focus:ring-purple-500/50"> {/* Adjusted width */}
                          <SelectValue placeholder="Select Sort Option" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 text-white border-purple-500/30">
                          {sortOptions.map(option => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
                   {/* Reverse Order Button */}
                   <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setReverseSort(!reverseSort)} // Toggle reverse state
                       className={cn(
                           "bg-black/20 text-white border-purple-500/30 hover:bg-purple-700/30",
                           { "bg-purple-700/50": reverseSort } // Highlight when reversed
                       )}
                       title="Reverse Order"
                   >
                       <ArrowUpDown className="h-4 w-4" />
                   </Button>
              </div>
          </CardHeader>
          <CardContent className="space-y-4">
              {stats.length > 0 ? (
                  stats.map((track, index) => {
                      const entryOrError = userEntriesByTrack.get(track.trackId); // Get entry or error from the map
                       const wrTime = wrTimesByTrack.get(track.trackId); // Get the fetched WR time


                      // Check if it's an error object
                      const isError = entryOrError && typeof entryOrError === 'object' && 'error' in entryOrError;
                      const errorMessage = isError ? entryOrError.error : null;
                      const retryCount = isError ? entryOrError.retryCount : 0;

                      // Determine display values - ENSURE THESE ARE PULLED FROM THE FULL LeaderboardEntry OBJECT
                      // Add checks for entryOrError being a valid object before accessing properties
                      const timeDisplay = !isError && entryOrError !== null && typeof entryOrError === 'object' ? formatTime((entryOrError as LeaderboardEntry).frames) : (isError ? 'Error' : 'N/A');
                       const rankDisplay = !isError && entryOrError !== null && typeof entryOrError === 'object' && 'rank' in entryOrError && (entryOrError as LeaderboardEntry).rank !== undefined ? (entryOrError as LeaderboardEntry).rank : (isError ? 'Error' : 'N/A');
                       const percentDisplay = !isError && entryOrError !== null && typeof entryOrError === 'object' && 'percent' in entryOrError && typeof (entryOrError as LeaderboardEntry).percent === 'number' ? (entryOrError as LeaderboardEntry).percent?.toFixed(4) + '%' : (isError ? 'Error' : 'N/A');


                        // Explicitly check if entryOrError is a LeaderboardEntry before accessing verifiedState
                        const entryIsLeaderboardEntry = entryOrError !== null && typeof entryOrError === 'object' && !('error' in entryOrError);
                        // Access verifiedState directly from the potential LeaderboardEntry object
                        const verifiedStateValue = entryIsLeaderboardEntry ? (entryOrError as LeaderboardEntry).verifiedState : undefined;


                        // Determine WR gap display values
                        // No longer displaying WR Time here
                        const wrTimeGapDisplay = !isError && entryOrError !== null && typeof entryOrError === 'object' && 'wrTimeGap' in entryOrError && typeof (entryOrError as any).wrTimeGap === 'number' ? formatTime((entryOrError as LeaderboardEntry).wrTimeGap) : (isError ? 'Error' : 'N/A');
                        const wrPercentGapDisplay = !isError && entryOrError !== null && typeof entryOrError === 'object' && 'wrPercentGap' in entryOrError && typeof (entryOrError as any).wrPercentGap === 'number' ? (entryOrError as any).wrPercentGap?.toFixed(4) + '%' : (isError ? 'Error' : 'N/A');

                        // Get medal objects for this entry (if not error)
                        // Use position from the full entry object if available
                       const rankMedal = !isError && entryOrError !== null && typeof entryOrError === 'object' ? getRankMedal((entryOrError as LeaderboardEntry)?.position) : null;
                       const percentMedal = !isError && entryOrError !== null && typeof entryOrError === 'object' ? getMedal((entryOrError as LeaderboardEntry)?.percent) : null;
                       const wrGapMedal = !isError && entryOrError !== null && typeof entryOrError === 'object' ? getWrPercentGapMedal((entryOrError as LeaderboardEntry)?.wrPercentGap) : null;


                       return (
                           <motion.div
                               key={track.trackId} // Use trackId as the stable key
                               id={`track-${track.trackId}`} // Add unique ID for scrolling
                               initial={{ opacity: 0, y: 20 }}
                               animate={{ opacity: 1, y: 0 }}
                               transition={{ duration: 0.3, delay: index * 0.03 }} // Slightly faster animation delay
                               className="flex flex-col justify-between items-start border-b border-gray-700 pb-3 last:border-b-0 last:pb-0"
                           >
                               <div className="flex flex-col sm:flex-row items-start sm:items-center w-full mb-2"> {/* Flex container for track name and ID */}
                                    <p className="font-semibold text-blue-300 mr-4">{track.trackName}</p>
                                    {/* Track ID with Copy button */}
                                    <div className="flex items-center text-sm text-gray-400">
                                        Track ID:
                                        <span className="font-mono text-xs ml-1 truncate">{track.trackId}</span>
                                         <Button
                                             variant="link"
                                             size="sm"
                                             onClick={() => copyToClipboard(track.trackId)}
                                             className="text-blue-400 p-0 ml-1"
                                             title="Copy Track ID"
                                         >
                                             <Copy className="w-3 h-3" />
                                         </Button>
                                    </div>
                               </div>

                               {isError ? (
                                   <div className="text-sm text-red-400 flex items-center gap-2">
                                       <AlertCircle className="w-4 h-4" />
                                       <span>{errorMessage || 'Failed to load'} ({retryCount}/{MAX_RETRY_ATTEMPTS} retries)</span> {/* Display retry count */}
                                        {errorMessage !== 'Retrying...' && retryCount < MAX_RETRY_ATTEMPTS && ( // Only show retry button if not retrying and below max attempts
                                           <Button
                                               variant="outline"
                                               size="sm" // Changed size back to sm for more padding
                                               onClick={() => handleRetryTrack(track.trackId, track.trackName, false)} // Pass false for isAutoRetry
                                               className="bg-red-900/30 text-red-300 border-red-500/30 hover:bg-red-800/50 px-2 py-1" // Added padding classes
                                           >
                                               <RotateCw className="h-3 w-3 mr-1" /> {/* Added RotateCw icon */}
                                               Retry
                                           </Button>
                                       )}
                                        {errorMessage === 'Retrying...' && ( // Show loading spinner when retrying
                                            <RotateCw className="h-4 w-4 animate-spin text-red-400" />
                                        )}
                                         {retryCount >= MAX_RETRY_ATTEMPTS && errorMessage !== 'Retrying...' && (
                                             <span className="text-xs text-gray-500 italic">Max retries reached.</span>
                                         )}
                                   </div>
                               ) : (
                                   // Adjusted grid layout for stats and integrated medals - Moved Verified to the end
                                   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm text-gray-300 w-full"> {/* Adjusted grid columns and gaps for better symmetry */}
                                       <div className="flex items-center gap-1"> {/* Flex container for Time */}
                                           <p>Your Time:</p>
                                           <span className="font-semibold text-blue-300">{timeDisplay}</span>
                                       </div>
                                       <div className="flex items-center gap-1"> {/* Flex container for Rank */}
                                           <p>Rank:</p>
                                           <span className="font-semibold text-blue-300">{rankDisplay}</span>
                                           {/* Re-added rankMedal display here */}
                                           {rankMedal && (
                                                <>
                                                    <Tooltip id={`rank-medal-${track.trackId}`}><span className="text-xs">{rankMedal.label}</span></Tooltip>
                                                    <span
                                                        data-tooltip-id={`rank-medal-${track.trackId}`}
                                                        style={{ color: rankMedal.color }}
                                                        className={`text-lg`}
                                                        title={rankMedal.label || ''}
                                                        data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${rankMedal.label.replace(/\s/g, '')}`}
                                                    >
                                                        {rankMedal.icon}
                                                    </span>
                                                </>
                                            )}
                                       </div>
                                       <div className="flex items-center gap-1"> {/* Flex container for Percent and Medal */}
                                           <p>Percent:</p>
                                           <span className="font-semibold text-blue-300">{percentDisplay}</span>
                                           {/* Display Percent Medal inline */}
                                           {percentMedal && (
                                               <>
                                                   <Tooltip id={`percent-medal-${track.trackId}`}><span className="text-xs">{percentMedal.label}</span></Tooltip>
                                                   <span
                                                       data-tooltip-id={`percent-medal-${track.trackId}`}
                                                       style={{ color: percentMedal.color }}
                                                       className={`text-lg`}
                                                       title={percentMedal.label || ''}
                                                       data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${percentMedal.label.replace(/\s/g, '')}`}
                                                   >
                                                       {percentMedal.icon}
                                                   </span>
                                               </>
                                           )}
                                       </div>
                                       {/* Removed the WR Time display */}
                                       <div className="flex items-center gap-1"> {/* Flex container for WR Time Gap */}
                                           <p>WR Time Gap:</p>
                                           <span className="font-semibold text-blue-300">{wrTimeGapDisplay}</span>
                                       </div>
                                       <div className="flex items-center gap-1"> {/* Flex container for WR Percent Gap and Medal */}
                                           <p>WR Gap %:</p> {/* Renamed label */}
                                           <span className="font-semibold text-blue-300">{wrPercentGapDisplay}</span>
                                           {/* Display WR Gap % Medal inline */}
                                           {wrGapMedal && (
                                                <>
                                                    <Tooltip id={`wr-gap-medal-${track.trackId}`}><span className="text-xs">{wrGapMedal.label}</span></Tooltip>
                                                    <span
                                                        data-tooltip-id={`wr-gap-medal-${track.trackId}`}
                                                        style={{ color: wrGapMedal.color }}
                                                        className={`text-lg`}
                                                        title={wrGapMedal.label || ''}
                                                        data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${wrGapMedal.label.replace(/\s/g, '')}`}
                                                    >
                                                        {wrGapMedal.icon}
                                                    </span>
                                                </>
                                           )}
                                       </div>
                                        {/* Moved Verified State to the end */}
                                       <div className="flex items-center gap-1"> {/* Flex container for Verified State */}
                                           <p>Verified:</p>
                                           {/* Render VerifiedStateIcon directly and place Tooltips next to it */}
                                           {(() => {
                                               const state = entryIsLeaderboardEntry ? (entryOrError as LeaderboardEntry).verifiedState : undefined;
                                                // Determine the correct tooltip ID based on the state
                                               const tooltipId = typeof state === 'number' ? (state === 1 ? 'verified-tip' : (state === 0 ? 'unverified-tip' : 'unknown-tip')) : 'unknown-tip';

                                               return (
                                                   <>
                                                       {/* Tooltips are now defined outside and referenced here */}
                                                       <span data-tooltip-id={tooltipId}> {/* Attach tooltip to the span wrapping the icon */}
                                                           <VerifiedStateIcon verifiedState={state} />
                                                       </span>
                                                   </>
                                               );
                                           })()}
                                       </div>
                                   </div>
                               )}
                           </motion.div>
                       );
                   })
               ) : (
                   <p className="text-gray-400">No tracks available.</p>
               )}
          </CardContent>
      </Card>
    );
  }, [userEntriesByTrack, wrTimesByTrack, copyToClipboard, VerifiedStateIcon, handleRetryTrack, officialSortBy, communitySortBy, reverseOfficialSort, reverseCommunitySort, ALL_TRACKS, OFFICIAL_TRACKS, COMMUNITY_TRACKS]);


    // Helper function to render a single best/worst stat entry with medals
    const renderBestWorstEntry = useCallback((label: string, entry: LeaderboardEntryWithTrackName | undefined, metric: 'time' | 'rank' | 'percent' | 'wrTimeGap' | 'wrPercentGap') => { // Added WR gap metrics
        if (!entry) return <p className="text-gray-400">{label}: N/A</p>;

        let value: string | number = 'N/A';
        let trackInfo = '';


        if (metric === 'time') {
            value = formatTime(entry.frames);
            trackInfo = ` on ${entry.trackName}`;
        } else if (metric === 'rank') {
            value = entry.rank !== undefined ? entry.rank : 'N/A';
             if (value !== 'N/A') trackInfo = ` on ${entry.trackName}`;
        } else if (metric === 'percent') {
            value = entry.percent !== undefined ? entry.percent.toFixed(4) + '%' : 'N/A';
             if (value !== 'N/A') trackInfo = ` on ${entry.trackName}`;
        } else if (metric === 'wrTimeGap') { // Handle WR Time Gap
             value = entry.wrTimeGap !== undefined ? formatTime(entry.wrTimeGap) : 'N/A';
             if (value !== 'N/A') trackInfo = ` on ${entry.trackName}`;
        } else if (metric === 'wrPercentGap') { // Handle WR Percent Gap
             value = entry.wrPercentGap !== undefined ? entry.wrPercentGap.toFixed(4) + '%' : 'N/A';
             if (value !== 'N/A') trackInfo = ` on ${entry.trackName}`;
        }

        // Get both position and mineral medals for this entry, PLUS the new WR Gap % medal
        const rankMedal = getRankMedal(entry.position);
        const percentMedal = getMedal(entry.percent);
        const wrGapMedal = getWrPercentGapMedal(entry.wrPercentGap);


        return (
            <div className="text-gray-300 flex items-center gap-1"> {/* Changed from p to div */}
                {label}:
                 <span className="font-semibold text-blue-300">
                     {value}
                 </span>

                {trackInfo && <span className="text-gray-400 text-sm italic">{trackInfo}</span>}

                {/* Re-added rankMedal display here */}
                 {rankMedal && (
                    <>
                        <Tooltip id={`best-worst-${metric}-${entry.trackId}-rank-medal`}><span className="text-xs">{rankMedal.label}</span></Tooltip>
                        <span
                            data-tooltip-id={`best-worst-${metric}-${entry.trackId}-rank-medal`}
                            style={{ color: rankMedal.color }}
                            className={`text-lg`}
                            title={rankMedal.label || ''}
                            data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${rankMedal.label.replace(/\s/g, '')}`}
                        >
                            {rankMedal.icon}
                        </span>
                    </>
                 )}
                 {percentMedal && (
                    <>
                        <Tooltip id={`best-worst-${metric}-${entry.trackId}-percent-medal`}><span className="text-xs">{percentMedal.label}</span></Tooltip> {/* Tooltip for the percent medal */}
                        <span
                            data-tooltip-id={`best-worst-${metric}-${entry.trackId}-percent-medal`} // Unique ID for percent medal tooltip
                            style={{ color: percentMedal.color }} // Use inline style for color
                            className={`text-lg`} // Keep text size class
                            title={percentMedal.label || ''} // Add title for accessibility
                            data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${percentMedal.label.replace(/\s/g, '')}`} // Add tooltip class name
                        >
                            {percentMedal.icon}
                        </span>
                    </>
                 )}
                  {wrGapMedal && ( // Display the new WR Gap % medal
                     <>
                         <Tooltip id={`best-worst-${metric}-${entry.trackId}-wr-gap-medal`}><span className="text-xs">{wrGapMedal.label}</span></Tooltip>
                         <span
                             data-tooltip-id={`best-worst-${metric}-${entry.trackId}-wr-gap-medal`}
                             style={{ color: wrGapMedal.color }}
                             className={`text-lg`}
                             title={wrGapMedal.label || ''}
                             data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${wrGapMedal.label.replace(/\s/g, '')}`}
                         >
                             {wrGapMedal.icon}
                         </span>
                     </>
                 )}
            </div>
        );
    }, []);


  // Combined function to process input and trigger appropriate data fetching
  const processUserInputAndFetchData = useCallback(async () => {
      setError(null); // Clear error at the start
      setResolvedUserId(null); // Clear previous resolved user ID
      setBasicUserData(null); // Clear previous basic user data
      setUserEntriesByTrack(new Map()); // Clear previous entries map
      setWrTimesByTrack(new Map()); // Clear previous WR times map
      setOfficialTracksWithEntries([]); // Clear previous tracks with entries
      setCommunityTracksWithEntries([]); // Clear previous tracks with entries
      setOfficialAverageStats(null);
      setCommunityAverageStats(null);
      setOverallAverageStats(null);
      setMedalTracks({}); // Clear previous medal data
      setHoveredMedal(null); // Clear hovered medal state
      setOfficialBestWorst({}); // Clear best/worst stats
      setCommunityBestWorst({});
      setOverallBestWorst({});
      setDisplayMode('input'); // Reset display mode initially

      if (!userInput) {
        setError('Please enter a User ID or User Token.');
        return;
      }

      setLoading(true);
      setLoadingStep('Resolving User...'); // Set initial loading step
      let targetUserId: string | null = null;
      let processingError: string | null = null;
      let foundBasicData: UserBasicData | null = null; // Variable to hold found basic data

      // Step 1: Resolve User ID and fetch basic data (name, carColors, isVerifier)
      if (userInputType === 'userid') {
        targetUserId = userInput;
        setBasicUserData({
             name: 'Searching for user...', // Set a temporary state while searching
             carColors: '',
             isVerifier: 'N/A', // isVerifier cannot be determined from User ID
        });

        // Iterate through ALL_TRACKS to find the user's basic data
        // Added a small delay between checks to be less aggressive
        for (const track of ALL_TRACKS) {
            await new Promise(resolve => setTimeout(resolve, 50)); // Add a small delay
            try {
                // First call: Get user's position on using userTokenHash
                const firstCallUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${track.id}&skip=0&amount=1&onlyVerified=false&userTokenHash=${targetUserId}`)}`;
                const firstResponse = await fetch(firstCallUrl);

                if (!firstResponse.ok) {
                     continue; // Continue to the next track if user not found on this one
                }

                const firstData: { total: number; userEntry: LeaderboardEntry | null } = await firstResponse.json();

                if (firstData.userEntry && firstData.userEntry.position !== undefined && firstData.userEntry.position > 0) {
                    const userPosition = firstData.userEntry.position;
                    const skipAmount = userPosition > 1 ? userPosition - 1 : 0; // Calculate skip amount

                    // Second call: Get the user's entry at their position to get name/colors
                    const secondCallUrl = `${PROXY_URL}${encodeURIComponent(API_BASE_URL + `?version=${VERSION}&trackId=${track.id}&skip=${skipAmount}&amount=1&onlyVerified=false`)}`; // Removed userTokenHash here
                    const secondResponse = await fetch(secondCallUrl);

                    if (!secondResponse.ok) {
                        continue; // Continue to the next track on error
                    } else {
                        const secondData: { entries: LeaderboardEntry[] } = await secondResponse.json();

                        if (secondData.entries && secondData.entries.length > 0 && secondData.entries[0].userId === targetUserId) {
                            // Found the user's entry in the entries array - use this data
                            foundBasicData = {
                                name: secondData.entries[0].name,
                                carColors: secondData.entries[0].carColors,
                                isVerifier: 'N/A' // Cannot determine isVerifier from User ID
                            };
                            break; // Stop searching once data is found
                        } else {
                             continue; // Continue to the next track
                        }
                    }
                } else {
                     continue; // Continue to the next track
                }
            } catch (e: any) {
                 const errorMessage = e.message || `Network Error during leaderboard lookup for track ${track.name}`;
                 console.error(`Network Error during leaderboard lookup for track ${track.name}:`, errorMessage, e);
                 // Continue to the next track on network error
                 continue;
            }
        }

        // After iterating through all tracks, set the basic user data
        if (foundBasicData) {
            setBasicUserData(foundBasicData);
        } else {
             // If no entry was found on any track
             setBasicUserData({
                  name: 'User Not Found on any tracks',
                  carColors: '',
                  isVerifier: 'N/A'
             });
             // Set an error if the user wasn't found on any track
             processingError = 'User ID not found on any official or community tracks.';
        }


      } else if (userInputType === 'usertoken') {
        try {
          targetUserId = await sha256(userInput);
          const fetchedBasicData = await fetchUserBasicData(userInput); // Fetch basic data using the token
           // Set basic user data from fetched data
           setBasicUserData(fetchedBasicData);
           if (!fetchedBasicData || !fetchedBasicData.name) {
               // If basic data fetch was successful but returned no name (e.e., token invalid or user doesn't exist via token API)
               processingError = 'Could not retrieve user information for the provided User Token.';
               setBasicUserData({ // Corrected typo from setBasicData
                name: 'User Not Found on any tracks',
                carColors: '',
                isVerifier: 'N/A'
           });
           }
        } catch (e: any) {
          const errorMessage = e.message || 'Failed to process user token or fetch basic data.';
          processingError = errorMessage;
          console.error('Token processing error:', errorMessage, e);
           // Set placeholder basic data on token error
           setBasicUserData({
                name: 'User Not Found on any tracks',
                carColors: '',
                isVerifier: 'N/A'
            });
        }
      }

      // If there was a processing error, set the error state and stop
      if (processingError) {
          setError(processingError);
          setLoading(false);
          setLoadingStep(null); // Clear loading step
          return;
      }

      // If we successfully determined a targetUserId
      if (targetUserId) {
          setResolvedUserId(targetUserId); // Store the resolved user ID

          // Step 2: Fetch stats for all tracks
          // This call remains the same, as it fetches all entries for the resolved user ID
          fetchAllUserTrackStats(targetUserId);

      } else {
          // This case should ideally be covered by processingError now, but keeping as a safeguard
          setError(processingError || 'Could not resolve user ID from the provided input.');
          setLoading(false);
          setLoadingStep(null); // Clear loading step
      }

  }, [userInput, userInputType, fetchUserBasicData, fetchAllUserTrackStats, ALL_TRACKS, PROXY_URL, API_BASE_URL, VERSION]);


    // Effect to set basic user data to 'not found' if no entries are returned after loading
    // This effect is less critical now that basic data is fetched upfront for User ID,
    // but kept as a fallback in case of unexpected API behavior or if the initial lookup fails
    // but track entries are somehow still returned (unlikely but safer).
    useEffect(() => {
        // Only run if resolvedUserId is set, basicUserData is not null/undefined,
        // loading is finished, and no entries are returned in the main fetch.
        // Refined the condition to explicitly check basicUserData != null and use optional chaining for name
        if (resolvedUserId && basicUserData != null && (basicUserData.name === 'Searching for user...' || basicUserData.name === 'Fetching Name...' || basicUserData.name === 'Error fetching track data') && !loading && officialTracksWithEntries.length === 0 && communityTracksWithEntries.length === 0) {
             setBasicUserData({
                 name: 'User Not Found on any tracks',
                 carColors: '',
                 isVerifier: 'N/A',
             });
             // Also set an error if no tracks were found after a successful ID resolution
             setError('User ID found, but no entries were found on any tracks.');
        }
    }, [resolvedUserId, basicUserData, officialTracksWithEntries, communityTracksWithEntries, loading]);

    // Effect for auto-retrying failed tracks
    useEffect(() => {
        if (!resolvedUserId) return; // Only run if a user is loaded

        const retryInterval = setInterval(() => {
            const failedTracksToRetry = Array.from(userEntriesByTrack.entries())
                .filter(([trackId, entryOrError]) =>
                    entryOrError &&
                    typeof entryOrError === 'object' &&
                    'error' in entryOrError &&
                    entryOrError.error !== 'Retrying...' && // Don't retry tracks already marked as retrying
                    entryOrError.retryCount < MAX_RETRY_ATTEMPTS // Only retry if retry count is below max
                );

            if (failedTracksToRetry.length > 0) {
                failedTracksToRetry.forEach(([trackId, entryOrError]) => {
                    // Add a slightly offset random delay between retries
                     const delay = Math.random() * 2000 + 500; // Random delay between 500ms and 2500ms
                     setTimeout(() => {
                         // Find the track name from ALL_TRACKS using the trackId
                         const trackName = ALL_TRACKS.find(t => t.id === trackId)?.name || trackId;
                         handleRetryTrack(trackId, trackName, true); // Pass true for isAutoRetry
                     }, delay);
                });
            }

        }, AUTO_RETRY_INTERVAL); // Check every 7 seconds for failed tracks

        // Cleanup function to clear the interval when the component unmounts or dependencies change
        return () => clearInterval(retryInterval);

    }, [userEntriesByTrack, resolvedUserId, handleRetryTrack, ALL_TRACKS]);


  return (
    // Main container with background and centering
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-4 md:p-8 flex justify-center items-start">
      {/* Add the style block here */}
      <style>{`
        .tooltip-WR { color: #000000 !important; } /* Black */
        .tooltip-Podium { color: #5A32A3 !important; } /* Darker Purple */
        .tooltip-Top10 { color: #9370DB !important; } /* MediumPurple */
        .tooltip-Top25 { color: #4169E1 !important; } /* RoyalBlue */
        .tooltip-Top50 { color: #87CEEB !important; } /* SkyBlue */
        .tooltip-Participant { color: #A0A0A0 !important; } /* Grey */
        .tooltip-Diamond { color: #67E8F9 !important; } /* Cyan 400 */
        .tooltip-Emerald { color: #22C55E !important; } /* Green 500 */
        .tooltip-Gold { color: #FACC15 !important; } /* Amber 400 */
        .tooltip-Silver { color: #9CA3AF !important; } /* Gray 400 */
        .tooltip-Bronze { color: #CD7F32 !important; } /* Bronze */
        /* New WR Gap % Medal Colors */
        .tooltip-Perfect { color: #FFD700 !important; } /* Gold */
        .tooltip-Legendary { color: #9400D3 !important; } /* DarkViolet */
        .tooltip-Mythic { color: #800080 !important; } /* Purple */
        .tooltip-Epic { color: #FF1493 !important; } /* DeepPink */
        .tooltip-Great { color: #00BFFF !important; } /* DeepSkyBlue */
        .tooltip-Good { color: #32CD32 !important; } /* LimeGreen */
        .tooltip-Decent { color: #FFA500 !important; } /* Orange */
      `}</style>
      <AnimatePresence>
        {copiedText && <CopyPopup text={copiedText} />}
      </AnimatePresence>
      {/* Motion div for the main content block */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={cn(
          "max-w-5xl w-full space-y-6", // Increased max-w to 5xl
           // Conditionally center vertically only when in input mode and no error
          { 'flex flex-col justify-center items-center min-h-[calc(100vh-4rem)]': displayMode === 'input' && !error }
        )}
      >
        {/* Increased font size for the title with dropdown animation */}
        <motion.h1
           initial={{ opacity: 0, y: -50 }} // Start above and hidden
           animate={{ opacity: 1, y: 0 }} // End at normal position and visible
           transition={{ duration: 0.8, ease: "easeOut" }} // Add a slight delay after the main box starts
           className="text-4xl sm:text-5xl md:text-6xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"
        >
          User
        </motion.h1>

        {/* Input and Search Section */}
        <motion.div
             // Animation for the search box width
             initial={{ opacity: 1, width: '60%' }} // Start at 60% width
             animate={{ opacity: 1, width: displayMode === 'input' ? '60%' : '100%' }} // Stay at 60% in input mode, animate to 100% otherwise
             transition={{ duration: 0.5 }} // Animation duration
             className="mx-auto" // Center the block horizontally
        >
            <Card className="bg-gray-800/50 text-white border-purple-500/30">
                <CardHeader>
                     <CardTitle className="text-purple-400">Search User Stats</CardTitle>
                     <CardDescription className="text-gray-300">Enter a User ID or User Token to view their stats across all tracks.</CardDescription> {/* Updated description */}
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Container for Select and Input - Use flex-row and items-center */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                       {/* User Input Type Select - Adjusted width */}
                       <Select onValueChange={(value: 'userid' | 'usertoken') => setUserInputType(value)} defaultValue={userInputType}>
                           <SelectTrigger className="w-[120px] bg-black/20 text-white border-purple-500/30 focus:ring-purple-500/50"> {/* Made dropdown narrower */}
                               <SelectValue placeholder="Select Input Type" />
                           </SelectTrigger>
                           <SelectContent className="bg-gray-800 text-white border-purple-500/30">
                               <SelectItem value="userid">User ID</SelectItem>
                               <SelectItem value="usertoken">User Token</SelectItem>
                           </SelectContent>
                       </Select>

                       {/* User Input Field - Use flex-1 to make it take available space */}
                       <Input
                         type="text"
                         placeholder={userInputType === 'userid' ? 'Enter User ID' : 'Enter User Token'}
                         value={userInput}
                         onChange={(e) => setUserInput(e.target.value)}
                         className="flex-1 bg-black/20 text-white border-purple-500/30 placeholder:text-gray-500 focus:ring-purple-500/50"
                       />
                    </div>

                    {/* Search Button - Moved outside the flex container and made full width */}
                    <Button
                      onClick={processUserInputAndFetchData}
                      disabled={loading || !userInput} // Disable if loading or no input
                      className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-8 rounded-full transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 w-full" // Added w-full
                    >
                      {loading ? (
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l2-2.647z"></path>
                        </svg>
                      ) : (
                        <Search className="h-5 w-5" />
                      )}
                      <span className="ml-2">Search</span>
                    </Button>
                </CardContent>
            </Card>
        </motion.div>


        {/* Error Display */}
        <AnimatePresence>
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="w-full"
                >
                    <Alert variant="destructive" className="bg-red-900/50 text-red-300 border-red-500/30">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                        <AlertTitle className="text-red-400">Error</AlertTitle>
                        <AlertDescription>
                            {error}
                             {error.includes("Failed to process user token") && (
                                <p className="mt-2 text-sm text-red-200">
                                    Suggestion: Double-check the User Token entered.
                                </p>
                            )}
                             {error.includes("Could not resolve user ID") && (
                                <p className="mt-2 text-sm text-red-200">
                                    Suggestion: Ensure the entered User ID or User Token is correct.
                                </p>
                            )}
                             {error.includes("User ID not found on any official or community tracks") && (
                                 <p className="mt-2 text-sm text-red-200">
                                     Suggestion: The user might not have any entries on the listed tracks, or the User ID is incorrect.
                                 </p>
                             )}
                              {error.includes("User ID found, but no entries were found on any tracks") && (
                                 <p className="mt-2 text-sm text-red-200">
                                     Suggestion: The User ID is valid, but no entries were found on any tracks.
                                 </p>
                             )}
                        </AlertDescription>
                    </Alert>
                </motion.div>
            )}
        </AnimatePresence>

         {/* Loading Text */}
         <AnimatePresence>
             {loading && loadingStep && (
                 <motion.p
                     key="loading-text"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     transition={{ duration: 0.3 }}
                     className="text-center text-gray-400 text-sm italic"
                 >
                     {loadingStep}
                 </motion.p>
             )}
         </AnimatePresence>


        {/* User Basic Data Display */}
        <AnimatePresence mode="wait">
            {basicUserData && resolvedUserId && (
                 <motion.div
                    key="basic-user-data"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.5 }}
                    className="w-full"
                 >
                     <Card className="bg-gray-800/50 text-white border-purple-500/30">
                         <CardHeader>
                             <CardTitle className="text-purple-400">User Information</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-2">
                             <p className="text-gray-300">Name: <span className="font-semibold text-blue-300">{basicUserData.name}</span></p>
                             {/* Adjusted flex layout for User ID row */}
                             <div className="flex items-center text-gray-300">
                                 <p className="flex-shrink-0 mr-2">User ID:</p> {/* Added flex-shrink-0 and mr-2 */}
                                 <span className="font-mono text-sm text-gray-400 truncate">{resolvedUserId}</span>
                                 <Button
                                     variant="link"
                                     size="sm"
                                     onClick={() => copyToClipboard(resolvedUserId)}
                                     className="text-blue-400 p-0 ml-1 flex-shrink-0" // Added flex-shrink-0
                                     title="Copy User ID"
                                 >
                                     <Copy className="w-3 h-3" />
                                 </Button>
                             </div>
                             <div className="flex items-center text-gray-300">
                                 Car Colors: <span className="ml-2">{displayCarColors(basicUserData.carColors)}</span>
                             </div>
                              <p className="text-gray-300 flex items-center">
                                 Is Verifier: <span className="ml-2">
                                     {basicUserData.isVerifier === 'N/A' ? 'N/A' : (basicUserData.isVerifier ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-gray-400" />)}
                                 </span>
                             </p>
                             {userInputType === 'userid' && (
                                 <p className="text-sm text-gray-400 italic">
                                     Is Verifier status cannot be determined from a User ID. A User Token is required for this information.
                                 </p>
                             )}
                         </CardContent>
                     </Card>
                 </motion.div>
            )}
             {/* Display "User Information Unavailable" message if loading is done, resolvedUserId is set, and basicUserData is null or indicates not found */}
             {!loading && resolvedUserId && basicUserData != null && (
                // Explicitly check basicUserData is an object before accessing name
                typeof basicUserData === 'object' && (
                    basicUserData.name === 'Searching for user...' ||
                    basicUserData.name === 'Fetching Name...' ||
                    basicUserData.name === 'Error fetching track data' ||
                    basicUserData.name.startsWith('User Info Unavailable')
                )
             ) && ( // Added the closing parenthesis and && for the conditional rendering
                 <motion.div
                     key="user-info-unavailable"
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 20 }}
                     transition={{ duration: 0.5 }}
                     className="w-full"
                 >
                     <Alert variant="default" className="bg-blue-900/50 text-blue-300 border-blue-500/30">
                         <TriangleAlert className="h-4 w-4 text-blue-400" />
                         <AlertTitle className="text-blue-400">User Information Unavailable</AlertTitle>
                         <AlertDescription className="text-purple-300">
                             We could not retrieve user information for the provided input. This might mean the User ID or Token is incorrect, or the user has no entries on any tracks.
                         </AlertDescription>
                     </Alert>
                 </motion.div>
            )}
        </AnimatePresence>


        {/* Conditional Display Area */}
        <AnimatePresence mode="wait"> {/* Use mode="wait" to ensure one section exits before the next enters */}
            {displayMode === 'allTrackStats' && (officialTracksWithEntries.length > 0 || communityTracksWithEntries.length > 0 || officialAverageStats || communityAverageStats || overallAverageStats || Object.keys(medalTracks).length > 0 || Object.keys(officialBestWorst).length > 0 || Object.keys(communityBestWorst).length > 0 || Object.keys(overallBestWorst).length > 0 || Array.from(userEntriesByTrack.values()).some(entry => entry && typeof entry === 'object' && 'error' in entry)) && ( // Also show if there are errors
                 <motion.div
                    key="all-track-stats" // Unique key for AnimatePresence
                    // Animation for the stats display section width
                    initial={{ opacity: 0, y: 20, width: '80%' }} // Start at 80% width
                    animate={{ opacity: 1, y: 0, width: '100%' }} // Animate to 100% width
                    exit={{ opacity: 0, y: 20, width: '80%' }} // Animate back on exit
                    transition={{ duration: 0.5 }}
                    className="w-full space-y-6 mx-auto" // Added mx-auto to keep it centered
                 >
                     {/* Combined Average Stats Display */}
                     {(overallAverageStats || officialAverageStats || communityAverageStats) && (
                          <Card className="bg-gray-800/50 text-white border-purple-500/30">
                              <CardHeader>
                                  <CardTitle className="text-purple-400">Average Stats</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4"> {/* Use space-y-4 for vertical spacing between sections */}
                                  {/* Overall Averages */}
                                  {overallAverageStats && (
                                      <div>
                                          <h4 className="text-lg font-semibold text-blue-300 mb-2">Overall (All Tracks with Entries)</h4>
                                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                              <div className="text-center">
                                                  <p className="text-gray-300">Avg Time:</p>
                                                  <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                      {/* Average time now includes milliseconds */}
                                                      {overallAverageStats.avgTime}
                                                  </p>
                                              </div>
                                              <div className="text-center">
                                                  <p className="text-gray-300">Avg Rank:</p>
                                                  <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                      {overallAverageStats.avgRank}
                                                       {/* Medals for Overall Average Rank (using raw average) */}
                                                      {overallAverageStats?.rawAvgRank !== undefined && getRankMedal(overallAverageStats.rawAvgRank) && (
                                                           <>
                                                           <Tooltip id="avg-overall-rank-tip"><span className="text-xs">{getRankMedal(overallAverageStats.rawAvgRank)?.label}</span></Tooltip>
                                                           <span
                                                               data-tooltip-id="avg-overall-rank-tip"
                                                               style={{ color: getRankMedal(overallAverageStats.rawAvgRank)?.color }}
                                                               className={`text-xl`}
                                                               data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getRankMedal(overallAverageStats.rawAvgRank)?.label.replace(/\s/g, '')}`}
                                                           >
                                                               {getRankMedal(overallAverageStats.rawAvgRank)?.icon}
                                                           </span>
                                                        </>
                                                       )}
                                                  </p>
                                             </div>
                                              <div className="text-center">
                                                  <p className="text-gray-300">Avg Percent:</p>
                                                  <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                      {overallAverageStats.avgPercent}
                                                      {/* Medals for Overall Average Percent (using raw average) */}
                                                      {overallAverageStats?.rawAvgPercent !== undefined && getMedal(overallAverageStats.rawAvgPercent) && (
                                                           <>
                                                                <Tooltip id="avg-overall-percent-tip"><span className="text-xs">{getMedal(overallAverageStats.rawAvgPercent)?.label}</span></Tooltip>
                                                                <span
                                                                    data-tooltip-id="avg-overall-percent-tip"
                                                                    style={{ color: getMedal(overallAverageStats.rawAvgPercent)?.color }} // Use inline style for color
                                                                    className={`text-xl`} // Keep text size class
                                                                    data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getMedal(overallAverageStats.rawAvgPercent)?.label.replace(/\s/g, '')}`} // Add tooltip class name
                                                                >
                                                                    {getMedal(overallAverageStats.rawAvgPercent)?.icon}
                                                                </span >
                                                           </>
                                                       )}
                                                  </p>
                                              </div>
                                               {/* Added Average WR Time Gap - Centered */}
                                               <div className="text-center">
                                                    <p className="text-gray-300">Avg WR Time Gap:</p>
                                                    <p className="font-semibold text-lg">{overallAverageStats.avgWrTimeGap}</p>
                                               </div>
                                                {/* Added Average WR Percent Gap - Centered with Medal */}
                                               <div className="text-center">
                                                    <p className="text-gray-300">Avg WR Gap %:</p> {/* Renamed label */}
                                                    <p className="font-semibold text-lg flex items-center justify-center gap-1"> {/* Added flex and gap */}
                                                        {overallAverageStats.avgWrPercentGap}
                                                         {/* Medals for Overall Average WR Percent Gap (using raw average) */}
                                                         {overallAverageStats?.rawAvgPercentGap !== undefined && getWrPercentGapMedal(overallAverageStats.rawAvgPercentGap) && (
                                                             <>
                                                                  <Tooltip id="avg-overall-wr-gap-percent-tip"><span className="text-xs">{getWrPercentGapMedal(overallAverageStats.rawAvgPercentGap)?.label}</span></Tooltip>
                                                                  <span
                                                                      data-tooltip-id="avg-overall-wr-gap-percent-tip"
                                                                      style={{ color: getWrPercentGapMedal(overallAverageStats.rawAvgPercentGap)?.color }} // Use inline style for color
                                                                      className={`text-xl`} // Keep text size class
                                                                       data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getWrPercentGapMedal(overallAverageStats.rawAvgPercentGap)?.label.replace(/\s/g, '')}`} // Add tooltip class name
                                                                  >
                                                                      {getWrPercentGapMedal(overallAverageStats.rawAvgPercentGap)?.icon}
                                                                  </span>
                                                             </>
                                                         )}
                                                    </p>
                                               </div>
                                          </div>
                                      </div>
                                  )}

                                   {/* Separator if both overall and category averages exist */}
                                   {(overallAverageStats && (officialAverageStats || communityAverageStats)) && <hr className="border-gray-700" />}


                                  {/* Official Track Averages */}
                                   {officialAverageStats && (
                                       <div>
                                           <h4 className="text-lg font-semibold text-blue-300 mb-2">Official Tracks (with Entries)</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="text-center">
                                                    <p className="text-gray-300">Avg Time:</p>
                                                    <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                        {/* Average time now includes milliseconds */}
                                                        {officialAverageStats.avgTime}
                                                    </p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-300">Avg Rank:</p>
                                                    <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                        {officialAverageStats.avgRank}
                                                         {/* Medals for Official Average Rank (using raw average) */}
                                                        {officialAverageStats?.rawAvgRank !== undefined && getRankMedal(officialAverageStats.rawAvgRank) && (
                                                             <>
                                                                  <Tooltip id="avg-official-rank-tip"><span className="text-xs">{getRankMedal(officialAverageStats.rawAvgRank)?.label}</span></Tooltip>
                                                                  <span
                                                                      data-tooltip-id="avg-official-rank-tip"
                                                                      style={{ color: getRankMedal(officialAverageStats.rawAvgRank)?.color }}
                                                                      className={`text-xl`}
                                                                       data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getRankMedal(officialAverageStats.rawAvgRank)?.label.replace(/\s/g, '')}`}
                                                                  >
                                                                      {getRankMedal(officialAverageStats.rawAvgRank)?.icon}
                                                                  </span>
                                                             </>
                                                         )}
                                                    </p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-300">Avg Percent:</p>
                                                    <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                        {officialAverageStats.avgPercent}
                                                         {/* Medals for Official Average Percent (using raw average) */}
                                                        {officialAverageStats?.rawAvgPercent !== undefined && getMedal(officialAverageStats.rawAvgPercent) && (
                                                             <>
                                                                  <Tooltip id="avg-official-percent-tip"><span className="text-xs">{getMedal(officialAverageStats.rawAvgPercent)?.label}</span></Tooltip>
                                                                  <span
                                                                      data-tooltip-id="avg-official-percent-tip"
                                                                      style={{ color: getMedal(officialAverageStats.rawAvgPercent)?.color }} // Use inline style for color
                                                                      className={`text-xl`} // Keep text size class
                                                                       data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getMedal(officialAverageStats.rawAvgPercent)?.label.replace(/\s/g, '')}`} // Add tooltip class name
                                                                  >
                                                                      {getMedal(officialAverageStats.rawAvgPercent)?.icon}
                                                                  </span>
                                                             </>
                                                         )}
                                                    </p>
                                                </div>
                                                 {/* Added Average WR Time Gap - Centered */}
                                                <div className="text-center">
                                                     <p className="text-gray-300">Avg WR Time Gap:</p>
                                                     <p className="font-semibold text-lg">{officialAverageStats.avgWrTimeGap}</p>
                                                </div>
                                                 {/* Added Average WR Percent Gap - Centered with Medal */}
                                                <div className="text-center">
                                                     <p className="text-gray-300">Avg WR Gap %:</p> {/* Renamed label */}
                                                     <p className="font-semibold text-lg flex items-center justify-center gap-1"> {/* Added flex and gap */}
                                                        {officialAverageStats.avgWrPercentGap}
                                                         {/* Medals for Official Average WR Percent Gap (using raw average) */}
                                                         {officialAverageStats?.rawAvgPercentGap !== undefined && getWrPercentGapMedal(officialAverageStats.rawAvgPercentGap) && (
                                                             <>
                                                                  <Tooltip id="avg-official-wr-gap-percent-tip"><span className="text-xs">{getWrPercentGapMedal(officialAverageStats.rawAvgPercentGap)?.label}</span></Tooltip>
                                                                  <span
                                                                      data-tooltip-id="avg-official-wr-gap-percent-tip"
                                                                      style={{ color: getWrPercentGapMedal(officialAverageStats.rawAvgPercentGap)?.color }} // Use inline style for color
                                                                      className={`text-xl`} // Keep text size class
                                                                       data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getWrPercentGapMedal(officialAverageStats.rawAvgPercentGap)?.label.replace(/\s/g, '')}`} // Add tooltip class name
                                                                  >
                                                                      {getWrPercentGapMedal(officialAverageStats.rawAvgPercentGap)?.icon}
                                                                  </span>
                                                             </>
                                                         )}
                                                    </p>
                                                </div>
                                            </div>
                                       </div>
                                   )}

                                    {/* Separator if both official and community averages exist */}
                                   {(officialAverageStats && communityAverageStats) && <hr className="border-gray-700" />}

                                  {/* Community Track Averages */}
                                   {communityAverageStats && (
                                       <div>
                                           <h4 className="text-lg font-semibold text-blue-300 mb-2">Community Tracks (with Entries)</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="text-center">
                                                    <p className="text-gray-300">Avg Time:</p>
                                                    <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                        {communityAverageStats.avgTime}
                                                    </p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-300">Avg Rank:</p>
                                                    <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                        {communityAverageStats.avgRank}
                                                         {/* Medals for Community Average Rank (using raw average) */}
                                                        {communityAverageStats?.rawAvgRank !== undefined && getRankMedal(communityAverageStats.rawAvgRank) && (
                                                             <>
                                                                  <Tooltip id="avg-community-rank-tip"><span className="text-xs">{getRankMedal(communityAverageStats.rawAvgRank)?.label}</span></Tooltip>
                                                                  <span
                                                                      data-tooltip-id="avg-community-rank-tip"
                                                                      style={{ color: getRankMedal(communityAverageStats.rawAvgRank)?.color }}
                                                                      className={`text-xl`}
                                                                       data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getRankMedal(communityAverageStats.rawAvgRank)?.label.replace(/\s/g, '')}`}
                                                                  >
                                                                      {getRankMedal(communityAverageStats.rawAvgRank)?.icon}
                                                                  </span>
                                                             </>
                                                         )}
                                                    </p>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-gray-300">Avg Percent:</p>
                                                    <p className="font-semibold text-lg flex items-center justify-center gap-1">
                                                        {communityAverageStats.avgPercent}
                                                         {/* Medals for Community Average Percent (using raw average) */}
                                                        {communityAverageStats?.rawAvgPercent !== undefined && getMedal(communityAverageStats.rawAvgPercent) && (
                                                             <>
                                                                  <Tooltip id="avg-community-percent-tip"><span className="text-xs">{getMedal(communityAverageStats.rawAvgPercent)?.label}</span></Tooltip>
                                                                  <span
                                                                      data-tooltip-id="avg-community-percent-tip"
                                                                      style={{ color: getMedal(communityAverageStats.rawAvgPercent)?.color }} // Use inline style for color
                                                                      className={`text-xl`} // Keep text size class
                                                                       data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getMedal(communityAverageStats.rawAvgPercent)?.label.replace(/\s/g, '')}`} // Add tooltip class name
                                                                  >
                                                                      {getMedal(communityAverageStats.rawAvgPercent)?.icon}
                                                                  </span>
                                                             </>
                                                         )}
                                                    </p>
                                                </div>
                                                 {/* Added Average WR Time Gap - Centered */}
                                                <div className="text-center">
                                                     <p className="text-gray-300">Avg WR Time Gap:</p>
                                                     <p className="font-semibold text-lg">{communityAverageStats.avgWrTimeGap}</p>
                                                </div>
                                                 {/* Added Average WR Percent Gap - Centered with Medal */}
                                                <div className="text-center">
                                                     <p className="text-gray-300">Avg WR Gap %:</p> {/* Renamed label */}
                                                     <p className="font-semibold text-lg flex items-center justify-center gap-1"> {/* Added flex and gap */}
                                                        {communityAverageStats.avgWrPercentGap}
                                                         {/* Medals for Community Average WR Percent Gap (using raw average) */}
                                                         {communityAverageStats?.rawAvgPercentGap !== undefined && getWrPercentGapMedal(communityAverageStats.rawAvgPercentGap) && (
                                                             <>
                                                                  <Tooltip id="avg-community-wr-gap-percent-tip"><span className="text-xs">{getWrPercentGapMedal(communityAverageStats.rawAvgPercentGap)?.label}</span></Tooltip>
                                                                  <span
                                                                      data-tooltip-id="avg-community-wr-gap-percent-tip"
                                                                      style={{ color: getWrPercentGapMedal(communityAverageStats.rawAvgPercentGap)?.color }} // Use inline style for color
                                                                      className={`text-xl`} // Keep text size class
                                                                       data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${getWrPercentGapMedal(communityAverageStats.rawAvgPercentGap)?.label.replace(/\s/g, '')}`} // Add tooltip class name
                                                                  >
                                                                      {getWrPercentGapMedal(communityAverageStats.rawAvgPercentGap)?.icon}
                                                                  </span>
                                                             </>
                                                         )}
                                                    </p>
                                                </div>
                                            </div>
                                       </div>
                                   )}
                              </CardContent>
                          </Card>
                     )}


                     {/* Best/Worst Stats Display */}
                     {(Object.keys(overallBestWorst).length > 0 || Object.keys(officialBestWorst).length > 0 || Object.keys(communityBestWorst).length > 0) && (
                          <Card className="bg-gray-800/50 text-white border-purple-500/30">
                              <CardHeader>
                                  <CardTitle className="text-purple-400">Best / Worst Stats</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4"> {/* Use space-y-4 for vertical spacing between sections */}
                                  {/* Overall Best/Worst */}
                                  {Object.keys(overallBestWorst).length > 0 && (
                                      <div>
                                          <h4 className="text-lg font-semibold text-blue-300 mb-2">Overall (All Tracks with Entries)</h4>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                              <div>
                                                  <p className="font-semibold text-gray-300 mb-1">Best:</p>
                                                  {renderBestWorstEntry('Time', overallBestWorst.bestTime, 'time')}
                                                  {renderBestWorstEntry('Rank', overallBestWorst.bestRank, 'rank')}
                                                  {renderBestWorstEntry('Percent', overallBestWorst.bestPercent, 'percent')}
                                                   {/* Added Best WR Time Gap */}
                                                  {renderBestWorstEntry('WR Time Gap', overallBestWorst.bestWrTimeGap, 'wrTimeGap')}
                                                   {/* Added Best WR Percent Gap */}
                                                  {renderBestWorstEntry('WR Gap %', overallBestWorst.bestWrPercentGap, 'wrPercentGap')} {/* Renamed label */}
                                              </div>
                                              <div>
                                                  <p className="font-semibold text-gray-300 mb-1">Worst:</p>
                                                  {renderBestWorstEntry('Time', overallBestWorst.worstTime, 'time')}
                                                  {renderBestWorstEntry('Rank', overallBestWorst.worstRank, 'rank')}
                                                  {renderBestWorstEntry('Percent', overallBestWorst.worstPercent, 'percent')}
                                                   {/* Added Worst WR Time Gap */}
                                                  {renderBestWorstEntry('WR Time Gap', overallBestWorst.worstWrTimeGap, 'wrTimeGap')}
                                                   {/* Added Worst WR Percent Gap */}
                                                  {renderBestWorstEntry('WR Gap %', overallBestWorst.worstWrPercentGap, 'wrPercentGap')} {/* Renamed label */}
                                              </div>
                                          </div>
                                      </div>
                                  )}

                                   {/* Separator if both overall and category best/worst exist */}
                                   {(Object.keys(overallBestWorst).length > 0 && (Object.keys(officialBestWorst).length > 0 || Object.keys(communityBestWorst).length > 0)) && <hr className="border-gray-700" />}

                                  {/* Official Tracks Best/Worst */}
                                   {Object.keys(officialBestWorst).length > 0 && (
                                       <div>
                                           <h4 className="text-lg font-semibold text-blue-300 mb-2">Official Tracks (with Entries)</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <p className="font-semibold text-gray-300 mb-1">Best:</p>
                                                    {renderBestWorstEntry('Time', officialBestWorst.bestTime, 'time')}
                                                    {renderBestWorstEntry('Rank', officialBestWorst.bestRank, 'rank')}
                                                    {renderBestWorstEntry('Percent', officialBestWorst.bestPercent, 'percent')}
                                                     {/* Added Best WR Time Gap */}
                                                    {renderBestWorstEntry('WR Time Gap', officialBestWorst.bestWrTimeGap, 'wrTimeGap')}
                                                     {/* Added Best WR Percent Gap */}
                                                    {renderBestWorstEntry('WR Gap %', officialBestWorst.bestWrPercentGap, 'wrPercentGap')} {/* Renamed label */}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-300 mb-1">Worst:</p>
                                                    {renderBestWorstEntry('Time', officialBestWorst.worstTime, 'time')}
                                                    {renderBestWorstEntry('Rank', officialBestWorst.worstRank, 'rank')}
                                                    {renderBestWorstEntry('Percent', officialBestWorst.worstPercent, 'percent')}
                                                     {/* Added Worst WR Time Gap */}
                                                    {renderBestWorstEntry('WR Time Gap', officialBestWorst.worstWrTimeGap, 'wrTimeGap')}
                                                     {/* Added Worst WR Percent Gap */}
                                                    {renderBestWorstEntry('WR Gap %', officialBestWorst.worstWrPercentGap, 'wrPercentGap')} {/* Renamed label */}
                                                </div>
                                            </div>
                                       </div>
                                   )}

                                    {/* Separator if both official and community best/worst exist */}
                                   {(Object.keys(officialBestWorst).length > 0 && Object.keys(communityBestWorst).length > 0) && <hr className="border-gray-700" />}

                                 {/* Community Tracks Best/Worst */}
                                  {Object.keys(communityBestWorst).length > 0 && (
                                     <div>
                                         <h4 className="text-lg font-semibold text-blue-300 mb-2">Community Tracks (with Entries)</h4>
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                             <div>
                                                 <p className="font-semibold text-gray-300 mb-1">Best:</p>
                                                 {renderBestWorstEntry('Time', communityBestWorst.bestTime, 'time')}
                                                 {renderBestWorstEntry('Rank', communityBestWorst.bestRank, 'rank')}
                                                 {renderBestWorstEntry('Percent', communityBestWorst.bestPercent, 'percent')}
                                                  {/* Added Best WR Time Gap */}
                                                 {renderBestWorstEntry('WR Time Gap', communityBestWorst.bestWrTimeGap, 'wrTimeGap')}
                                                  {/* Added Best WR Percent Gap */}
                                                 {renderBestWorstEntry('WR Gap %', communityBestWorst.bestWrPercentGap, 'wrPercentGap')} {/* Renamed label */}
                                             </div>
                                             <div>
                                                 <p className="font-semibold text-gray-300 mb-1">Worst:</p>
                                                 {renderBestWorstEntry('Time', communityBestWorst.worstTime, 'time')}
                                                 {renderBestWorstEntry('Rank', communityBestWorst.worstRank, 'rank')}
                                                 {renderBestWorstEntry('Percent', communityBestWorst.worstPercent, 'percent')}
                                                  {/* Added Worst WR Time Gap */}
                                                 {renderBestWorstEntry('WR Time Gap', communityBestWorst.worstWrTimeGap, 'wrTimeGap')}
                                                  {/* Added Worst WR Percent Gap */}
                                                 {renderBestWorstEntry('WR Gap %', communityBestWorst.worstWrPercentGap, 'wrPercentGap')} {/* Renamed label */}
                                             </div>
                                         </div>
                                     </div>
                                 )}

                                  {/* Message if no best/worst stats are available */}
                                   {!(Object.keys(overallBestWorst).length > 0 || Object.keys(officialBestWorst).length > 0 || Object.keys(communityBestWorst).length > 0) && (
                                        <p className="text-gray-400 text-center">No best/worst stats available (user has no entries on any tracks).</p>
                                   )}

                             </CardContent>
                         </Card>
                     )}


                     {/* Medal Counts Display */}
                     {Object.keys(medalTracks).length > 0 && ( // Use medalTracks here
                         <Card className="bg-gray-800/50 text-white border-purple-500/30">
                             <CardHeader>
                                 <CardTitle className="text-purple-400">Medal Counts</CardTitle>
                                 <CardDescription className="text-gray-300">Hover over a medal to see the tracks you earned it on. Click a track name to jump to its entry below.</CardDescription> {/* Updated description */}
                             </CardHeader>
                             <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                 {/* Define the order of medals for display */}
                                 {['WR', 'Podium', 'Top 10', 'Top 25', 'Top 50', 'Participant', 'Diamond', 'Emerald', 'Gold', 'Silver', 'Bronze', 'Perfect', 'Legendary', 'Mythic', 'Epic', 'Great', 'Good', 'Decent'].map(medalLabel => { // Added 'Participant' here
                                     const tracks = medalTracks[medalLabel]; // Get the array of tracks
                                     if (!tracks || tracks.length === 0) return null; // Only display if there are tracks for this medal

                                     // Find the corresponding medal object to get icon and color
                                     const medal = getMedalByLabel(medalLabel);
                                     const isHovered = hoveredMedal === medalLabel;


                                     return (
                                         <motion.div
                                             key={medalLabel}
                                             initial={{ opacity: 0, scale: 0.8, maxHeight: 80 }} // Increased initial maxHeight
                                             animate={{
                                                 opacity: 1,
                                                 scale: 1,
                                                 maxHeight: isHovered ? 300 : 80 // Increased maxHeight on hover end
                                             }}
                                             transition={{ duration: 0.3 }}
                                             className="flex flex-col items-center justify-start p-3 pb-4 bg-gray-700/50 rounded-md overflow-hidden cursor-pointer" // Added pb-4 for bottom padding
                                             onHoverStart={() => setHoveredMedal(medalLabel)} // Set hovered state
                                             onHoverEnd={() => setHoveredMedal(null)} // Clear hovered state
                                         >
                                             <div className="flex items-center gap-1 mb-1">
                                                  {medal && (
                                                       <>
                                                            {/* Removed the duplicate Tooltip here */}
                                                            <span
                                                                data-tooltip-id={`medal-count-tip-${medalLabel}`} // Ensure this ID matches the Tooltip at the bottom
                                                                style={{ color: medal.color }} // Use inline style for color
                                                                className={`text-2xl`} // Keep text size class
                                                                data-tooltip-class-name={`!bg-gray-700 !text-white tooltip-${medalLabel.replace(/\s/g, '')}`} // Add tooltip class name
                                                            >
                                                                {medal.icon}
                                                            </span>
                                                       </>
                                                  )}
                                             </div>
                                             <span className="text-xl font-bold text-purple-400">{medalLabel}: {tracks.length}</span> {/* Display count */}

                                             {/* Track List - Conditionally rendered and animated */}
                                             <AnimatePresence>
                                                 {isHovered && (
                                                     <motion.ul
                                                         initial={{ opacity: 0, y: 10 }}
                                                         animate={{ opacity: 1, y: 0 }}
                                                         exit={{ opacity: 0, y: 10 }}
                                                         transition={{ duration: 0.2 }}
                                                         className="mt-2 text-sm text-gray-300 w-full text-center space-y-1 list-none p-0" // Added list-none and p-0 for styling
                                                     >
                                                         {tracks.map(track => {
                                                             // Determine which metric to display based on medal type
                                                             const displayMetric = medal?.type === 'rank' ?
                                                                 (track.rank !== undefined ? `Rank: ${track.rank}` : 'Rank: N/A') :
                                                                 (medal?.type === 'mineral' ?
                                                                      (track.percent !== undefined ? `Percent: ${track.percent.toFixed(4)}%` : 'Percent: N/A') :
                                                                      (track.wrPercentGap !== undefined ? `WR Gap %: ${track.wrPercentGap.toFixed(4)}%` : 'WR Gap %: N/A') // Display WR Gap % for the new medal type
                                                                 );


                                                             return (
                                                                 <li key={track.trackId} className="truncate"> {/* Use trackId as key for consistency */}
                                                                     {/* Added data-tooltip-id and data-tooltip-content for react-tooltip */}
                                                                     <span
                                                                         className="cursor-pointer hover:underline" // Indicate clickable and add hover effect
                                                                         data-tooltip-id={`track-tooltip-${track.trackId}`} // Unique ID for each track tooltip
                                                                         data-tooltip-content={`${displayMetric}`} // Set the tooltip text to ONLY the metric
                                                                         onClick={() => scrollToTrack(track.trackId)} // Add onClick handler
                                                                     >
                                                                         {track.trackName}
                                                                     </span>
                                                                      {/* Add a Tooltip component for each track name */}
                                                                     <Tooltip id={`track-tooltip-${track.trackId}`} place="top" className="!text-xs !bg-gray-700 !text-white" />
                                                                 </li>
                                                             );
                                                         })}
                                                     </motion.ul>
                                                 )}
                                             </AnimatePresence>
                                         </motion.div>
                                     );
                                 })}
                             </CardContent>
                         </Card>
                     )}


                     {/* Official Track Stats List */}
                     {/* Pass the full list of official tracks and the map of user entries */}
                     {renderTrackStatsList(sortedTrackDisplayStats.official, "Official Track Entries", officialSortBy, setOfficialSortBy, reverseOfficialSort, setReverseOfficialSort)} {/* Pass reverse state and setter */}

                     {/* Community Track Stats List */}
                      {/* Pass the full list of community tracks and the map of user entries */}
                     {renderTrackStatsList(sortedTrackDisplayStats.community, "Community Track Entries", communitySortBy, setCommunitySortBy, reverseCommunitySort, setReverseCommunitySort)} {/* Pass reverse state and setter */}

                 </motion.div>
            )}
        </AnimatePresence>

         {/* Tooltip component */}
         {/* Tooltips for Verified State Icons - Moved outside the component */}
         <Tooltip id="unverified-tip" place="top" className="!text-xs !bg-gray-700 !text-white">Unverified</Tooltip>
         <Tooltip id="verified-tip" place="top" className="!text-xs !bg-gray-700 !text-white">Verified</Tooltip>
         <Tooltip id="unknown-tip" place="top" className="!text-xs !bg-gray-700 !text-white">Unknown Verification State</Tooltip>

         {/* Tooltips for Average Medals */}
         <Tooltip id="avg-overall-rank-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />
         <Tooltip id="avg-overall-percent-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />
         <Tooltip id="avg-official-rank-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />
         <Tooltip id="avg-official-percent-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />
         <Tooltip id="avg-community-rank-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />
         <Tooltip id="avg-community-percent-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />
          {/* Tooltips for Average WR Gap % Medals */}
         <Tooltip id="avg-overall-wr-gap-percent-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />
         <Tooltip id="avg-official-wr-gap-percent-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />
         <Tooltip id="avg-community-wr-gap-percent-tip" place="top" className="!text-xs !bg-gray-700 !text-white" />


          {/* Tooltips for Medal Counts */}
         {/* Tooltips for Medal Counts - These are now less critical as hover shows tracks directly, but kept for completeness */}
         {['WR', 'Podium', 'Top 10', 'Top 25', 'Top 50', 'Participant', 'Diamond', 'Emerald', 'Gold', 'Silver', 'Bronze', 'Perfect', 'Legendary', 'Mythic', 'Epic', 'Great', 'Good', 'Decent'].map(label => {
             const medal = getMedalByLabel(label);
             if (!medal) return null;
             return (
                 <Tooltip key={`medal-count-tip-${label}`} id={`medal-count-tip-${label}`} place="top" className="!text-xs !bg-gray-700 !text-white">
                     <span>{medal.label}</span>
                 </Tooltip>
             );
         })}
          {/* Tooltips for WR Gap % Medals in track entries and best/worst */}
         {['Perfect', 'Legendary', 'Mythic', 'Epic', 'Great', 'Good', 'Decent'].map(label => {
             const medal = getMedalByLabel(label);
             if (!medal) return null;
             return (
                 <Tooltip key={`wr-gap-medal-tip-${label}`} id={`wr-gap-medal-tip-${label}`} place="top" className="!text-xs !bg-gray-700 !text-white">
                     <span>{medal.label}</span>
                 </Tooltip>
             );
         })}


      </motion.div>
       {/* Version and Play Game Link - Conditionally rendered */}
       {displayMode === 'input' && !loading && ( // Only show when in input mode AND not loading
           <div className="text-center text-gray-500 text-sm mt-4 absolute bottom-4 left-1/2 transform -translate-x-1/2">
               <p>Version: {VERSION}</p>
               <p>
                 Play the game: <a href="https://www.kodub.com/apps/polytrack" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Polytrack</a>
               </p>
           </div>
       )}
    </div>
  );
};

export default UserViewer;
