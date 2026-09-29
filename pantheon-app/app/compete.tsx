import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Clipboard,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { MathText } from '../components/MathText';
import { F, width } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  increment,
  serverTimestamp,
  deleteField,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';
import { getDownloadedCoursesLocal, getLocalQuestions } from '../lib/db';

interface Course {
  id: string;
  code: string;
  title: string;
  semester: string;
  level: string;
}

interface Question {
  id: string;
  sheetId: string;
  courseId: string;
  text: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  options?: string[];
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function CompeteScreen() {
  const router = useRouter();
  const { user, profile, systemConfig, isOffline } = useAuth();
  const userProfile = profile;
  const { colors: C, themeName } = useTheme();
  const s = useMemo(() => createStyles(C, themeName), [C, themeName]);

  const [gameState, setGameState] = useState<'lobby' | 'selecting_course' | 'selecting_lobby_type' | 'waiting' | 'playing' | 'results'>('lobby');

  // Game data states
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lobbyType, setLobbyType] = useState<'quick' | 'create' | 'join' | null>(null);

  const [selectedNumQuestions, setSelectedNumQuestions] = useState<10 | 20 | 30>(10);
  const [customNumQuestions, setCustomNumQuestions] = useState<number>(10);
  const [joinRoomCode, setJoinRoomCode] = useState('');

  // Live Match variables
  const [currentMatch, setCurrentMatch] = useState<any>(null);
  const [searchCountdown, setSearchCountdown] = useState<number>(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [matchQuestions, setMatchQuestions] = useState<Question[]>([]);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'mistakes' | 'correct'>('all');

  // In-Game Live Timers
  const [timeLeft, setTimeLeft] = useState<number>(300);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [userStats, setUserStats] = useState({
    timeTaken: 0,
    answersLog: [] as { isCorrect: boolean; time: number; speedBonus: boolean }[],
  });

  // Leaderboard states
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [userRank, setUserRank] = useState<string | number>('Unranked');

  // Clipboard message feedback
  const [copiedCode, setCopiedCode] = useState(false);

  const activeSeasonId = systemConfig?.activeSeasonId || null;
  const activeSeasonName = systemConfig?.activeSeasonName || null;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [gameState]);

  // Load Leaderboard and Courses
  useEffect(() => {
    if (!user) return;

    setLoadingCourses(true);

    // Instant local offline courses check
    try {
      const localCourses = getDownloadedCoursesLocal();
      if (localCourses && localCourses.length > 0) {
        const mappedLocal = localCourses.map((c) => ({
          id: c.id,
          code: c.code || '',
          title: c.title || '',
          semester: c.semester || '1st',
          level: c.level || '',
        }));
        getFilteredCoursesForStudent(mappedLocal, profile, true).then((filtered) => {
          if (filtered && filtered.length > 0) {
            setCourses(filtered);
            setLoadingCourses(false);
          }
        });
      }
    } catch (e) {
      console.log('Local courses fetch fallback in compete:', e);
    }

    const coursesCol = collection(db, 'courses');
    getDocs(coursesCol)
      .then(async (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Course);
        let semFiltered = list;
        if (systemConfig && systemConfig.currentSemester !== 'none') {
          semFiltered = list.filter((c) => c.semester === systemConfig.currentSemester);
        }
        const filtered = await getFilteredCoursesForStudent(semFiltered, profile, true);
        if (filtered && filtered.length > 0) {
          setCourses(filtered);
        }
        setLoadingCourses(false);
      })
      .catch((err) => {
        console.error('Error fetching courses:', err);
        setLoadingCourses(false);
      });
  }, [user, systemConfig]);

  // Load Leaderboard inside Active Season
  useEffect(() => {
    if (!activeSeasonId) {
      setLeaderboard([]);
      setUserRank('Unranked');
      return;
    }

    setLoadingLeaderboard(true);
    const leaderboardCol = collection(db, 'seasons', activeSeasonId, 'leaderboard');
    const unsubscribe = onSnapshot(
      query(leaderboardCol),
      (snapshot) => {
        let parsedList = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        // Filter by user university (At)
        if (profile?.At) {
          parsedList = parsedList.filter((item: any) => !item.At || item.At.toLowerCase() === profile.At.toLowerCase());
        }

        parsedList.sort((a: any, b: any) => {
          if ((b.stars || 0) !== (a.stars || 0)) {
            return (b.stars || 0) - (a.stars || 0);
          }
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeA - timeB;
        });

        setLeaderboard(parsedList);

        const myIndex = parsedList.findIndex((item) => item.id === user?.uid);
        if (myIndex !== -1) {
          setUserRank(myIndex + 1);
        } else {
          setUserRank('Unranked');
        }
        setLoadingLeaderboard(false);
      },
      (err) => {
        console.error('Leaderboard load failed:', err);
        setLoadingLeaderboard(false);
      }
    );

    return () => unsubscribe();
  }, [activeSeasonId, user]);

  // Listen to the match if one is active/waiting
  useEffect(() => {
    if (!currentMatch?.id || !user) return;

    const unsubscribe = onSnapshot(doc(db, 'compete_matches', currentMatch.id), (docSnap) => {
      if (!docSnap.exists()) return;
      const updatedMatch: any = { id: docSnap.id, ...docSnap.data() };

      // Check if current user was kicked from private room
      if (user?.uid && updatedMatch.kickedList?.includes(user.uid)) {
        setCurrentMatch(null);
        setGameState('select_mode');
        Alert.alert('Removed from Room', 'You have been removed from this private room by the host.');
        return;
      }

      if (
        user?.uid &&
        updatedMatch.type === 'custom_room' &&
        user.uid !== updatedMatch.creatorId &&
        gameState === 'waiting' &&
        updatedMatch.opponentId !== user.uid
      ) {
        setCurrentMatch(null);
        setGameState('lobby');
        Alert.alert('Removed from Room', 'You have been removed from this private room by the host.');
        return;
      }

      setCurrentMatch(updatedMatch);

      // Transition from matching waiting screen to game screen
      if (gameState !== 'playing' && gameState !== 'results' && updatedMatch.status === 'active') {
        const qList = updatedMatch.questions || [];
        setMatchQuestions(qList);
        setActiveQuestionIndex(0);
        setSelectedOption(null);
        setHasSubmittedAnswer(false);
        setTimeLeft(updatedMatch.durationSeconds || (updatedMatch.duration ? updatedMatch.duration * 60 : 180));
        setQuestionStartTime(Date.now());
        setUserStats({ timeTaken: 0, answersLog: [] });
        setGameState('playing');
        Alert.alert('Match Found!', 'Match found! Let the Point Grab begin! 🎮');
      }

      // Live game state completion or forfeit trigger
      if (gameState === 'playing') {
        if (updatedMatch.status === 'completed') {
          setGameState('results');
          if (updatedMatch.forfeitedBy) {
            Alert.alert('Match Over', 'The match was ended because a player forfeited.');
          } else {
            Alert.alert('Match Concluded', 'Match concluded! Let\'s see the results.');
          }
          return;
        }

        if (updatedMatch.status === 'active') {
          const isCreator = user?.uid === updatedMatch.creatorId;
          const myAnswers = isCreator ? updatedMatch.creatorAnswers : updatedMatch.opponentAnswers;
          const opponentAnswers = isCreator ? updatedMatch.opponentAnswers : updatedMatch.creatorAnswers;

          const qCount = updatedMatch.questions?.length || 5;
          const myAnswerCount = Object.keys(myAnswers || {}).length;
          const opAnswerCount = Object.keys(opponentAnswers || {}).length;

          if (myAnswerCount === qCount && opAnswerCount === qCount) {
            concludeMatch(updatedMatch);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [currentMatch?.id, gameState, user]);

  // Live match timer hook
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      // Check 3-minute grace clock if opponent or we finished first
      if (currentMatch?.finishGraceTime) {
        const graceSecondsLeft = Math.max(0, Math.ceil((currentMatch.finishGraceTime - Date.now()) / 1000));
        if (graceSecondsLeft <= 0) {
          concludeMatch(currentMatch);
          clearInterval(interval);
          return;
        }
      }

      setTimeLeft((prev) => {
        if (prev <= 1) {
          concludeMatch(currentMatch);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, currentMatch]);

  // Simulated AI opponent answering questions
  const simulateBotBehavior = (matchId: string) => {
    let currentQ = 0;

    const postBotAnswer = async () => {
      const docRef = doc(db, 'compete_matches', matchId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return;
      const matchData = docSnap.data();

      if (matchData.status === 'completed') return;

      const totalQuestions = matchData.questions?.length || 10;
      if (currentQ >= totalQuestions) return;

      const currentQObj = matchData.questions[currentQ];
      const qId = currentQObj.id || `q_${currentQ}`;

      // 75% accuracy rate
      const answerCorrectly = Math.random() < 0.75;
      const chosenAnswer = answerCorrectly ? currentQObj.correctAnswer : currentQObj.incorrectAnswers[0];

      const botFieldKey = 'opponentAnswers';
      const botPointsKey = 'opponentPoints';

      // Check speed bonus (did user answer before bot?)
      const hasUserAnswered = matchData.creatorAnswers && matchData.creatorAnswers[qId];
      let pointsAwarded = 0;
      if (answerCorrectly) {
        pointsAwarded = 1;
        if (!hasUserAnswered) {
          pointsAwarded += 1; // Speed bonus
        }
      }

      await updateDoc(docRef, {
        [`${botFieldKey}.${qId}`]: {
          selectedAnswer: chosenAnswer,
          isCorrect: answerCorrectly,
          answeredAt: Date.now(),
          opponentAnsweredBefore: !!hasUserAnswered,
          pointsAwarded,
        },
        [botPointsKey]: increment(pointsAwarded),
      });

      currentQ++;
      if (currentQ < totalQuestions) {
        setTimeout(postBotAnswer, Math.floor(Math.random() * 6000) + 6000); // 6-12s response
      }
    };

    // First delay before bot answers
    setTimeout(postBotAnswer, Math.floor(Math.random() * 5000) + 4000);
  };

  // Searching match timeout hook ( triggers bot after 10 seconds if no human lobby ) AND periodic 2-second scan
  useEffect(() => {
    if (gameState !== 'waiting' || lobbyType !== 'quick' || !currentMatch?.id) return;

    setSearchCountdown(10);
    const interval = setInterval(async () => {
      setSearchCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          triggerBotOpponent();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Resilient 2-second scan interval with freshness validation to prevent ghost matching
    const scanInterval = setInterval(async () => {
      if (!currentMatch?.id || !user?.uid || !selectedCourse?.id) return;
      try {
        const lobbiesQuery = query(
          collection(db, 'compete_matches'),
          where('status', '==', 'waiting'),
          where('type', '==', 'quick_match'),
          where('courseId', '==', selectedCourse.id),
          where('numQuestions', '==', selectedNumQuestions),
          where('At', '==', profile?.At || 'futo')
        );
        const lobbiesSnap = await getDocs(lobbiesQuery);
        
        let foundLobby: any = null;
        for (const val of lobbiesSnap.docs) {
          const lobbyData = val.data();
          if (lobbyData.creatorId !== user.uid && val.id !== currentMatch.id) {
            // Verify lobby is not stale/abandoned (older than 20s without heartbeat)
            const lastActive = lobbyData.lastHeartbeat || lobbyData.createdAt || 0;
            if (Date.now() - lastActive > 20000) {
              updateDoc(doc(db, 'compete_matches', val.id), { status: 'aborted' }).catch(() => {});
              continue;
            }
            foundLobby = { id: val.id, ...lobbyData };
            break;
          }
        }

        if (foundLobby) {
          clearInterval(scanInterval);
          clearInterval(interval);

          // Join this other existing matching room instead!
          const otherDocRef = doc(db, 'compete_matches', foundLobby.id);
          await updateDoc(otherDocRef, {
            opponentId: user.uid,
            opponentUsername: profile?.username || user.email || 'Classmate',
            opponentPhotoURL: profile?.photoURL || '',
            status: 'active',
            startTime: Date.now()
          });

          // Decommission our previous created match (set status: 'aborted' so someone else doesn't join our orphaned lobby)
          const ourDocRef = doc(db, 'compete_matches', currentMatch.id);
          await updateDoc(ourDocRef, {
            status: 'aborted'
          });

          setCurrentMatch({ id: foundLobby.id, ...foundLobby, status: 'active' });
        }
      } catch (err) {
        console.error("Rescan failed:", err);
      }
    }, 2000);

    // Active heartbeat every 4 seconds to signal this client is live and prevent ghost matching
    const heartbeatInterval = setInterval(() => {
      if (currentMatch?.id && user?.uid === currentMatch.creatorId) {
        updateDoc(doc(db, 'compete_matches', currentMatch.id), {
          lastHeartbeat: Date.now(),
        }).catch(() => {});
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(scanInterval);
      clearInterval(heartbeatInterval);
    };
  }, [gameState, lobbyType, currentMatch?.id, selectedCourse?.id, selectedNumQuestions, user?.uid, profile]);

  const triggerBotOpponent = async () => {
    if (!currentMatch?.id) return;
    try {
      const matchRef = doc(db, 'compete_matches', currentMatch.id);
      const snap = await getDoc(matchRef);
      if (!snap.exists()) return;
      const data = snap.data();

      if (data.status === 'active') return; // A human user already joined

      // Update to active with bot!
      await updateDoc(matchRef, {
        status: 'active',
        opponentId: 'bot_colearn',
        opponentUsername: 'CoLearn Bot 🤖',
        opponentPhotoURL: '',
        startTime: Date.now(),
      });

      // Start the simulated Bot behavior
      simulateBotBehavior(currentMatch.id);
    } catch (err) {
      console.error('Trigger bot crash:', err);
    }
  };

  // Setup match, find lobbies or create new
  const handleStartLobbymaking = async (mode: 'quick' | 'create') => {
    if (!selectedCourse || !user) return;

    try {
      // 1. Fetch questions for selected Course (try local SQLite first, then Firestore)
      let list: Question[] = [];
      try {
        const localQs = getLocalQuestions(selectedCourse.id);
        if (localQs && localQs.length > 0) {
          list = localQs.map((q) => {
            const corr = typeof q.answer === 'number' ? (q.opts[q.answer] || q.opts[0] || 'Option A') : (q.answer || q.opts[0] || 'Option A');
            const incorr = typeof q.answer === 'number'
              ? q.opts.filter((_: any, idx: number) => idx !== q.answer)
              : q.opts.filter((o: any) => o !== corr);
            return {
              id: q.id,
              sheetId: q.sheetId || 'sheet_1',
              courseId: selectedCourse.id,
              text: q.q,
              correctAnswer: corr,
              incorrectAnswers: incorr.length > 0 ? incorr : ['Option B', 'Option C', 'Option D'],
            };
          });
        }
      } catch (e) {
        console.log('Local question fetch in compete:', e);
      }

      if (list.length === 0 && !isOffline) {
        try {
          const qQuery = query(collection(db, 'questions'), where('courseId', '==', selectedCourse.id));
          const qSnap = await getDocs(qQuery);
          if (!qSnap.empty) {
            list = qSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Question);
          }
        } catch (e) {
          console.log('Online questions fetch in compete:', e);
        }
      }

      const finalNumQuestions = mode === 'quick' ? selectedNumQuestions : customNumQuestions;

      // Use default mock templates if course has no questions
      let baseQuestionsList = list.length > 0 ? list : [
        {
          id: 'temp_q1',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `Which core principle defines appropriate study scheduling regarding ${selectedCourse.code}?`,
          correctAnswer: 'Spaced repetition coupled with structured active recall sessions.',
          incorrectAnswers: ['Mass cramming everything overnight during tests.', 'Skimming handouts passively without problem sheets.', 'Memorizing question options exclusively.'],
        },
        {
          id: 'temp_q2',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `What is a core milestone in master learning for ${selectedCourse.title}?`,
          correctAnswer: 'Breaking down hard textbook sub-concepts to teach others clearly.',
          incorrectAnswers: ['Highlighting whole chapters in yellow markers.', 'Retrieving only simple summaries.', 'Passing syllabus assignments late.'],
        },
        {
          id: 'temp_q3',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `Which student resource on CoLearn optimizes quick evaluation performance?`,
          correctAnswer: 'Simulated CBT timers and past question sheets.',
          incorrectAnswers: ['Unorganized bookmarks.', 'Public discussion threads strictly.', 'Profile settings changes.'],
        },
        {
          id: 'temp_q4',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `Why is student collaboration highly effective in academic modules?`,
          correctAnswer: 'Peer explanations highlight personal knowledge gaps.',
          incorrectAnswers: ['To copy homework easily.', 'It decreases individual study time.', 'To complete courses without reading.'],
        },
        {
          id: 'temp_q5',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `In a high pressure CBT examination, what constitutes the healthiest strategy?`,
          correctAnswer: 'Attempting the straightforward problems first, leaving complex ones for later review.',
          incorrectAnswers: ['Sticking to question one until solved.', 'Guessing options blind.', 'Rushing to finish in five minutes.'],
        }
      ];

      // Safe cyclic generator to fit finalNumQuestions
      let combinedList: Question[] = [];
      while (combinedList.length < finalNumQuestions) {
        combinedList = [...combinedList, ...shuffleArray(baseQuestionsList)];
      }

      // Prepare exact structures
      const selectedQuestions = combinedList.slice(0, finalNumQuestions).map((q, idx) => {
        const optionsShuffle = shuffleArray([q.correctAnswer, ...q.incorrectAnswers]);
        return {
          ...q,
          id: `${q.id || 'q'}_idx_${idx}`,
          options: optionsShuffle,
        };
      });

      const overallDurationMins = Math.max(15, Math.ceil(finalNumQuestions * 1.5));

      if (mode === 'quick') {
        if (!activeSeasonId) {
          Alert.alert('Quick Match Locked', 'Quick Matches are locked because there is no active season currently. Play a custom private match!');
          return;
        }

        setGameState('waiting');
        setSearchCountdown(10);

        // Standard 1v1 quick match
        const lobbiesQuery = query(
          collection(db, 'compete_matches'),
          where('status', '==', 'waiting'),
          where('type', '==', 'quick_match'),
          where('courseId', '==', selectedCourse.id),
          where('numQuestions', '==', selectedNumQuestions),
          where('At', '==', profile?.At || 'futo')
        );
        const lobbiesSnap = await getDocs(lobbiesQuery);

        let foundMatchDoc: any = null;
        for (const docSnap of lobbiesSnap.docs) {
          const matchData = docSnap.data();
          if (matchData.creatorId === user.uid) {
            // Already created by same user, just wait
            setCurrentMatch({ id: docSnap.id, ...matchData });
            return;
          }
          // Validate freshness: ignore stale / abandoned ghost matches (older than 20s without heartbeat)
          const lastActive = matchData.lastHeartbeat || matchData.createdAt || 0;
          if (Date.now() - lastActive > 20000) {
            updateDoc(doc(db, 'compete_matches', docSnap.id), { status: 'aborted' }).catch(() => {});
            continue;
          }
          foundMatchDoc = docSnap;
          break;
        }

        if (foundMatchDoc) {
          // Join existing
          const matchData = foundMatchDoc.data();
          await updateDoc(doc(db, 'compete_matches', foundMatchDoc.id), {
            status: 'active',
            opponentId: user.uid,
            opponentUsername: profile?.username || user.email || 'Classmate',
            opponentPhotoURL: profile?.photoURL || '',
            startTime: Date.now(),
          });

          setCurrentMatch({ id: foundMatchDoc.id, ...matchData, status: 'active' });
        } else {
          // Create new waiting quick match lobby
          const newMatchDoc = doc(collection(db, 'compete_matches'));
          const matchPayload = {
            id: newMatchDoc.id,
            courseId: selectedCourse.id,
            courseCode: selectedCourse.code,
            type: 'quick_match',
            duration: overallDurationMins,
            numQuestions: selectedNumQuestions,
            status: 'waiting',
            creatorId: user.uid,
            creatorUsername: profile?.username || user.email || 'Student User',
            creatorPhotoURL: profile?.photoURL || '',
            opponentId: null,
            opponentUsername: null,
            questions: selectedQuestions,
            creatorPoints: 0,
            opponentPoints: 0,
            creatorAnswers: {},
            opponentAnswers: {},
            finishGraceTime: null,
            firstFinishedUserId: null,
            createdAt: Date.now(),
            lastHeartbeat: Date.now(),
            At: profile?.At || 'futo',
          };
          await setDoc(newMatchDoc, matchPayload);
          setCurrentMatch(matchPayload);
        }
      } else {
        // Create custom room
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        setGameState('waiting');

        const newMatchDoc = doc(collection(db, 'compete_matches'));
        const durationMins = overallDurationMins;

        const matchPayload = {
          id: newMatchDoc.id,
          courseId: selectedCourse.id,
          courseCode: selectedCourse.code,
          type: 'custom_room',
          gameMode: 'points_grab',
          duration: durationMins,
          durationSeconds: durationMins * 60,
          numQuestions: customNumQuestions,
          status: 'waiting',
          creatorId: user.uid,
          creatorUsername: profile?.username || user.email || 'Student User',
          creatorPhotoURL: profile?.photoURL || '',
          roomCode,
          opponentId: null,
          opponentUsername: null,
          questions: selectedQuestions,
          creatorPoints: 0,
          opponentPoints: 0,
          creatorAnswers: {},
          opponentAnswers: {},
          finishGraceTime: null,
          firstFinishedUserId: null,
          createdAt: Date.now(),
          lastHeartbeat: Date.now(),
          At: profile?.At || 'futo',
        };
        await setDoc(newMatchDoc, matchPayload);
        setCurrentMatch(matchPayload);
      }
    } catch (err: any) {
      console.error('Setup lobbymaking failed:', err);
      Alert.alert('Arena Setup Error', err?.message || 'Could not start arena match. Please check your internet connection and try again.');
      setGameState('selecting_lobby_type');
    }
  };

  const handleJoinCustomRoom = async () => {
    if (!joinRoomCode.trim() || !user) {
      Alert.alert('Empty Code', 'Please input a valid 5-character Code');
      return;
    }
    const cleanCode = joinRoomCode.replace(/\s+/g, '').toUpperCase();

    try {
      const qLobbies = query(
        collection(db, 'compete_matches'),
        where('roomCode', '==', cleanCode),
        where('status', '==', 'waiting')
      );
      const snap = await getDocs(qLobbies);

      if (snap.empty) {
        Alert.alert('Not Found', 'Could not locate any active waiting match with that key! Please check typo and try again.');
        return;
      }

      const matchDoc = snap.docs[0];
      const matchData = matchDoc.data();

      if (matchData.kickedList?.includes(user.uid)) {
        Alert.alert('Access Denied', 'You have been removed from this private room by the host and cannot rejoin.');
        return;
      }

      if (matchData.creatorId === user.uid) {
        Alert.alert('Error', 'You cannot join your own custom room as the opponent.');
        return;
      }

      if (matchData.opponentId && matchData.opponentId !== user.uid) {
        Alert.alert('Room Full', 'This room is already full with another opponent.');
        return;
      }

      // Join the 1v1 room as opponent, keep status: 'waiting' so host can see who joined!
      await updateDoc(doc(db, 'compete_matches', matchDoc.id), {
        opponentId: user.uid,
        opponentUsername: profile?.username || user.email || 'Student User',
        opponentPhotoURL: profile?.photoURL || '',
      });

      setCurrentMatch({
        id: matchDoc.id,
        ...matchData,
        opponentId: user.uid,
        opponentUsername: profile?.username || user.email || 'Student User',
        opponentPhotoURL: profile?.photoURL || '',
        status: 'waiting',
      });
      setGameState('waiting');
      Alert.alert('Joined Private Room', 'Joined! Waiting for the host to start the match...');
    } catch (err) {
      console.error('Join custom room failed:', err);
    }
  };

  const handleKickPlayer = async (targetUid: string, targetUsername: string) => {
    if (!currentMatch || !user || user.uid !== currentMatch.creatorId) return;

    Alert.alert(
      'Remove Player',
      `Are you sure you want to remove ${targetUsername || 'this player'} from the room?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'compete_matches', currentMatch.id), {
                opponentId: null,
                opponentUsername: null,
                opponentPhotoURL: null,
                kickedList: arrayUnion(targetUid),
              });
              Alert.alert('Player Removed', `${targetUsername || 'Player'} was removed from the room.`);
            } catch (err) {
              console.error('Kick player failed:', err);
              Alert.alert('Error', 'Failed to remove player from room.');
            }
          },
        },
      ]
    );
  };

  const handleHostStartMatch = async () => {
    if (!currentMatch || !user || user.uid !== currentMatch.creatorId) return;
    if (!currentMatch.opponentId) {
      Alert.alert('Waiting for Opponent', 'Waiting for an opponent to join before starting!');
      return;
    }

    try {
      await updateDoc(doc(db, 'compete_matches', currentMatch.id), {
        status: 'active',
        startTime: Date.now(),
      });
    } catch (err) {
      console.error('Host start match error:', err);
    }
  };

  const handleToggleVoteStart = async () => {
    if (!currentMatch || !user) return;
    const currentVoted = !!currentMatch.players?.[user.uid]?.votedToStart;
    const nextVoted = !currentVoted;

    const playersList: any[] = Object.values(currentMatch.players || {});
    const totalCount = playersList.length;
    const votedCount = playersList.filter((p) => (p.uid === user.uid ? nextVoted : p.votedToStart)).length;

    const shouldStart = totalCount >= 2 && votedCount > Math.floor(totalCount / 2);

    try {
      await updateDoc(doc(db, 'compete_matches', currentMatch.id), {
        [`players.${user.uid}.votedToStart`]: nextVoted,
        ...(shouldStart ? { status: 'active', startTime: Date.now() } : {}),
      });
      if (shouldStart) {
        Alert.alert('Majority Reached', 'Majority votes reached! Starting match...');
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const handleSelectOption = (option: string) => {
    if (hasSubmittedAnswer) return;
    setSelectedOption(option);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedOption || hasSubmittedAnswer || !currentMatch) return;
    setHasSubmittedAnswer(true);

    const currentQuestion = matchQuestions[activeQuestionIndex];
    const isCorrect = selectedOption === currentQuestion.correctAnswer;

    const isCreator = user?.uid === currentMatch.creatorId;
    const opponentAnswers = isCreator ? currentMatch.opponentAnswers : currentMatch.creatorAnswers;
    const qId = currentQuestion.id || `q_${activeQuestionIndex}`;

    // Speed bonus calculation
    const hasOpponentAnswered = opponentAnswers && opponentAnswers[qId];
    let pointsAwarded = 0;
    let speedBonus = false;

    if (isCorrect) {
      pointsAwarded = 1;
      if (!hasOpponentAnswered) {
        pointsAwarded += 1; // +1 Speed bonus
        speedBonus = true;
      }
    }

    const timeSpentOnQuestion = Math.round((Date.now() - questionStartTime) / 1000);
    setUserStats((prev) => ({
      ...prev,
      timeTaken: prev.timeTaken + timeSpentOnQuestion,
      answersLog: [...prev.answersLog, { isCorrect, time: timeSpentOnQuestion, speedBonus }],
    }));

    try {
      const fieldKey = isCreator ? 'creatorAnswers' : 'opponentAnswers';
      const pointsKey = isCreator ? 'creatorPoints' : 'opponentPoints';

      await updateDoc(doc(db, 'compete_matches', currentMatch.id), {
        [`${fieldKey}.${qId}`]: {
          selectedAnswer: selectedOption,
          isCorrect,
          answeredAt: Date.now(),
          opponentAnsweredBefore: !!hasOpponentAnswered,
          pointsAwarded,
        },
        [pointsKey]: increment(pointsAwarded),
      });

      // Show tiny feedback alert or inline indicator
      setTimeout(async () => {
        if (activeQuestionIndex + 1 < matchQuestions.length) {
          setActiveQuestionIndex((prev) => prev + 1);
          setSelectedOption(null);
          setHasSubmittedAnswer(false);
          setQuestionStartTime(Date.now());
        } else {
          // Finished all questions
          const isCreatorNow = user?.uid === currentMatch.creatorId;
          const currentOpponentAnswers = isCreatorNow ? currentMatch.opponentAnswers : currentMatch.creatorAnswers;
          const qCount = matchQuestions.length;
          const opAnswerCount = Object.keys(currentOpponentAnswers || {}).length;

          if (opAnswerCount < qCount) {
            if (!currentMatch.finishGraceTime) {
              try {
                await updateDoc(doc(db, 'compete_matches', currentMatch.id), {
                  finishGraceTime: Date.now() + 180000, // 3 minutes grace countdown
                  firstFinishedUserId: user?.uid,
                });
                Alert.alert('Finshed!', 'You finished first! Your opponent is now on a 3-minute grace timer! 🔥');
              } catch (e) {
                console.error('Grace clock setup failed:', e);
              }
            }
          }
        }
      }, 1500);
    } catch (err) {
      console.error('Answer submission failed:', err);
    }
  };

  const concludeMatch = async (matchObj: any) => {
    if (!matchObj) return;
    try {
      const isCreator = user?.uid === matchObj.creatorId;
      const creatorPoints = matchObj.creatorPoints || 0;
      const opponentPoints = matchObj.opponentPoints || 0;

      let winnerId = 'draw';
      if (creatorPoints > opponentPoints) {
        winnerId = matchObj.creatorId;
      } else if (opponentPoints > creatorPoints) {
        winnerId = matchObj.opponentId;
      }

      await updateDoc(doc(db, 'compete_matches', matchObj.id), {
        status: 'completed',
        winnerId,
        endTime: Date.now(),
      });

      // Quick match star adjustments in an active season
      if (matchObj.type === 'quick_match' && activeSeasonId && winnerId !== 'draw') {
        const otherPlayerId = isCreator ? matchObj.opponentId : matchObj.creatorId;

        if (otherPlayerId && otherPlayerId !== 'bot_colearn') {
          // Winner gets +1 star
          const winLeaderDoc = doc(db, 'seasons', activeSeasonId, 'leaderboard', winnerId);
          const wSnap = await getDoc(winLeaderDoc);
          if (wSnap.exists()) {
            await updateDoc(winLeaderDoc, {
              stars: increment(1),
              updatedAt: serverTimestamp(),
            });
          } else {
            // Setup record
            const isWinnerCreator = winnerId === matchObj.creatorId;
            const winnerUsername = isWinnerCreator ? matchObj.creatorUsername : matchObj.opponentUsername;
            const winnerPhoto = isWinnerCreator ? matchObj.creatorPhotoURL : matchObj.opponentPhotoURL;
            await setDoc(winLeaderDoc, {
              userId: winnerId,
              username: winnerUsername || 'Classmate',
              photoURL: winnerPhoto || '',
              favoriteCourse: matchObj.courseCode || 'GENERAL',
              stars: 1,
              updatedAt: serverTimestamp(),
            });
          }

          // Loser gets -1 star
          const loserId = winnerId === matchObj.creatorId ? matchObj.opponentId : matchObj.creatorId;
          const loseLeaderDoc = doc(db, 'seasons', activeSeasonId, 'leaderboard', loserId);
          const lSnap = await getDoc(loseLeaderDoc);
          if (lSnap.exists()) {
            const currentStars = lSnap.data().stars || 0;
            const newStars = Math.max(0, currentStars - 1);
            await updateDoc(loseLeaderDoc, {
              stars: newStars,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      setGameState('results');
    } catch (err) {
      console.error('Match conclusion error:', err);
    }
  };

  const handleForfeit = async () => {
    if (!currentMatch || !user) return;

    Alert.alert(
      'Forfeit Match?',
      'Are you sure you want to forfeit? Doing so will end the match immediately as a loss!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forfeit',
          style: 'destructive',
          onPress: async () => {
            try {
              const matchDocRef = doc(db, 'compete_matches', currentMatch.id);
              const isCreator = user.uid === currentMatch.creatorId;
              const forfeiterId = user.uid;
              const remainingUserId = isCreator ? currentMatch.opponentId : currentMatch.creatorId;

              await updateDoc(matchDocRef, {
                status: 'completed',
                winnerId: remainingUserId || 'none',
                forfeitedBy: forfeiterId,
                endTime: Date.now(),
              });

              // Apply Quick Match penalties if applicable
              if (currentMatch.type === 'quick_match' && activeSeasonId && remainingUserId && remainingUserId !== 'bot_colearn') {
                const timeSpent = (Date.now() - (currentMatch.startTime || currentMatch.createdAt)) / 1000;
                const remainingAnswersKey = isCreator ? (currentMatch.opponentAnswers || {}) : (currentMatch.creatorAnswers || {});
                const totalQuestions = currentMatch.questions?.length || 10;
                const correctCount = Object.values(remainingAnswersKey).filter((ans: any) => ans.isCorrect).length;
                const is25PercentCorrect = correctCount / totalQuestions >= 0.25;

                // Adjust stars if matches lasted more than 5 mins and winner performed rationally
                if (timeSpent > 300 && is25PercentCorrect) {
                  const forfeiterLeaderDoc = doc(db, 'seasons', activeSeasonId, 'leaderboard', forfeiterId);
                  const fSnap = await getDoc(forfeiterLeaderDoc);
                  if (fSnap.exists()) {
                    const currentStars = fSnap.data().stars || 0;
                    const newStars = Math.max(0, currentStars - 1);
                    await updateDoc(forfeiterLeaderDoc, {
                      stars: newStars,
                      updatedAt: serverTimestamp(),
                    });
                  }

                  const remainingLeaderDoc = doc(db, 'seasons', activeSeasonId, 'leaderboard', remainingUserId);
                  const rSnap = await getDoc(remainingLeaderDoc);
                  if (rSnap.exists()) {
                    await updateDoc(remainingLeaderDoc, {
                      stars: increment(1),
                      updatedAt: serverTimestamp(),
                    });
                  } else {
                    const remainingUsername = isCreator ? currentMatch.opponentUsername : currentMatch.creatorUsername;
                    const remainingPhoto = isCreator ? currentMatch.opponentPhotoURL : currentMatch.creatorPhotoURL;
                    await setDoc(remainingLeaderDoc, {
                      userId: remainingUserId,
                      username: remainingUsername || 'Anonymous User',
                      photoURL: remainingPhoto || '',
                      favoriteCourse: currentMatch.courseCode || 'GENERAL',
                      stars: 1,
                      updatedAt: serverTimestamp(),
                    });
                  }
                  Alert.alert('Stars Adjusted', 'Forfeit complete. A star was deducted from the forfeiter and awarded to the winner.');
                }
              }

              setGameState('results');
            } catch (err) {
              console.error('Forfeit error:', err);
            }
          },
        },
      ]
    );
  };

  // Helper to cleanly cancel a waiting lobby in Firestore to eliminate ghost matching
  const cancelWaitingMatch = async (matchId?: string) => {
    const targetMatch = currentMatch;
    const targetId = matchId || targetMatch?.id;
    if (!targetId || !user) return;
    try {
      if (user.uid === targetMatch?.creatorId) {
        await updateDoc(doc(db, 'compete_matches', targetId), {
          status: 'cancelled',
          cancelledAt: Date.now(),
        });
      } else if (user.uid === targetMatch?.opponentId) {
        await updateDoc(doc(db, 'compete_matches', targetId), {
          opponentId: null,
          opponentUsername: null,
          opponentPhotoURL: null,
        });
      }
    } catch (e) {
      console.log('Cancel waiting match error:', e);
    }
  };

  const handleExitMatch = async () => {
    if (gameState === 'waiting' && currentMatch?.id) {
      await cancelWaitingMatch();
    }
    setGameState('lobby');
    setCurrentMatch(null);
    setMatchQuestions([]);
    setActiveQuestionIndex(0);
    setSelectedOption(null);
    setHasSubmittedAnswer(false);
    setSelectedCourse(null);
    setLobbyType(null);
    setUserStats({ timeTaken: 0, answersLog: [] });
  };

  const copyRoomCodeToClipboard = () => {
    if (!currentMatch?.roomCode) return;
    Clipboard.setString(currentMatch.roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Back handling across steps
  const handleBackEvent = () => {
    if (gameState === 'selecting_course') {
      setGameState('lobby');
    } else if (gameState === 'selecting_lobby_type') {
      setGameState('selecting_course');
    } else if (gameState === 'waiting') {
      // Cleanly cancel waiting room in Firestore
      cancelWaitingMatch();
      setGameState('selecting_lobby_type');
      setCurrentMatch(null);
    } else if (gameState === 'playing') {
      Alert.alert('Unable to exit', 'You cannot exit an active match! Use forfeit instead.');
    } else if (gameState === 'results') {
      handleExitMatch();
    } else {
      router.push('/dashboard');
    }
  };

  const formatSecsToMins = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
  };

  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';

  if (isUnactivatedStudent) {
    return (
      <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
        {/* Simple Header */}
        <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.push('/dashboard')} activeOpacity={0.7} style={s.iconBtn}>
            <View style={[s.backArrow, { backgroundColor: C.ink }]} />
            <View style={[s.backArrowHead, { borderColor: C.ink }]} />
          </TouchableOpacity>
          <Text style={[s.headerBrand, { color: C.ink, flex: 1, textAlign: 'center', marginRight: 36 }]}>
            COLEARN COMPETE
          </Text>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 60 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
            <Text style={{ fontSize: 40 }}>🏆</Text>
          </View>
          <Text style={{ fontFamily: F.bold, fontSize: 24, color: C.ink, textAlign: 'center', marginBottom: 12 }}>
            CoLearn Compete Locked
          </Text>
          <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.inkMid, textAlign: 'center', lineHeight: 22, marginBottom: 32, maxWidth: 320 }}>
            CoLearn Compete is a premium feature reserved for activated accounts. Activate your student profile using an activation pin to join live matches, compete with peers, and top the season leaderboards!
          </Text>

          <TouchableOpacity
            style={{ width: '100%', height: 56, backgroundColor: C.ink, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.bg }}>ACTIVATE ACCOUNT</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ width: '100%', height: 56, borderWidth: 1, borderColor: C.border, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.8}
          >
            <Text style={{ fontFamily: F.bold, fontSize: 16, color: C.inkMid }}>BACK TO DASHBOARD</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      {/* Dynamic Header */}
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={handleBackEvent} activeOpacity={0.7} style={s.iconBtn}>
          <View style={[s.backArrow, { backgroundColor: C.ink }]} />
          <View style={[s.backArrowHead, { borderColor: C.ink }]} />
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink }]}>COLEARN COMPETE</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* LOBBY STATE */}
          {gameState === 'lobby' && (
            <View style={s.lobbyContainer}>
              <View style={[s.seasonCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[s.seasonTitle, { color: C.ink }]}>
                  🏆 {activeSeasonName || 'Unpublished Season'}
                </Text>
                <Text style={[s.seasonSub, { color: C.inkMid }]}>
                  Gather stars on Quick Matches. Top students earn real-time academy titles.
                </Text>

                <View style={s.starsRow}>
                  <View style={[s.starCell, { backgroundColor: C.bgAlt }]}>
                    <Text style={[s.starLabel, { color: C.inkLight }]}>RANKING</Text>
                    <Text style={[s.starValueTitle, { color: C.ink, fontFamily: F.bold }]}>
                      #{userRank}
                    </Text>
                  </View>
                  <View style={[s.starCell, { backgroundColor: C.bgAlt }]}>
                    <Text style={[s.starLabel, { color: C.inkLight }]}>STARS</Text>
                    <Text style={[s.starValueTitle, { color: C.gold, fontFamily: F.bold }]}>
                      ★ {leaderboard.find((l) => l.id === user?.uid)?.stars || 0}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: C.surfaceDark }]}
                  onPress={() => setGameState('selecting_course')}
                  activeOpacity={0.8}
                >
                  <Text style={[s.primaryBtnText, { color: C.bg }]}>Enter Competition Arena</Text>
                </TouchableOpacity>
              </View>

              {/* Leaderboard Table */}
              <View style={[s.sectionHeaderWrap, { marginTop: 12 }]}>
                <Text style={[s.sectionHeader, { color: C.ink }]}>Leaderboard Standing</Text>
                <Text style={[s.sectionSubtext, { color: C.inkLight }]}>
                  Live student performance in {activeSeasonName || 'CoLearn'}
                </Text>
              </View>

              {loadingLeaderboard ? (
                <ActivityIndicator size="small" color={C.ink} style={{ marginTop: 24 }} />
              ) : leaderboard.length === 0 ? (
                <View style={[s.emptyBoard, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={{ fontFamily: F.medium, color: C.inkLight, fontSize: 13 }}>No student ranking active currently.</Text>
                </View>
              ) : (
                <View style={[s.boardList, { backgroundColor: C.surface, borderColor: C.border }]}>
                  {leaderboard.map((item, index) => {
                    const isMe = item.id === user?.uid;
                    return (
                      <View
                        key={item.id}
                        style={[
                          s.boardItem,
                          { borderBottomColor: C.border },
                          isMe && { backgroundColor: C.bgAlt },
                        ]}
                      >
                        <View style={s.boardNumWrap}>
                          <Text
                            style={[
                              s.boardIndex,
                              { color: index === 0 ? C.gold : index === 1 ? '#95A5A6' : index === 2 ? '#D35400' : C.inkMid },
                            ]}
                          >
                            {index + 1}
                          </Text>
                        </View>
                        <View style={s.boardMediaWrap}>
                          <Text style={[s.boardName, { color: C.ink }]}>
                            {item.username || 'Student User'} {isMe && '(You)'}
                          </Text>
                          <Text style={[s.boardFavCourse, { color: C.inkLight }]}>
                            FAVORITE: {item.favoriteCourse || 'GEN'}
                          </Text>
                        </View>
                        <Text style={[s.boardStars, { color: C.gold }]}>★ {item.stars || 0}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* SELECTING COURSE STATE */}
          {gameState === 'selecting_course' && (
            <View style={s.subSectionContainer}>
              <Text style={[s.subTitle, { color: C.ink }]}>Select syllabus course</Text>
              <Text style={[s.subDesc, { color: C.inkMid }]}>
                Choose a course module to find lobbies or custom competitive sessions.
              </Text>

              {loadingCourses ? (
                <ActivityIndicator size="small" color={C.ink} />
              ) : courses.length === 0 ? (
                <Text style={{ fontFamily: F.body, color: C.inkLight, fontSize: 14 }}>
                  No courses found for this semester.
                </Text>
              ) : (
                <View style={s.coursesGrid}>
                  {courses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={[s.courseGridOption, { backgroundColor: C.surface, borderColor: C.border }]}
                      onPress={() => {
                        setSelectedCourse(course);
                        setGameState('selecting_lobby_type');
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={[s.courseCodeBox, { backgroundColor: C.bgAlt }]}>
                        <Text style={[s.courseCodeText, { color: C.ink }]}>{course.code}</Text>
                      </View>
                      <Text style={[s.courseTitleText, { color: C.ink }]} numberOfLines={2}>
                        {course.title}
                      </Text>
                      {/* Strictly no levels shown as per user's prompt boundary */}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* SELECTING LOBBY TYPE STATE */}
          {gameState === 'selecting_lobby_type' && selectedCourse && (
            <View style={s.lobbyConfigContainer}>
              <View style={[s.courseSelectedBanner, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={{ fontFamily: F.bold, color: C.inkLight, fontSize: 11, letterSpacing: 1.5 }}>
                  SELECTED COURSE
                </Text>
                <Text style={{ fontFamily: F.bold, color: C.ink, fontSize: 18, marginTop: 4 }}>
                  {selectedCourse.code}: {selectedCourse.title}
                </Text>
              </View>

              {/* Quick matchmaking choice */}
              <View style={[s.choiceCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[s.choiceCardTitle, { color: C.ink }]}>🎮 Points Grab Quick Match</Text>
                <Text style={[s.choiceCardDesc, { color: C.inkMid }]}>
                  Paired in real-time with available students. Star adjustments are active.
                </Text>

                <Text style={[s.choiceConfigLabel, { color: C.inkLight }]}>
                  QUESTION LIMIT
                </Text>
                <View style={s.questionsCountTriggerRow}>
                  {([10, 20, 30] as const).map((count) => (
                    <TouchableOpacity
                      key={count}
                      style={[
                        s.countBtn,
                        { borderColor: C.border, backgroundColor: C.bgAlt },
                        selectedNumQuestions === count && { backgroundColor: C.surfaceDark, borderColor: C.surfaceDark },
                      ]}
                      onPress={() => setSelectedNumQuestions(count)}
                    >
                      <Text
                        style={[
                          s.countBtnText,
                          { color: C.ink },
                          selectedNumQuestions === count && { color: C.bg, fontFamily: F.bold },
                        ]}
                      >
                        {count} questions
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[s.primaryBtn, { backgroundColor: C.surfaceDark }]}
                  onPress={() => {
                    setLobbyType('quick');
                    handleStartLobbymaking('quick');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.primaryBtnText, { color: C.bg }]}>
                    Find Match ({selectedNumQuestions} Qs)
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Private Custom Arena */}
              <View style={[s.choiceCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[s.choiceCardTitle, { color: C.ink }]}>🔒 Private Custom Room</Text>
                <Text style={[s.choiceCardDesc, { color: C.inkMid }]}>
                  Create or enter a custom key with colleagues. Star mechanics are disabled.
                </Text>

                <View style={[s.divider, { backgroundColor: C.border }]} />

                <View style={{ gap: 4, marginBottom: 8 }}>
                  <Text style={[s.choiceConfigLabel, { color: C.inkLight }]}>
                    CREATE: QUESTION LIMIT
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    style={[s.textInput, { backgroundColor: C.bgAlt, color: C.ink, borderColor: C.border }]}
                    value={String(customNumQuestions)}
                    onChangeText={(val) => {
                      const parsed = parseInt(val, 10);
                      setCustomNumQuestions(isNaN(parsed) ? 10 : parsed);
                    }}
                  />
                </View>

                <TouchableOpacity
                  style={[s.secondaryBtn, { borderColor: C.ink }]}
                  onPress={() => {
                    setLobbyType('create');
                    handleStartLobbymaking('create');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.secondaryBtnText, { color: C.ink }]}>
                    Create Match Room
                  </Text>
                </TouchableOpacity>

                <View style={[s.divider, { backgroundColor: C.border }]} />

                <Text style={[s.choiceConfigLabel, { color: C.inkLight }]}>
                  JOIN: ENTRY MATCH CODE
                </Text>
                <TextInput
                  placeholder="EX. AH48S"
                  placeholderTextColor={C.inkLight}
                  style={[s.textInput, { backgroundColor: C.bgAlt, color: C.ink, borderColor: C.border, fontFamily: F.bold }]}
                  maxLength={10}
                  value={joinRoomCode}
                  onChangeText={setJoinRoomCode}
                />

                <TouchableOpacity
                  style={[s.secondaryBtn, { borderColor: C.ink }]}
                  onPress={() => {
                    setLobbyType('join');
                    handleJoinCustomRoom();
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.secondaryBtnText, { color: C.ink }]}>Join Match Room</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* WAITING STATE */}
          {gameState === 'waiting' && !currentMatch && (
            <View style={s.waitingStateContainer}>
              <View style={[s.waitingCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <ActivityIndicator size="large" color={C.ink} />
                <Text style={[s.waitingTitle, { color: C.ink }]}>
                  Connecting to Arena...
                </Text>
                <Text style={[s.waitingSub, { color: C.inkMid }]}>
                  Preparing match lobby for {selectedCourse?.code || 'your course'}...
                </Text>
              </View>
            </View>
          )}

          {gameState === 'waiting' && currentMatch && (
            <View style={s.waitingStateContainer}>
              <View style={[s.waitingCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <ActivityIndicator size="large" color={C.ink} />
                <Text style={[s.waitingTitle, { color: C.ink }]}>
                  {currentMatch.type === 'quick_match'
                    ? 'Acquiring Arena Matchmate...'
                    : 'Setting Up Custom Lounge...'}
                </Text>
                <Text style={[s.waitingSub, { color: C.inkMid }]}>
                  {currentMatch.type === 'quick_match'
                    ? `Matching for ${selectedCourse?.code || 'course'}. CoLearn bot activates in ${searchCountdown}s.`
                    : 'Give this 5-character match code to a classmate in this class.'}
                </Text>

                {/* CUSTOM ROOM CODE WITH COPY BUTTON */}
                {currentMatch.type === 'custom_room' && (
                  <View style={s.customRoomCodeWrap}>
                    <Text style={[s.customRoomCode, { color: C.ink }]}>
                      {currentMatch.roomCode}
                    </Text>
                    <TouchableOpacity
                      onPress={copyRoomCodeToClipboard}
                      style={[s.copyBtn, { backgroundColor: C.surfaceDark }]}
                    >
                      <Text style={{ color: C.bg, fontFamily: F.bold, fontSize: 12 }}>
                        {copiedCode ? 'Copied' : 'Copy Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* --- 1V1 ROOM PLAYERS ROSTER --- */}
                {(() => {
                  const isHost = user?.uid === currentMatch.creatorId;
                  const isPrivateRoom = currentMatch.type === 'custom_room';
                  const hasOpponent = !!currentMatch.opponentId;

                  return (
                    <View style={{ width: '100%', marginTop: 16, gap: 10 }}>
                      <Text style={{ fontFamily: F.bold, fontSize: 12, color: C.ink, letterSpacing: 0.5 }}>
                        👥 MATCH PARTICIPANTS (1v1)
                      </Text>

                      {/* Host slot */}
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: isHost ? C.bgAlt : C.surface,
                          borderWidth: 1,
                          borderColor: isHost ? C.ink : C.border,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              backgroundColor: C.surfaceDark,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.bg }}>
                              {(currentMatch.creatorUsername || 'H')[0]?.toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>
                                {currentMatch.creatorUsername || 'Host'}
                              </Text>
                              {isHost && (
                                <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.inkMid }}>
                                  (You)
                                </Text>
                              )}
                            </View>
                            <Text style={{ fontFamily: F.bold, fontSize: 10, color: '#D97706', marginTop: 2 }}>
                              👑 HOST • READY
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Opponent slot */}
                      {hasOpponent ? (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: 12,
                            borderRadius: 12,
                            backgroundColor: !isHost ? C.bgAlt : C.surface,
                            borderWidth: 1,
                            borderColor: !isHost ? C.ink : C.border,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <View
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: C.border,
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.ink }}>
                                {(currentMatch.opponentUsername || 'O')[0]?.toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontFamily: F.bold, fontSize: 13, color: C.ink }}>
                                  {currentMatch.opponentUsername || 'Classmate'}
                                </Text>
                                {!isHost && (
                                  <Text style={{ fontFamily: F.bold, fontSize: 11, color: C.inkMid }}>
                                    (You)
                                  </Text>
                                )}
                              </View>
                              <Text style={{ fontFamily: F.bold, fontSize: 10, color: '#27AE60', marginTop: 2 }}>
                                ⚔️ READY TO BATTLE
                              </Text>
                            </View>
                          </View>

                          {/* Kick opponent button (host in private room only) */}
                          {isHost && isPrivateRoom && (
                            <TouchableOpacity
                              onPress={() => handleKickPlayer(currentMatch.opponentId, currentMatch.opponentUsername)}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: '#FADBD8',
                                borderWidth: 1,
                                borderColor: '#E74C3C',
                              }}
                            >
                              <Text style={{ fontFamily: F.bold, fontSize: 11, color: '#C0392B' }}>
                                Kick
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ) : (
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: C.border,
                            borderStyle: 'dashed',
                            gap: 10,
                          }}
                        >
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              backgroundColor: C.bgAlt,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontFamily: F.bold, fontSize: 14, color: C.inkLight }}>⏳</Text>
                          </View>
                          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.inkLight }}>
                            Waiting for classmate to enter code...
                          </Text>
                        </View>
                      )}

                      {/* Host Start 1v1 Button */}
                      {isHost && (
                        <TouchableOpacity
                          style={[
                            s.primaryBtn,
                            { backgroundColor: C.surfaceDark, opacity: hasOpponent ? 1 : 0.5, marginTop: 6 },
                          ]}
                          onPress={handleHostStartMatch}
                          disabled={!hasOpponent}
                          activeOpacity={0.8}
                        >
                          <Text style={[s.primaryBtnText, { color: C.bg }]}>
                            {hasOpponent ? 'Start 1v1 Match ⚔️' : 'Waiting for Opponent...'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {!isHost && hasOpponent && (
                        <View style={{ padding: 10, borderRadius: 8, backgroundColor: C.bgAlt, alignItems: 'center' }}>
                          <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.inkMid }}>
                            Waiting for the host to start the match...
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}

                <TouchableOpacity
                  style={[s.forfeitBtn, { marginTop: 24 }]}
                  onPress={handleExitMatch}
                >
                  <Text style={{ color: C.error, fontFamily: F.bold, fontSize: 13 }}>
                    Cancel & Quit Match
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* PLAYING ARENA STATE */}
          {gameState === 'playing' && currentMatch && matchQuestions.length === 0 && (
            <View style={s.waitingStateContainer}>
              <View style={[s.waitingCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <ActivityIndicator size="large" color={C.ink} />
                <Text style={[s.waitingTitle, { color: C.ink }]}>
                  Loading Questions...
                </Text>
                <Text style={[s.waitingSub, { color: C.inkMid }]}>
                  Setting up match questions...
                </Text>
              </View>
            </View>
          )}

          {gameState === 'playing' && currentMatch && matchQuestions.length > 0 && (
            <View style={s.playingSectionContainer}>
              {/* Active Match top cells */}
              <View style={[s.matchHeaderBox, { backgroundColor: C.surface, borderColor: C.border }]}>
                <View style={s.matchProfileScoreCell}>
                  <Text style={[s.playerName, { color: C.ink }]}>
                    {currentMatch.creatorUsername || 'Host'}
                  </Text>
                  <Text style={[s.playerScoreVal, { color: C.ink, fontFamily: F.bold }]}>
                    {currentMatch.creatorPoints || 0} pts
                  </Text>
                </View>

                {/* Clock indicator */}
                <View style={s.matchCenterClockCell}>
                  <Text style={[s.timeLeftClock, { color: C.inkMid }]}>
                    {formatSecsToMins(timeLeft)}
                  </Text>
                  {currentMatch.finishGraceTime && (
                    <Text style={[s.graceTimerFlash, { color: C.error }]}>
                      Grace: {Math.max(0, Math.ceil((currentMatch.finishGraceTime - Date.now()) / 1000))}s
                    </Text>
                  )}
                </View>

                <View style={s.matchProfileScoreCell}>
                  <Text style={[s.playerName, { color: C.ink, textAlign: 'right' }]}>
                    {currentMatch.opponentUsername || 'Classmate'}
                  </Text>
                  <Text style={[s.playerScoreVal, { color: C.ink, textAlign: 'right', fontFamily: F.bold }]}>
                    {currentMatch.opponentPoints || 0} pts
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={[s.matchProgressBarBg, { backgroundColor: C.border }]}>
                <View
                  style={[
                    s.matchProgressBarFill,
                    {
                      backgroundColor: C.ink,
                      width: `${((activeQuestionIndex + 1) / matchQuestions.length) * 100}%`,
                    },
                  ]}
                />
              </View>

              {/* Match Question Card */}
              <View style={[s.questionCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                <Text style={[s.questionIndexLabel, { color: C.inkLight }]}>
                  QUESTION {activeQuestionIndex + 1} OF {matchQuestions.length}
                </Text>
                <MathText
                  text={matchQuestions[activeQuestionIndex]?.text || ''}
                  style={[s.questionText, { color: C.ink }]}
                />
              </View>

              {/* Option buttons */}
              <View style={s.optionsCol}>
                {matchQuestions[activeQuestionIndex]?.options?.map((option, index) => {
                  const isSelected = selectedOption === option;
                  const isCorrectAnswer = option === matchQuestions[activeQuestionIndex].correctAnswer;

                  let optionBg = C.surface;
                  let optionText = C.ink;
                  let borderCol = C.border;

                  if (hasSubmittedAnswer) {
                    if (isSelected) {
                      if (isCorrectAnswer) {
                        optionBg = '#E8F6EF';
                        optionText = '#27AE60';
                      } else {
                        optionBg = '#FADBD8';
                        optionText = '#C0392B';
                      }
                    } else if (isCorrectAnswer) {
                      optionBg = '#E8F6EF';
                      optionText = '#27AE60';
                    }
                  } else if (isSelected) {
                    optionBg = C.surfaceDark;
                    optionText = C.bg;
                    borderCol = C.surfaceDark;
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[s.optionBtn, { backgroundColor: optionBg, borderColor: borderCol }]}
                      onPress={() => handleSelectOption(option)}
                      disabled={hasSubmittedAnswer}
                      activeOpacity={0.8}
                    >
                      <MathText text={option} style={[s.optionBtnText, { color: optionText }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Submit triggers */}
              {!hasSubmittedAnswer ? (
                <TouchableOpacity
                  style={[
                    s.primaryBtn,
                    { backgroundColor: C.surfaceDark, opacity: selectedOption ? 1 : 0.5 },
                  ]}
                  onPress={handleSubmitAnswer}
                  disabled={!selectedOption}
                  activeOpacity={0.8}
                >
                  <Text style={[s.primaryBtnText, { color: C.bg }]}>Submit Selection</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.feedbackMsgBox, { backgroundColor: selectedOption === matchQuestions[activeQuestionIndex].correctAnswer ? '#E8F6EF' : '#FADBD8' }]}>
                  <Text style={{ fontFamily: F.bold, color: selectedOption === matchQuestions[activeQuestionIndex].correctAnswer ? '#27AE60' : '#C0392B', fontSize: 13, textAlign: 'center' }}>
                    {selectedOption === matchQuestions[activeQuestionIndex].correctAnswer ? 'Correct Answer! + Points' : 'Incorrect answer! Loaded.'}
                  </Text>
                </View>
              )}

              {/* Forfeit button */}
              <TouchableOpacity
                style={[s.forfeitBtn, { marginTop: 18 }]}
                onPress={handleForfeit}
                activeOpacity={0.8}
              >
                <Text style={{ color: C.error, fontFamily: F.bold, fontSize: 13 }}>Forfeit Match</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* RESULTS STATE */}
          {gameState === 'results' && currentMatch && (() => {
            const totalQuestionsCount = matchQuestions.length || userStats.answersLog.length;
            const correctCount = userStats.answersLog.filter(l => l.isCorrect).length;
            const accuracyPercent = totalQuestionsCount > 0 ? Math.round((correctCount / totalQuestionsCount) * 100) : 0;
            const speedBonusCount = userStats.answersLog.filter(l => l.speedBonus).length;
            const avgResponseTime = userStats.answersLog.length > 0 ? (userStats.timeTaken / userStats.answersLog.length).toFixed(1) : '0';

            return (
              <View style={s.resultsSectionContainer}>
                <View style={[s.resultsCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Text style={{ fontFamily: F.bold, color: C.inkLight, fontSize: 11, letterSpacing: 1.5, textAlign: 'center' }}>
                    MATCH CONCLUDED
                  </Text>

                  {/* Winner status */}
                  <Text style={[s.resultsTitle, { color: C.ink }]}>
                    {currentMatch.winnerId === 'draw'
                      ? '🤝 Match Tied!'
                      : currentMatch.winnerId === user?.uid
                      ? '🏆 You Triumphed!'
                      : '💔 Opponent Triumphed!'}
                  </Text>

                  {/* Score summary cells */}
                  <View style={s.resultsBlockBox}>
                    <View style={[s.resultsScoreCell, { backgroundColor: C.bgAlt }]}>
                      <Text style={{ fontFamily: F.body, color: C.inkLight, fontSize: 11 }}>YOURS</Text>
                      <Text style={{ fontFamily: F.bold, color: C.ink, fontSize: 24, marginTop: 4 }}>
                        {user?.uid === currentMatch.creatorId
                          ? currentMatch.creatorPoints
                          : currentMatch.opponentPoints}{' '}
                        pts
                      </Text>
                    </View>
                    <View style={[s.resultsScoreCell, { backgroundColor: C.bgAlt }]}>
                      <Text style={{ fontFamily: F.body, color: C.inkLight, fontSize: 11 }}>
                        OPPONENT'S
                      </Text>
                      <Text style={{ fontFamily: F.bold, color: C.ink, fontSize: 24, marginTop: 4 }}>
                        {user?.uid === currentMatch.creatorId
                          ? currentMatch.opponentPoints
                          : currentMatch.creatorPoints}{' '}
                        pts
                      </Text>
                    </View>
                  </View>

                  {/* Detailed Match Stats */}
                  <View style={{ gap: 8, marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 }}>
                    <Text style={{ fontFamily: F.bold, color: C.ink, fontSize: 13, letterSpacing: 0.5, marginBottom: 4 }}>
                      📊 YOUR MATCH PERFORMANCE
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: C.bgAlt, alignItems: 'center' }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.inkLight }}>ACCURACY</Text>
                        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, marginTop: 2 }}>
                          {correctCount}/{totalQuestionsCount} ({accuracyPercent}%)
                        </Text>
                      </View>

                      <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: C.bgAlt, alignItems: 'center' }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.inkLight }}>AVG TIME</Text>
                        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, marginTop: 2 }}>
                          {avgResponseTime}s
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: C.bgAlt, alignItems: 'center' }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.inkLight }}>TOTAL TIME</Text>
                        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, marginTop: 2 }}>
                          {formatSecsToMins(userStats.timeTaken)}
                        </Text>
                      </View>

                      <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: C.bgAlt, alignItems: 'center' }}>
                        <Text style={{ fontFamily: F.mono, fontSize: 10, color: C.inkLight }}>SPEED BONUSES</Text>
                        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.ink, marginTop: 2 }}>
                          ⚡ {speedBonusCount}
                        </Text>
                      </View>
                    </View>

                    {userStats.answersLog.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ fontFamily: F.bold, color: C.inkLight, fontSize: 10, marginBottom: 8, letterSpacing: 0.5 }}>
                          QUESTION-BY-QUESTION HISTOGRAM
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {userStats.answersLog.map((log, i) => (
                            <View
                              key={i}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 8,
                                backgroundColor: log.isCorrect ? '#E8F6EF' : '#FADBD8',
                                borderWidth: 1,
                                borderColor: log.isCorrect ? '#27AE60' : '#C0392B',
                              }}
                            >
                              <Text style={{ fontFamily: F.bold, color: log.isCorrect ? '#27AE60' : '#C0392B', fontSize: 10 }}>
                                Q{i + 1}: {log.isCorrect ? '✓' : '✗'} ({log.time}s){log.speedBonus ? ' ⚡' : ''}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>

                  {/* DETAILED QUESTION REVIEW & CORRECTIONS */}
                  {(() => {
                    const questionsList = currentMatch.questions || matchQuestions || [];
                    const isCreator = user?.uid === currentMatch.creatorId;
                    const myAnswers = isCreator ? (currentMatch.creatorAnswers || {}) : (currentMatch.opponentAnswers || {});
                    const opAnswers = isCreator ? (currentMatch.opponentAnswers || {}) : (currentMatch.creatorAnswers || {});

                    const mistakesCount = questionsList.filter((q: any, i: number) => {
                      const qId = q.id || `q_${i}`;
                      const ans = myAnswers[qId];
                      return !ans || !ans.isCorrect;
                    }).length;

                    const correctCount = questionsList.filter((q: any, i: number) => {
                      const qId = q.id || `q_${i}`;
                      const ans = myAnswers[qId];
                      return ans && ans.isCorrect;
                    }).length;

                    const filteredQuestions = questionsList.filter((q: any, idx: number) => {
                      const qId = q.id || `q_${idx}`;
                      const myAns = myAnswers[qId];
                      if (reviewFilter === 'mistakes') return !myAns || !myAns.isCorrect;
                      if (reviewFilter === 'correct') return myAns && myAns.isCorrect;
                      return true;
                    });

                    return (
                      <View style={{ marginTop: 18, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 }}>
                        <Text style={{ fontFamily: F.bold, color: C.ink, fontSize: 13, letterSpacing: 0.5, marginBottom: 4 }}>
                          📖 QUESTION REVIEW & CORRECTIONS
                        </Text>
                        <Text style={{ fontFamily: F.body, color: C.inkMid, fontSize: 11, marginBottom: 12, lineHeight: 16 }}>
                          Review each question from this match to examine what you got right or wrong and learn from your mistakes.
                        </Text>

                        {/* Filter Tabs */}
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                          <TouchableOpacity
                            onPress={() => setReviewFilter('all')}
                            style={{
                              flex: 1,
                              paddingVertical: 7,
                              borderRadius: 8,
                              alignItems: 'center',
                              backgroundColor: reviewFilter === 'all' ? C.surfaceDark : C.bgAlt,
                              borderWidth: 1,
                              borderColor: reviewFilter === 'all' ? C.surfaceDark : C.border,
                            }}
                          >
                            <Text style={{ fontFamily: F.bold, fontSize: 11, color: reviewFilter === 'all' ? C.bg : C.inkMid }}>
                              All ({questionsList.length})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setReviewFilter('mistakes')}
                            style={{
                              flex: 1,
                              paddingVertical: 7,
                              borderRadius: 8,
                              alignItems: 'center',
                              backgroundColor: reviewFilter === 'mistakes' ? '#FADBD8' : C.bgAlt,
                              borderWidth: 1,
                              borderColor: reviewFilter === 'mistakes' ? '#E74C3C' : C.border,
                            }}
                          >
                            <Text style={{ fontFamily: F.bold, fontSize: 11, color: reviewFilter === 'mistakes' ? '#C0392B' : C.inkMid }}>
                              Mistakes ({mistakesCount})
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => setReviewFilter('correct')}
                            style={{
                              flex: 1,
                              paddingVertical: 7,
                              borderRadius: 8,
                              alignItems: 'center',
                              backgroundColor: reviewFilter === 'correct' ? '#E8F6EF' : C.bgAlt,
                              borderWidth: 1,
                              borderColor: reviewFilter === 'correct' ? '#27AE60' : C.border,
                            }}
                          >
                            <Text style={{ fontFamily: F.bold, fontSize: 11, color: reviewFilter === 'correct' ? '#27AE60' : C.inkMid }}>
                              Correct ({correctCount})
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* Question list */}
                        {filteredQuestions.length === 0 ? (
                          <View style={{ padding: 20, alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 12 }}>
                            <Text style={{ fontFamily: F.medium, fontSize: 12, color: C.inkMid, textAlign: 'center' }}>
                              {reviewFilter === 'mistakes' ? '🎉 Brilliant! Zero mistakes in this duel!' : 'No questions match the selected filter.'}
                            </Text>
                          </View>
                        ) : (
                          filteredQuestions.map((q: any, filteredIdx: number) => {
                            const originalIdx = questionsList.findIndex((item: any) => (item.id || item.text) === (q.id || q.text));
                            const displayIdx = originalIdx >= 0 ? originalIdx : filteredIdx;
                            const qId = q.id || `q_${displayIdx}`;
                            const myAns = myAnswers[qId];
                            const opAns = opAnswers[qId];
                            const options = q.options || [q.correctAnswer, ...(q.incorrectAnswers || [])];

                            return (
                              <View
                                key={qId}
                                style={{
                                  padding: 14,
                                  borderRadius: 14,
                                  borderWidth: 1,
                                  borderColor: C.border,
                                  backgroundColor: C.bgAlt,
                                  marginBottom: 12,
                                }}
                              >
                                {/* Header badge row */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                  <Text style={{ fontFamily: F.mono, fontSize: 11, color: C.inkLight, fontWeight: 'bold' }}>
                                    QUESTION #{displayIdx + 1}
                                  </Text>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    {myAns ? (
                                      myAns.isCorrect ? (
                                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#E8F6EF', borderWidth: 1, borderColor: '#27AE60' }}>
                                          <Text style={{ fontFamily: F.bold, fontSize: 10, color: '#27AE60' }}>
                                            You: Correct ✓ {myAns.speedBonus ? '⚡' : ''}
                                          </Text>
                                        </View>
                                      ) : (
                                        <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FADBD8', borderWidth: 1, borderColor: '#C0392B' }}>
                                          <Text style={{ fontFamily: F.bold, fontSize: 10, color: '#C0392B' }}>
                                            You: Incorrect ✕
                                          </Text>
                                        </View>
                                      )
                                    ) : (
                                      <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: C.border }}>
                                        <Text style={{ fontFamily: F.medium, fontSize: 10, color: C.inkLight }}>Unanswered</Text>
                                      </View>
                                    )}

                                    {opAns && (
                                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
                                        <Text style={{ fontFamily: F.mono, fontSize: 9, color: opAns.isCorrect ? '#27AE60' : C.inkLight }}>
                                          Opp: {opAns.isCorrect ? '✓' : '✕'}
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                </View>

                                {/* Question text */}
                                <MathText
                                  text={q.text || q.q || ''}
                                  style={{ fontFamily: F.bold, fontSize: 13, color: C.ink, lineHeight: 20, marginBottom: 10 }}
                                />

                                {/* Options breakdown */}
                                <View style={{ gap: 6 }}>
                                  {options.map((option: string, optIdx: number) => {
                                    const isCorrectAnswer = option === q.correctAnswer;
                                    const isMyChoice = myAns?.selectedAnswer === option;
                                    const isOpChoice = opAns?.selectedAnswer === option;

                                    let optBg = C.surface;
                                    let optBorder = C.border;
                                    let textColor = C.ink;

                                    if (isCorrectAnswer) {
                                      optBg = '#E8F6EF';
                                      optBorder = '#27AE60';
                                      textColor = '#1E8449';
                                    } else if (isMyChoice && !isCorrectAnswer) {
                                      optBg = '#FADBD8';
                                      optBorder = '#C0392B';
                                      textColor = '#922B21';
                                    }

                                    return (
                                      <View
                                        key={optIdx}
                                        style={{
                                          flexDirection: 'row',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: 10,
                                          borderRadius: 10,
                                          borderWidth: 1,
                                          borderColor: optBorder,
                                          backgroundColor: optBg,
                                        }}
                                      >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 6 }}>
                                          <View
                                            style={{
                                              width: 22,
                                              height: 22,
                                              borderRadius: 11,
                                              backgroundColor: isCorrectAnswer ? '#27AE60' : isMyChoice ? '#C0392B' : C.border,
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                            }}
                                          >
                                            <Text style={{ fontFamily: F.bold, fontSize: 10, color: isCorrectAnswer || isMyChoice ? '#fff' : C.inkMid }}>
                                              {String.fromCharCode(65 + optIdx)}
                                            </Text>
                                          </View>
                                          <View style={{ flex: 1 }}>
                                            <MathText text={option} style={{ fontFamily: isCorrectAnswer ? F.bold : F.body, fontSize: 12, color: textColor }} />
                                          </View>
                                        </View>

                                        {/* Status badges for this option */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                          {isCorrectAnswer && (
                                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#27AE60' }}>
                                              <Text style={{ fontFamily: F.bold, fontSize: 9, color: '#fff' }}>✓ Correct</Text>
                                            </View>
                                          )}
                                          {isMyChoice && (
                                            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isCorrectAnswer ? '#1E8449' : '#C0392B' }}>
                                              <Text style={{ fontFamily: F.bold, fontSize: 9, color: '#fff' }}>
                                                {isCorrectAnswer ? 'You ✓' : 'You ✕'}
                                              </Text>
                                            </View>
                                          )}
                                          {isOpChoice && (
                                            <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: C.border }}>
                                              <Text style={{ fontFamily: F.mono, fontSize: 8, color: C.inkMid }}>Opponent</Text>
                                            </View>
                                          )}
                                        </View>
                                      </View>
                                    );
                                  })}
                                </View>

                                {/* Explanation */}
                                {q.explanation && (
                                  <View style={{ marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border }}>
                                    <Text style={{ fontFamily: F.bold, fontSize: 10, color: C.inkLight, marginBottom: 2 }}>
                                      💡 EXPLANATION
                                    </Text>
                                    <MathText text={q.explanation} style={{ fontFamily: F.body, fontSize: 11, color: C.inkMid, lineHeight: 16 }} />
                                  </View>
                                )}
                              </View>
                            );
                          })
                        )}
                      </View>
                    );
                  })()}

                  {currentMatch.type === 'quick_match' && activeSeasonId && (
                    <View style={[s.starNotice, { backgroundColor: C.bgAlt, marginTop: 4 }]}>
                      <Text style={{ fontFamily: F.medium, color: C.inkMid, fontSize: 12, textAlign: 'center' }}>
                        {currentMatch.winnerId === 'draw'
                          ? 'Draw: No star adjustments calculated.'
                          : currentMatch.winnerId === user?.uid
                          ? 'Victory! ★ +1 star added to Leaderboard.'
                          : 'Defeat. ★ -1 star decremented.'}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[s.primaryBtn, { backgroundColor: C.surfaceDark, marginTop: 24 }]}
                    onPress={handleExitMatch}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.primaryBtnText, { color: C.bg }]}>Back to Lounge</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
          {/* END OF RESULTS STATE */}
        </Animated.View>
      </ScrollView>

      <BottomNav active="cbt" />
    </SafeAreaView>
  );
}

const createStyles = (C: any, themeName: string) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 110, paddingTop: 16 },

    // Header structure
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    headerBrand: { fontFamily: F.bold, fontSize: 14, letterSpacing: 2 },
    iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    backArrow: { position: 'absolute', width: 16, height: 2, borderRadius: 1 },
    backArrowHead: {
      position: 'absolute',
      left: 8,
      width: 9,
      height: 9,
      borderLeftWidth: 2,
      borderBottomWidth: 2,
      transform: [{ rotate: '45deg' }],
    },

    lobbyContainer: { gap: 16 },
    seasonCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: 18,
      gap: 12,
    },
    seasonTitle: { fontFamily: F.bold, fontSize: 20 },
    seasonSub: { fontFamily: F.body, fontSize: 13, lineHeight: 18 },

    starsRow: { flexDirection: 'row', gap: 12 },
    starCell: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
    starLabel: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1 },
    starValueTitle: { fontSize: 18, marginTop: 2 },

    primaryBtn: {
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { fontFamily: F.bold, fontSize: 15 },

    secondaryBtn: {
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      marginTop: 8,
    },
    secondaryBtnText: { fontFamily: F.bold, fontSize: 14 },

    sectionHeaderWrap: { gap: 4 },
    sectionHeader: { fontFamily: F.bold, fontSize: 17 },
    sectionSubtext: { fontFamily: F.body, fontSize: 12 },

    emptyBoard: { padding: 32, alignItems: 'center', borderRadius: 14, borderWidth: 1 },

    boardList: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
    boardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
    },
    boardNumWrap: { width: 30 },
    boardIndex: { fontFamily: F.bold, fontSize: 14 },
    boardMediaWrap: { flex: 1 },
    boardName: { fontFamily: F.bold, fontSize: 14 },
    boardFavCourse: { fontFamily: F.mono || F.body, fontSize: 10, marginTop: 2 },
    boardStars: { fontFamily: F.bold, fontSize: 14 },

    subSectionContainer: { gap: 12 },
    subTitle: { fontFamily: F.bold, fontSize: 22 },
    subDesc: { fontFamily: F.body, fontSize: 14, leadingHeight: 20 },

    coursesGrid: { gap: 10 },
    courseGridOption: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    courseCodeBox: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    courseCodeText: { fontFamily: F.bold, fontSize: 13 },
    courseTitleText: { fontFamily: F.bold, fontSize: 14, flex: 1 },

    lobbyConfigContainer: { gap: 16 },
    courseSelectedBanner: { borderRadius: 14, borderWidth: 1, padding: 14 },
    choiceCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
    choiceCardTitle: { fontFamily: F.bold, fontSize: 16 },
    choiceCardDesc: { fontFamily: F.body, fontSize: 13, lineHeight: 18 },
    choiceConfigLabel: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1 },

    questionsCountTriggerRow: { flexDirection: 'row', gap: 10 },
    countBtn: { flex: 1, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
    countBtnText: { fontFamily: F.bold, fontSize: 12 },

    divider: { height: 1, marginVertical: 4 },
    textInput: { borderRadius: 10, borderWidth: 1, padding: 12, fontFamily: F.body, fontSize: 14 },

    waitingStateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 },
    waitingCard: {
      width: '100%',
      borderRadius: 18,
      borderWidth: 1,
      padding: 24,
      alignItems: 'center',
      gap: 14,
    },
    waitingTitle: { fontFamily: F.bold, fontSize: 18 },
    waitingSub: { fontFamily: F.body, fontSize: 13, textAlign: 'center', lineHeight: 18 },

    customRoomCodeWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: C.inkLight,
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
    },
    customRoomCode: { fontFamily: F.bold, fontSize: 26, letterSpacing: 4 },
    copyBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },

    forfeitBtn: { padding: 10, alignItems: 'center' },

    playingSectionContainer: { gap: 14 },
    matchHeaderBox: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    matchProfileScoreCell: { flex: 1, gap: 4 },
    playerName: { fontFamily: F.bold, fontSize: 12 },
    playerScoreVal: { fontSize: 15 },
    matchCenterClockCell: { alignItems: 'center', gap: 2, width: 80 },
    timeLeftClock: { fontFamily: F.bold, fontSize: 16 },
    graceTimerFlash: { fontFamily: F.bold, fontSize: 10 },

    matchProgressBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
    matchProgressBarFill: { height: '100%' },

    questionCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 8 },
    questionIndexLabel: { fontFamily: F.bold, fontSize: 9, letterSpacing: 1 },
    questionText: { fontFamily: F.bold, fontSize: 16, lineHeight: 22 },

    optionsCol: { gap: 10 },
    optionBtn: { borderRadius: 12, borderWidth: 1, padding: 14 },
    optionBtnText: { fontFamily: F.medium, fontSize: 14 },

    feedbackMsgBox: { borderRadius: 10, padding: 12 },

    resultsSectionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 12 },
    resultsCard: { width: '100%', borderRadius: 18, borderWidth: 1, padding: 24, gap: 14 },
    resultsTitle: { fontFamily: F.bold, fontSize: 24, textAlign: 'center' },
    resultsBlockBox: { flexDirection: 'row', gap: 12 },
    resultsScoreCell: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
    starNotice: { borderRadius: 10, padding: 10, alignItems: 'center' },
  });
