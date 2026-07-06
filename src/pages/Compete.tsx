import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Zap, 
  Users, 
  Lock, 
  BookOpen, 
  Award, 
  Timer, 
  Check, 
  X, 
  ChevronRight, 
  User, 
  PlusCircle, 
  RefreshCw, 
  Crown, 
  Clock, 
  ArrowLeft, 
  AlertCircle,
  HelpCircle,
  Copy
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { getFilteredCoursesForStudent } from '../lib/courseFilter';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit, 
  serverTimestamp,
  increment,
  writeBatch
} from 'firebase/firestore';
import { toast } from 'sonner';
import { Course, Question } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { motion, AnimatePresence } from 'framer-motion';

export default function Compete() {
  const { user, profile, systemConfig } = useAuth();
  
  const isUnactivatedStudent = (!profile || !profile.isActivated) && profile?.level !== '3' && profile?.level !== '4';
  if (isUnactivatedStudent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 space-y-4 max-w-2xl mx-auto">
        <Lock className="h-16 w-16 text-amber-500 animate-pulse" />
        <h1 className="text-3xl font-bold tracking-tight">CoLearn Compete Locked</h1>
        <p className="text-muted-foreground animate-pulse">
          Standard accounts must buy an activation pin to participate in CoLearn Compete, join live matches, compete with other users, and access season leaderboards.
        </p>
        <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
          Unlock instant access to real-time competitive testing by activating your account now!
        </p>
        <div className="pt-2">
          <Button size="lg" onClick={() => window.location.href = '/activate'}>
            Go to Activation Page
          </Button>
        </div>
      </div>
    );
  }

  // Game states: 'lobby' | 'selecting_course' | 'selecting_lobby_type' | 'waiting' | 'playing' | 'results'
  const [gameState, setGameState] = useState<'lobby' | 'selecting_course' | 'selecting_lobby_type' | 'waiting' | 'playing' | 'results'>('lobby');
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lobbyType, setLobbyType] = useState<'quick' | 'create' | 'join' | null>(null);
  
  // Quick match selection (number of questions: 10, 20, or 30)
  const [selectedNumQuestions, setSelectedNumQuestions] = useState<10 | 20 | 30>(10);
  // Private custom match selection (manually input number of questions)
  const [customNumQuestions, setCustomNumQuestions] = useState<number>(10);
  // Join custom room selection
  const [joinRoomCode, setJoinRoomCode] = useState('');
  
  // Live Match variables
  const [currentMatch, setCurrentMatch] = useState<any>(null);
  const [searchCountdown, setSearchCountdown] = useState<number>(0);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [matchQuestions, setMatchQuestions] = useState<Question[]>([]);
  
  // In-Game Live Timers
  const [timeLeft, setTimeLeft] = useState<number>(300); // in seconds
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [userStats, setUserStats] = useState({
    timeTaken: 0,
    answersLog: [] as { isCorrect: boolean; time: number; speedBonus: boolean }[]
  });

  // Leaderboard states
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [userRank, setUserRank] = useState<string | number>('Unranked');

  const activeSeasonId = systemConfig?.activeSeasonId || null;
  const activeSeasonName = systemConfig?.activeSeasonName || null;

  // 1. Load Leaderboard and Courses
  useEffect(() => {
    if (!user) return;
    
    // Load courses
    setLoadingCourses(true);
    const coursesCol = collection(db, 'courses');
    getDocs(coursesCol).then(async (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course));
      
      const filtered = await getFilteredCoursesForStudent(list, profile, true, systemConfig?.currentSemester);
      setCourses(filtered);
      setLoadingCourses(false);
    }).catch(err => {
      handleFirestoreError(err, OperationType.GET, 'courses');
      setLoadingCourses(false);
    });
  }, [user, systemConfig, profile]);

  // Load Leaderboard inside Active Season
  useEffect(() => {
    if (!activeSeasonId) {
      setLeaderboard([]);
      setUserRank('Unranked');
      return;
    }

    setLoadingLeaderboard(true);
    const leaderboardCol = collection(db, 'seasons', activeSeasonId, 'leaderboard');
    const leaderboardQuery = query(leaderboardCol, orderBy('stars', 'desc'), limit(100));

    const unsubscribe = onSnapshot(leaderboardQuery, (snapshot) => {
      const parsedList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      }));

      // Secondary sort locally in memory: stars desc, then updatedAt asc (earliest wins)
      parsedList.sort((a: any, b: any) => {
        if ((b.stars || 0) !== (a.stars || 0)) {
          return (b.stars || 0) - (a.stars || 0);
        }
        const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return timeA - timeB;
      });

      const list = parsedList.map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
      setLeaderboard(list);
      
      const myDoc = list.find(item => item.id === user?.uid);
      if (myDoc) {
        setUserRank(`#${myDoc.rank}`);
      } else {
        setUserRank('Unranked');
      }
      setLoadingLeaderboard(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `seasons/${activeSeasonId}/leaderboard`);
      setLoadingLeaderboard(false);
    });

    return () => unsubscribe();
  }, [activeSeasonId, user]);

  // Match Listener
  useEffect(() => {
    if (!currentMatch?.id) return;

    const unsubscribe = onSnapshot(doc(db, 'compete_matches', currentMatch.id), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      const updatedMatch: any = { id: docSnap.id, ...data };
      
      setCurrentMatch(updatedMatch);

      // Transition from matching waiting screen or lobby selection/home screens to game screen
      if (gameState !== 'playing' && gameState !== 'results' && updatedMatch.status === 'active') {
        const qList = updatedMatch.questions || [];
        setMatchQuestions(qList);
        setActiveQuestionIndex(0);
        setSelectedOption(null);
        setHasSubmittedAnswer(false);
        setQuestionStartTime(Date.now());
        setTimeLeft(updatedMatch.duration * 60);
        setGameState('playing');
        toast.info("Match found! Let the Point Grab begin!", { icon: '🎮' });
      }

      // Live game state completion or forfeit trigger
      if (gameState === 'playing') {
        if (updatedMatch.status === 'completed') {
          setGameState('results');
          if (updatedMatch.forfeitedBy) {
            toast.warning("The match was ended because a player forfeited.", { icon: '⚠️', duration: 5000 });
          } else {
            toast.info("Match concluded! Let's see the results.", { icon: '🏆' });
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

          // If BOTH players have answered all questions, or timer expired
          if (myAnswerCount === qCount && opAnswerCount === qCount) {
            concludeMatch(updatedMatch);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [currentMatch?.id, gameState]);

  // Timers
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      // Check point grab 3-minute clock if one user finishes
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
          // Time expired, auto conclude match
          concludeMatch(currentMatch);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, currentMatch]);

  // Search countdown for Quick Match simulated bot fallback AND periodic 2-second scan
  useEffect(() => {
    if (gameState !== 'waiting' || lobbyType !== 'quick') return;

    const countdownInterval = setInterval(() => {
      setSearchCountdown((prev) => {
        if (prev <= 1) {
          // Search timeout: trigger fallback simulated bot
          triggerBotMatch();
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Resilient 2-second scan interval
    const scanInterval = setInterval(async () => {
      if (!currentMatch?.id || !user?.uid || !selectedCourse?.id) return;
      try {
        const lobbiesQuery = query(
          collection(db, 'compete_matches'),
          where('status', '==', 'waiting'),
          where('type', '==', 'quick_match'),
          where('courseId', '==', selectedCourse.id),
          where('numQuestions', '==', selectedNumQuestions)
        );
        const lobbiesSnap = await getDocs(lobbiesQuery);
        
        let foundLobby: any = null;
        for (const val of lobbiesSnap.docs) {
          const lobbyData = val.data();
          if (lobbyData.creatorId !== user.uid && val.id !== currentMatch.id) {
            foundLobby = { id: val.id, ...lobbyData };
            break;
          }
        }

        if (foundLobby) {
          clearInterval(scanInterval);
          clearInterval(countdownInterval);

          // Join this other existing matching room instead!
          const otherDocRef = doc(db, 'compete_matches', foundLobby.id);
          await updateDoc(otherDocRef, {
            opponentId: user.uid,
            opponentUsername: profile?.username || user.email || 'Student User',
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

    return () => {
      clearInterval(countdownInterval);
      clearInterval(scanInterval);
    };
  }, [gameState, lobbyType, currentMatch?.id, selectedCourse?.id, selectedNumQuestions, user?.uid, profile]);

  // Trigger fallback simulated Bot match
  const triggerBotMatch = async () => {
    if (!selectedCourse || !currentMatch) return;
    toast.success("Matchmaking query: No user active in course line. Playing against a highly competitive System Bot!", { duration: 5000 });

    try {
      const matchDocRef = doc(db, 'compete_matches', currentMatch.id);
      
      // Update match directly as Active, joining a bot opponent
      await updateDoc(matchDocRef, {
        status: 'active',
        opponentId: 'bot_colearn',
        opponentUsername: 'CoLearn Bot ⚡',
        opponentPhotoURL: '',
        startTime: Date.now()
      });
      
      // Simulate Bot answers periodically
      simulateBotBehavior(currentMatch.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `compete_matches/${currentMatch?.id}`);
    }
  };

  // Simulate AI opponent answering questions periodically
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
      
      // Randomly chose correct (80%) or incorrect logic
      const isCorrect = Math.random() < 0.75;
      const chosenAns = isCorrect ? currentQObj.correctAnswer : (currentQObj.incorrectAnswers?.[0] || 'Incorrect Option');

      // Check speed bonus (did bot answer before player?)
      const creatorAnswers = matchData.creatorAnswers || {};
      const hasPlayerAnswered = creatorAnswers && creatorAnswers[qId];

      let pointsAwarded = 0;
      if (isCorrect) {
        pointsAwarded = 1;
        if (!hasPlayerAnswered) {
          pointsAwarded += 1;
        }
      }

      await updateDoc(docRef, {
        [`opponentAnswers.${qId}`]: {
          selectedAnswer: chosenAns,
          isCorrect,
          answeredAt: Date.now(),
          opponentAnsweredBefore: !!hasPlayerAnswered,
          pointsAwarded
        },
        opponentPoints: increment(pointsAwarded)
      });

      currentQ += 1;
      // Schedule next question simulation randomly between 8 to 18 seconds
      setTimeout(postBotAnswer, 8000 + Math.random() * 10000);
    };

    // Bot starts answering after a delay
    setTimeout(postBotAnswer, 5000);
  };

  const concludeMatch = async (matchData: any) => {
    if (!matchData || matchData.status === 'completed') return;

    try {
      const matchDocRef = doc(db, 'compete_matches', matchData.id);
      
      // Refetch match to ensure consistency
      const snap = await getDoc(matchDocRef);
      if (!snap.exists()) return;
      const freshData = snap.data();

      const creatorPoints = freshData.creatorPoints || 0;
      const opponentPoints = freshData.opponentPoints || 0;

      let winnerId = '';
      if (creatorPoints > opponentPoints) {
        winnerId = freshData.creatorId;
      } else if (opponentPoints > creatorPoints) {
        winnerId = freshData.opponentId;
      } else {
        winnerId = 'draw';
      }

      await updateDoc(matchDocRef, {
        status: 'completed',
        winnerId,
        endTime: Date.now()
      });

      // Award star to the winner ONLY IF it is a Quick Match AND there is an active season
      if (freshData.type === 'quick_match' && winnerId !== 'draw' && activeSeasonId) {
        const winnerName = winnerId === freshData.creatorId ? freshData.creatorUsername : freshData.opponentUsername;
        const winnerPhoto = winnerId === freshData.creatorId ? freshData.creatorPhotoURL : freshData.opponentPhotoURL;
        
        // Award the star in leaderboard!
        if (winnerId !== 'bot_colearn') {
          const leaderDocRef = doc(db, 'seasons', activeSeasonId, 'leaderboard', winnerId);
          const leaderSnap = await getDoc(leaderDocRef);

          if (leaderSnap.exists()) {
            await updateDoc(leaderDocRef, {
              stars: increment(1),
              updatedAt: serverTimestamp()
            });
          } else {
            await setDoc(leaderDocRef, {
              userId: winnerId,
              username: winnerName || 'Anonymous User',
              photoURL: winnerPhoto || '',
              favoriteCourse: freshData.courseCode || 'GENERAL',
              stars: 1,
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      // Change user state locally
      setGameState('results');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `compete_matches/${matchData?.id}`);
    }
  };

  // Helper shuffle array
  const shuffleArray = (array: any[]) => {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  // 2. Setup Match Handler
  const handleInitiateMatch = async (mode: 'quick' | 'create' | 'join') => {
    if (!selectedCourse) return;
    setLobbyType(mode);

    if (mode === 'join') {
      setGameState('selecting_lobby_type');
      return;
    }

    try {
      // 1. Fetch questions for selected Course
      const qQuery = query(collection(db, 'questions'), where('courseId', '==', selectedCourse.id));
      const qSnap = await getDocs(qQuery);
      let list = qSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));

      // Fallback generator if course has no questions
      if (list.length === 0) {
        list = [
          {
            id: 'temp_q1',
            sheetId: 'sheet_1',
            courseId: selectedCourse.id,
            text: `Which core principle defines appropriate study scheduling regarding ${selectedCourse.code}?`,
            correctAnswer: 'Spaced repetition coupled with structured active recall sessions.',
            incorrectAnswers: ['Mass cramming everything overnight during tests.', 'Skimming handouts passively without problem sheets.', 'Memorizing question options exclusively.'],
            order: 1,
            authorId: 'system',
            createdAt: new Date().toISOString()
          },
          {
            id: 'temp_q2',
            sheetId: 'sheet_1',
            courseId: selectedCourse.id,
            text: `What is a core milestone in master learning for ${selectedCourse.title}?`,
            correctAnswer: 'Breaking down hard textbook sub-concepts to teach others clearly.',
            incorrectAnswers: ['Highlighting whole chapters in yellow markers.', 'Retrieving only simple summaries.', 'Passing syllabus assignments late.'],
            order: 2,
            authorId: 'system',
            createdAt: new Date().toISOString()
          },
          {
            id: 'temp_q3',
            sheetId: 'sheet_1',
            courseId: selectedCourse.id,
            text: `Which student resource on CoLearn optimizes quick evaluation performance?`,
            correctAnswer: 'Simulated CBT timers and past question sheets.',
            incorrectAnswers: ['Unorganized bookmarks.', 'Public discussion threads strictly.', 'Profile settings changes.'],
            order: 3,
            authorId: 'system',
            createdAt: new Date().toISOString()
          },
          {
            id: 'temp_q4',
            sheetId: 'sheet_1',
            courseId: selectedCourse.id,
            text: `Why is student collaboration highly effective in academic modules?`,
            correctAnswer: 'Peer explanations highlight personal knowledge gaps.',
            incorrectAnswers: ['To copy homework easily.', 'It decreases individual study time.', 'To complete courses without reading.'],
            order: 4,
            authorId: 'system',
            createdAt: new Date().toISOString()
          },
          {
            id: 'temp_q5',
            sheetId: 'sheet_1',
            courseId: selectedCourse.id,
            text: `In a high pressure CBT examination, what constitutes the healthiest strategy?`,
            correctAnswer: 'Attempting the straightforward problems first, leaving complex ones for later review.',
            incorrectAnswers: ['Sticking to question one until solved.', 'Guessing options blind.', 'Rushing to finish in five minutes.'],
            order: 5,
            authorId: 'system',
            createdAt: new Date().toISOString()
          }
        ];
      }

      // Shuffle options and pick 5 questions maximum
      // Decide the question limit
      const finalNumQuestions = mode === 'quick' ? selectedNumQuestions : customNumQuestions;

      // Ensure we have questions. If course has no questions, use fallback templates
      let baseQuestionsList = list.length > 0 ? list : [
        {
          id: 'temp_q1',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `Which core principle defines appropriate study scheduling regarding ${selectedCourse.code}?`,
          correctAnswer: 'Spaced repetition coupled with structured active recall sessions.',
          incorrectAnswers: ['Mass cramming everything overnight during tests.', 'Skimming handouts passively without problem sheets.', 'Memorizing question options exclusively.'],
          order: 1,
          authorId: 'system',
          createdAt: new Date().toISOString()
        },
        {
          id: 'temp_q2',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `What is a core milestone in master learning for ${selectedCourse.title}?`,
          correctAnswer: 'Breaking down hard textbook sub-concepts to teach others clearly.',
          incorrectAnswers: ['Highlighting whole chapters in yellow markers.', 'Retrieving only simple summaries.', 'Passing syllabus assignments late.'],
          order: 2,
          authorId: 'system',
          createdAt: new Date().toISOString()
        },
        {
          id: 'temp_q3',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `Which student resource on CoLearn optimizes quick evaluation performance?`,
          correctAnswer: 'Simulated CBT timers and past question sheets.',
          incorrectAnswers: ['Unorganized bookmarks.', 'Public discussion threads strictly.', 'Profile settings changes.'],
          order: 3,
          authorId: 'system',
          createdAt: new Date().toISOString()
        },
        {
          id: 'temp_q4',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `Why is student collaboration highly effective in academic modules?`,
          correctAnswer: 'Peer explanations highlight personal knowledge gaps.',
          incorrectAnswers: ['To copy homework easily.', 'It decreases individual study time.', 'To complete courses without reading.'],
          order: 4,
          authorId: 'system',
          createdAt: new Date().toISOString()
        },
        {
          id: 'temp_q5',
          sheetId: 'sheet_1',
          courseId: selectedCourse.id,
          text: `In a high pressure CBT examination, what constitutes the healthiest strategy?`,
          correctAnswer: 'Attempting the straightforward problems first, leaving complex ones for later review.',
          incorrectAnswers: ['Sticking to question one until solved.', 'Guessing options blind.', 'Rushing to finish in five minutes.'],
          order: 5,
          authorId: 'system',
          createdAt: new Date().toISOString()
        }
      ];

      // If we don't have enough questions to satisfy finalNumQuestions, repeat/cycle them
      let combinedList: Question[] = [];
      while (combinedList.length < finalNumQuestions) {
        combinedList = [...combinedList, ...shuffleArray(baseQuestionsList)];
      }

      // Shuffle options and pick selected questions
      const selectedQuestions = combinedList.slice(0, finalNumQuestions).map((q, idx) => {
        const optionsShuffle = shuffleArray([q.correctAnswer, ...q.incorrectAnswers]);
        return {
          ...q,
          id: `${q.id || 'q'}_idx_${idx}`, // ensure unique ID per question instance to prevent key clashes
          options: optionsShuffle // inject options directly
        };
      });

      // Scale overall match duration - 1.5 minutes per question (minimum 15 mins)
      const overallDurationMins = Math.max(15, Math.ceil(finalNumQuestions * 1.5));

      if (mode === 'quick') {
        if (!activeSeasonId) {
          toast.error("Quick Matches are locked as there is no active season currently. Play a custom private match!");
          return;
        }

        setGameState('waiting');
        setSearchCountdown(10); // 10s search window, then triggers system Bot to keep it enjoyable

        // Look for waiting lobby matching the number of questions!
        const lobbiesQuery = query(
          collection(db, 'compete_matches'),
          where('status', '==', 'waiting'),
          where('type', '==', 'quick_match'),
          where('courseId', '==', selectedCourse.id),
          where('numQuestions', '==', selectedNumQuestions)
        );
        const lobbiesSnap = await getDocs(lobbiesQuery);
        
        let foundLobby: any = null;
        for (const val of lobbiesSnap.docs) {
          const lobbyData = val.data();
          if (lobbyData.creatorId !== user?.uid) {
            foundLobby = { id: val.id, ...lobbyData };
            break;
          }
        }

        if (foundLobby) {
          // Join existing matching room
          const docRef = doc(db, 'compete_matches', foundLobby.id);
          await updateDoc(docRef, {
            opponentId: user?.uid,
            opponentUsername: profile?.username || user?.email || 'Student User',
            opponentPhotoURL: profile?.photoURL || '',
            status: 'active',
            startTime: Date.now()
          });
          setCurrentMatch({ id: foundLobby.id, ...foundLobby, status: 'active' });
        } else {
          // Create new waiting quick lobby
          const newMatchDoc = doc(collection(db, 'compete_matches'));
          const matchPayload = {
            courseId: selectedCourse.id,
            courseCode: selectedCourse.code,
            type: 'quick_match',
            duration: overallDurationMins,
            numQuestions: selectedNumQuestions,
            status: 'waiting',
            creatorId: user?.uid,
            creatorUsername: profile?.username || user?.email || 'Student User',
            creatorPhotoURL: profile?.photoURL || '',
            opponentId: null,
            opponentUsername: null,
            opponentPhotoURL: null,
            roomCode: null,
            questions: selectedQuestions,
            creatorPoints: 0,
            opponentPoints: 0,
            creatorAnswers: {},
            opponentAnswers: {},
            finishGraceTime: null,
            firstFinishedUserId: null,
            createdAt: Date.now()
          };
          await setDoc(newMatchDoc, matchPayload);
          setCurrentMatch({ id: newMatchDoc.id, ...matchPayload });
        }
      } else if (mode === 'create') {
        // Create Custom room
        const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
        const newMatchDoc = doc(collection(db, 'compete_matches'));
        const matchPayload = {
          courseId: selectedCourse.id,
          courseCode: selectedCourse.code,
          type: 'custom_room',
          duration: overallDurationMins,
          numQuestions: customNumQuestions,
          status: 'waiting',
          creatorId: user?.uid,
          creatorUsername: profile?.username || user?.email || 'Student User',
          creatorPhotoURL: profile?.photoURL || '',
          opponentId: null,
          opponentUsername: null,
          opponentPhotoURL: null,
          roomCode,
          questions: selectedQuestions,
          creatorPoints: 0,
          opponentPoints: 0,
          creatorAnswers: {},
          opponentAnswers: {},
          finishGraceTime: null,
          firstFinishedUserId: null,
          createdAt: Date.now()
        };
        await setDoc(newMatchDoc, matchPayload);
        setCurrentMatch({ id: newMatchDoc.id, ...matchPayload });
        setGameState('waiting');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'compete_matches');
    }
  };

  const handleJoinCustomRoom = async () => {
    if (!joinRoomCode.trim()) {
      toast.error("Please input a valid 5-character Code");
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
        toast.error("Lobby matching that code was not found or has already started.");
        return;
      }

      const matchDoc = snap.docs[0];
      const matchData = matchDoc.data();

      if (matchData.creatorId === user?.uid) {
        toast.error("You cannot join your own custom room as the opponent.");
        return;
      }

      // Join the room as the opponent
      await updateDoc(doc(db, 'compete_matches', matchDoc.id), {
        status: 'active',
        opponentId: user?.uid,
        opponentUsername: profile?.username || user?.email || 'Student User',
        opponentPhotoURL: profile?.photoURL || '',
        startTime: Date.now()
      });

      setCurrentMatch({ id: matchDoc.id, ...matchData, status: 'active' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `compete_matches/${joinRoomCode}`);
    }
  };

  // 3. User Actions inside Game
  const handleSelectOption = (option: string) => {
    if (hasSubmittedAnswer) return;
    setSelectedOption(option);
  };

  const handleSubmitAnswer = async () => {
    if (!selectedOption || hasSubmittedAnswer || !currentMatch) return;
    setHasSubmittedAnswer(true);

    const isCreator = user?.uid === currentMatch.creatorId;
    const opponentAnswers = isCreator ? currentMatch.opponentAnswers : currentMatch.creatorAnswers;

    const currentQuestion = matchQuestions[activeQuestionIndex];
    const isCorrect = selectedOption === currentQuestion.correctAnswer;
    const qId = currentQuestion.id || `q_${activeQuestionIndex}`;

    // Speed bonus calculation: if correct, and opponent has not answered this question yet
    const hasOpponentAnswered = opponentAnswers && opponentAnswers[qId];
    
    let pointsAwarded = 0;
    let speedBonus = false;

    if (isCorrect) {
      pointsAwarded = 1;
      if (!hasOpponentAnswered) {
        pointsAwarded += 1; // +1 Speed bonus!
        speedBonus = true;
      }
    }

    // Save locally to user stats for logs
    const timeSpentOnQuestion = Math.round((Date.now() - questionStartTime) / 1000);
    setUserStats((prev) => ({
      ...prev,
      timeTaken: prev.timeTaken + timeSpentOnQuestion,
      answersLog: [...prev.answersLog, { isCorrect, time: timeSpentOnQuestion, speedBonus }]
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
          pointsAwarded
        },
        [pointsKey]: increment(pointsAwarded)
      });

      // Show temporary pop message
      if (isCorrect) {
        if (speedBonus) {
          toast.success("Correct Answer! Received 2 Points (including SPEED Bonus 🔥)!");
        } else {
          toast.success("Correct Answer! Received 1 Point!");
        }
      } else {
        toast.error("Incorrect Option Selected! 0 Points accumulated.");
      }

      // Proceed to next question after 2s
      setTimeout(async () => {
        if (activeQuestionIndex + 1 < matchQuestions.length) {
          setActiveQuestionIndex(prev => prev + 1);
          setSelectedOption(null);
          setHasSubmittedAnswer(false);
          setQuestionStartTime(Date.now());
        } else {
          // If we are finished but opponent isn't, we show a beautiful "Waiting for opponent to finish" card
          toast.info("You've finished all questions! Calculating results as soon as opponent finishes.");

          // Check if opponent is still answering to trigger the 3-minute grace period
          const isCreatorNow = user?.uid === currentMatch.creatorId;
          const currentOpponentAnswers = isCreatorNow ? currentMatch.opponentAnswers : currentMatch.creatorAnswers;
          const qCount = matchQuestions.length;
          const opAnswerCount = Object.keys(currentOpponentAnswers || {}).length;

          if (opAnswerCount < qCount) {
            // Put opponent on 3-minute clock because we finished first
            if (!currentMatch.finishGraceTime) {
              try {
                await updateDoc(doc(db, 'compete_matches', currentMatch.id), {
                  finishGraceTime: Date.now() + 180000, // 3 minutes grace countdown
                  firstFinishedUserId: user?.uid
                });
                toast.warning("You finished first! Your opponent is now on a 3-minute grace timer! 🔥", { duration: 5000 });
              } catch (e) {
                console.error("Grace period start failure: ", e);
              }
            }
          }
        }
      }, 1500);

    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `compete_matches/${currentMatch.id}`);
    }
  };

  const handleExitMatch = () => {
    setGameState('lobby');
    setCurrentMatch(null);
    setMatchQuestions([]);
    setSelectedCourse(null);
    setSelectedOption(null);
    setHasSubmittedAnswer(false);
    setUserStats({ timeTaken: 0, answersLog: [] });
  };

  const handleForfeit = async () => {
    if (!currentMatch || !user) return;
    if (!window.confirm("Are you sure you want to forfeit? Doing so will end the match immediately!")) return;

    try {
      const matchDocRef = doc(db, 'compete_matches', currentMatch.id);
      
      const isCreator = user.uid === currentMatch.creatorId;
      const forfeiterId = user.uid;
      const remainingUserId = isCreator ? currentMatch.opponentId : currentMatch.creatorId;

      await updateDoc(matchDocRef, {
        status: 'completed',
        winnerId: remainingUserId || 'none',
        forfeitedBy: forfeiterId,
        endTime: Date.now()
      });

      // Award or deduct stars ONLY for Quick Matches and when there is an active season
      if (currentMatch.type === 'quick_match' && activeSeasonId && remainingUserId && remainingUserId !== 'bot_colearn') {
        const timeSpent = (Date.now() - (currentMatch.startTime || currentMatch.createdAt)) / 1000;
        
        // Get remaining user's answers to calculate if they have >= 25% correct
        const remainingUserAnswers = isCreator ? (currentMatch.opponentAnswers || {}) : (currentMatch.creatorAnswers || {});
        const totalQuestions = currentMatch.questions?.length || 10;
        const correctCount = Object.values(remainingUserAnswers).filter((ans: any) => ans.isCorrect).length;
        const is25PercentCorrect = (correctCount / totalQuestions) >= 0.25;

        if (timeSpent > 300 && is25PercentCorrect) {
          // 1. Deduct star from forfeiter
          const forfeiterLeaderDoc = doc(db, 'seasons', activeSeasonId, 'leaderboard', forfeiterId);
          const fSnap = await getDoc(forfeiterLeaderDoc);
          if (fSnap.exists()) {
            const currentStars = fSnap.data().stars || 0;
            const newStars = Math.max(0, currentStars - 1);
            await updateDoc(forfeiterLeaderDoc, {
              stars: newStars,
              updatedAt: serverTimestamp()
            });
          }

          // 2. Award star to remaining player
          const remainingLeaderDoc = doc(db, 'seasons', activeSeasonId, 'leaderboard', remainingUserId);
          const rSnap = await getDoc(remainingLeaderDoc);
          if (rSnap.exists()) {
            await updateDoc(remainingLeaderDoc, {
              stars: increment(1),
              updatedAt: serverTimestamp()
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
              updatedAt: serverTimestamp()
            });
          }

          toast.info("A star was deducted from the forfeiter and awarded to the winner.");
        } else {
          toast.info("Match concluded without star adjustments (requires > 5m duration and >= 25% accuracy from the winner).");
        }
      } else if (currentMatch.type !== 'quick_match') {
        toast.info("Match ended due to forfeit. No stars are adjusted for private custom matches.");
      }

      setGameState('results');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `compete_matches/${currentMatch.id}`);
    }
  };

  // Formats remaining time
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins}:${remSecs < 10 ? '0' : ''}${remSecs}`;
  };

  // Render components beautifully
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pointer-events-auto" id="colearn_compete_root">
      
      {/* HEADER SECTION WITH USER STATS */}
      {gameState === 'lobby' && (
        <div className="mb-8">
          <div className="bg-gradient-to-r from-sidebar-primary/20 via-background to-sidebar-primary/5 rounded-2xl p-6 border shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6" id="compete-header-card">
            <div className="absolute top-0 right-0 p-8 opacity-5 scale-150 rotate-12 select-none pointer-events-none">
              <Trophy className="h-64 w-64 text-primary" />
            </div>

            <div className="relative z-10">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 mb-3">
                <Crown size={12} className="fill-amber-500" />
                CoLearn Compete Lobbies
              </span>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Make Education Enjoyable
              </h1>
              <p className="mt-2 text-muted-foreground text-sm max-w-xl">
                Go head-to-head with academic peers and test your knowledge under pressure. Win quick matches, earn prestige stars, and top the seasonal leaderboard.
              </p>
            </div>

            <div className="grid grid-cols-2 bg-muted/60 backdrop-blur-sm p-4 rounded-xl border gap-4 min-w-[260px] relative z-10" id="compete-user-quick-stats">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground font-mono">SEASON RANK</span>
                <span className="text-2xl font-black text-primary tracking-tight">
                  {userRank}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">
                  {activeSeasonId ? activeSeasonName : 'No Active Season'}
                </span>
              </div>
              <div className="flex flex-col border-l pl-4">
                <span className="text-xs text-muted-foreground font-mono">EARNED STARS</span>
                <span className="text-2xl font-black text-amber-500 flex items-center gap-1 select-none">
                  {leaderboard.find(l => l.userId === user?.uid)?.stars || 0}
                  <Trophy size={20} className="text-amber-500 fill-amber-500" />
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase mt-0.5">
                  This Season Only
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RENDER CURRENT SCREEN BASED ON STATE PATH */}
      <AnimatePresence mode="wait">
        
        {/* LOBBY VIEW */}
        {gameState === 'lobby' && (
          <motion.div 
            key="lobby-screen"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* GAMEMODES */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Zap size={20} className="text-primary" /> Select Game Mode
                </h2>
              </div>

              {/* POINTS GRAB GAME MODE CARD */}
              <div 
                className="group relative bg-card hover:bg-muted/40 transition-all border rounded-2xl p-6 cursor-pointer shadow-sm hover:shadow-md flex flex-col md:flex-row items-start md:items-center gap-6"
                onClick={() => setGameState('selecting_course')}
                id="gamemode_points_grab"
              >
                <div className="p-4 rounded-xl bg-sidebar-primary/10 text-primary group-hover:scale-110 transition-transform">
                  <Zap size={32} className="fill-sidebar-primary/20" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold">Points Grab</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500">
                      LIVE NOW
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Instantly matches you with real peers studying the same module. Get points for selecting the correct response, with a <strong className="text-primary font-bold">+1 speed bonus</strong> if answered correctly ahead of your opponent!
                  </p>
                </div>
                <div className="self-end md:self-center">
                  <Button variant="ghost" size="icon" className="group-hover:translate-x-1 transition-transform">
                    <ChevronRight size={20} />
                  </Button>
                </div>
              </div>
            </div>

            {/* LEADERBOARD SIDE Panel */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Trophy size={18} className="text-amber-500" /> Leaderboard
                </h2>
                {activeSeasonId && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Live
                  </span>
                )}
              </div>

              <Card className="rounded-2xl overflow-hidden border shadow-sm">
                <CardHeader className="bg-muted/40 pb-4">
                  <CardTitle className="text-sm font-bold">
                    {activeSeasonId ? activeSeasonName : 'No active season'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {activeSeasonId 
                      ? "Prestige Rankings are calculated dynamically based on earned Stars." 
                      : "The leaderboard is currently offline as no season has started. Contact an administrator to schedule a competition season."
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 divide-y" id="compete-leaderboard-list">
                  {loadingLeaderboard ? (
                    <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Loading rankings...
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground font-medium text-xs">
                      No matching rankings published. Win quick matches to claim structural stars and stand tall.
                    </div>
                  ) : (
                    leaderboard.map((player) => (
                      <div 
                        key={player.id} 
                        className={`flex items-center justify-between p-4 transition-colors ${player.id === user?.uid ? 'bg-primary/5 font-bold' : 'hover:bg-muted/20'}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-center font-mono text-xs ${player.rank === 1 ? 'text-amber-500 text-lg font-black' : player.rank === 2 ? 'text-stone-400 text-base font-semibold' : player.rank === 3 ? 'text-amber-700 text-base font-semibold' : 'text-muted-foreground'}`}>
                            {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : player.rank}
                          </span>
                          
                          {player.photoURL ? (
                            <img src={player.photoURL} alt="" className="h-8 w-8 rounded-full border shadow-sm" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold font-mono border">
                              {player.username?.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          <div className="flex flex-col">
                            <span className="text-sm font-semibold truncate max-w-[130px]" title={player.username}>
                              {player.username}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono font-bold tracking-tight uppercase">
                              ★ Fav: {player.favoriteCourse}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-sm font-black text-amber-500 font-mono">
                          {player.stars} <Trophy size={14} className="fill-amber-500" />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* SELECT COURSE VIEW */}
        {gameState === 'selecting_course' && (
          <motion.div 
            key="selecting-course"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <button 
                onClick={() => setGameState('lobby')}
                className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <ArrowLeft size={16} /> Back to Lobby
              </button>
              <h2 className="text-xl font-extrabold text-foreground">
                Select Competition Course
              </h2>
              <div className="w-20" /> {/* Spacer */}
            </div>

            {loadingCourses ? (
              <div className="text-center py-16 text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw size={20} className="animate-spin text-primary" /> Loading modules...
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-16 bg-muted rounded-2xl border p-8">
                <AlertCircle size={32} className="mx-auto text-muted-foreground mb-3" />
                <h3 className="font-bold text-lg mb-1">No Courses Found</h3>
                <p className="text-sm text-stone-500">
                  There are no courses matching code parameters inside your current study semester ({systemConfig?.currentSemester || 'Holiday'}). Available courses will deploy when semesters active.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="compete-course-selection-grid">
                {courses.map((course) => (
                  <div 
                    key={course.id}
                    className="p-5 bg-card hover:bg-muted/40 border hover:border-sidebar-primary/40 rounded-xl cursor-pointer transition-all shadow-sm flex flex-col justify-between min-h-[140px]"
                    onClick={() => {
                      setSelectedCourse(course);
                      setGameState('selecting_lobby_type');
                    }}
                  >
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest bg-sidebar-primary/10 text-primary uppercase font-mono border">
                        {course.code}
                      </span>
                      <h3 className="text-base font-bold mt-2 leading-snug line-clamp-2">
                        {course.title}
                      </h3>
                    </div>
                    <div className="flex justify-end mt-4 pt-2 border-t text-[11px] text-muted-foreground font-mono">
                      <span className="text-primary font-bold inline-flex items-center gap-0.5">
                        Compete <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* SELECT LOBBY TYPE SCREEN */}
        {gameState === 'selecting_lobby_type' && selectedCourse && (
          <motion.div 
            key="selecting-lobby-type"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            className="max-w-xl mx-auto space-y-6"
            id="matchmaking_options"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <button 
                onClick={() => {
                  setSelectedCourse(null);
                  setGameState('selecting_course');
                }}
                className="flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-foreground cursor-pointer transition-colors"
              >
                <ArrowLeft size={16} /> Course Selection
              </button>
              <h2 className="text-lg font-bold text-foreground font-mono">
                Lobby: {selectedCourse.code}
              </h2>
              <div className="w-20" /> {/* Spacer */}
            </div>

            {/* QUICK MATCH CARD (DISABLED IF NO CURRENT ACTIVE SEASON) */}
            <Card className="rounded-2xl border shadow-sm relative overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>Option 1: Quick Matchmaking</span>
                  <Award size={18} className="text-primary" />
                </CardTitle>
                <CardDescription className="text-xs">
                  Join a real-time pool matching players for {selectedCourse.code}. Wins award Stars to seasonal leaders.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* MATCH QUESTIONS SELECTOR */}
                <div>
                  <label className="text-xs font-mono font-bold text-stone-400 block mb-2 uppercase">
                    Select Number of Questions
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {([10, 20, 30] as const).map((qCount) => (
                      <button
                        key={qCount}
                        onClick={() => setSelectedNumQuestions(qCount)}
                        className={`py-2 rounded-lg text-sm font-bold border transition-all ${selectedNumQuestions === qCount ? 'bg-primary border-primary text-white shadow-sm' : 'bg-muted border-stone-200 text-stone-600 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
                      >
                        {qCount} Questions
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    variant={activeSeasonId ? "default" : "secondary"}
                    className="w-full font-bold h-11"
                    onClick={() => handleInitiateMatch('quick')}
                    disabled={!activeSeasonId}
                    id="trigger_quick_match"
                  >
                    {activeSeasonId 
                      ? `Find Quick Match (${selectedNumQuestions} Questions)` 
                      : "Locked: Active Season Required for Quick Match"
                    }
                  </Button>
                  {!activeSeasonId && (
                    <p className="text-[10px] text-destructive mt-1.5 font-semibold text-center flex items-center justify-center gap-1">
                      <AlertCircle size={10} /> Quick matches are locked until an administrator starts a competitive season.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* CREATE / JOIN PRIVATE ROOM CODE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* CREATE PRIVATE ROOM */}
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-sm font-bold flex items-center justify-center gap-1.5">
                    <PlusCircle size={15} /> Host Match Room
                  </CardTitle>
                  <CardDescription className="text-[11px] leading-relaxed">
                    Create a custom competitive arena and share a five-character entry key. No seasonal Ranking stars awarded.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-2 text-center">
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-mono font-bold text-stone-400 uppercase block">
                      Number of Questions
                    </label>
                    <Input 
                      type="number"
                      min={5}
                      max={50}
                      value={customNumQuestions}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setCustomNumQuestions(isNaN(val) ? 10 : val);
                      }}
                      className="text-center font-bold"
                    />
                    <p className="text-[10px] text-muted-foreground text-center">
                      Enter between 5 and 50 questions
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full text-xs font-bold border-stone-200 hover:bg-stone-100"
                    onClick={() => handleInitiateMatch('create')}
                    id="trigger_create_room"
                  >
                    Generate Room Code
                  </Button>
                </CardContent>
              </Card>

              {/* JOIN PRIVATE ROOM */}
              <Card className="rounded-2xl border bg-card shadow-sm">
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-sm font-bold flex items-center justify-center gap-1.5">
                    <Users size={15} /> Join Match Room
                  </CardTitle>
                  <CardDescription className="text-[11px] leading-relaxed">
                    Have an opponent key? Input the five characters below to enter their custom lobby.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <Input 
                    placeholder="Enter Code (e.g., AH39C)"
                    className="text-center font-mono font-black uppercase text-base border h-9"
                    maxLength={10} // support extra padding spaces if any
                    value={joinRoomCode}
                    onChange={(e) => setJoinRoomCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleJoinCustomRoom();
                      }
                    }}
                  />
                  <Button 
                    className="w-full text-xs font-bold h-9"
                    onClick={handleJoinCustomRoom}
                    id="trigger_join_room"
                  >
                    Enter Room Lobbies
                  </Button>
                </CardContent>
              </Card>

            </div>
          </motion.div>
        )}

        {/* SEARCHING / WAITING LOBBY */}
        {gameState === 'waiting' && currentMatch && (
          <motion.div 
            key="waiting-lobby"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-md mx-auto text-center space-y-6 pt-12"
            id="matchmaking_wait_screen"
          >
            <div className="relative inline-flex items-center justify-center">
              <div className="h-24 w-24 rounded-full border-4 border-primary/20 bg-primary/5 animate-pulse flex items-center justify-center">
                <Trophy size={40} className="text-primary animate-bounce" />
              </div>
              <div className="absolute top-0 left-0 w-24 h-24 rounded-full border border-primary animate-ping" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                {currentMatch.type === 'quick_match' 
                  ? 'Finding Competitors...' 
                  : 'Hosting Custom Arena Room'
                }
              </h2>
              <p className="text-sm text-stone-500 mt-2 font-mono">
                Selected Course: {selectedCourse?.code || currentMatch.courseCode} - Unit Grabs
              </p>
            </div>

            {/* IF IT IS QUICK MATCH, SHOW TIMER FALLBACK TO BOT */}
            {currentMatch.type === 'quick_match' && (
              <div className="bg-muted px-4 py-3 rounded-xl border max-w-sm mx-auto">
                <p className="text-xs font-semibold text-stone-600">
                  Lobby scan active. Fallback System Bot will activate in <strong className="text-primary text-sm font-mono">{searchCountdown}s</strong> if no student is queueing this course.
                </p>
              </div>
            )}

            {/* IF CUSTOM ROOM SHOW THE SHARABLE CODE */}
            {currentMatch.type === 'custom_room' && (
              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/20 space-y-2 max-w-sm mx-auto">
                <span className="text-xs font-mono font-black tracking-wider text-primary uppercase">
                  SHARE ENTRY KEY
                </span>
                <div className="flex items-center justify-center gap-3">
                  <div className="text-4xl font-extrabold font-mono tracking-widest text-primary select-all">
                    {currentMatch.roomCode}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentMatch.roomCode);
                      toast.success("Room key copied! Send it to your classmate. 📋");
                    }}
                    className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                    title="Copy Code"
                  >
                    <Copy size={20} className="stroke-[2.5]" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Give this code to a classmate. they will click &ldquo;Join Match Room&rdquo; on their dashboard and input this to begin.
                </p>
              </div>
            )}

            <div className="pt-2">
              <Button 
                variant="destructive"
                className="font-bold px-8"
                onClick={handleExitMatch}
              >
                Quit Match Quest
              </Button>
            </div>
          </motion.div>
        )}

        {/* ACTIVE MULTIPLAYER PLAYING SCREEN */}
        {gameState === 'playing' && currentMatch && matchQuestions.length > 0 && (
          <motion.div 
            key="playing-match"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-8"
            id="multiplayer-matchmaking-game-board"
          >
            {/* PROGRESS & LIVE UPDATING COMPETE STATS */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="bg-muted/40 pb-3">
                  <CardTitle className="text-sm font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>LOBBY CARD STATUS</span>
                    <Clock size={14} className="text-primary animate-pulse" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                  {/* TIME LIMIT TIMER */}
                  <div className="text-center pt-2">
                    <span className="text-[10px] font-bold text-stone-400 font-mono uppercase block">Match Timer</span>
                    <div className="text-3xl font-black font-mono tracking-wider text-primary select-none">
                      {formatTime(timeLeft)}
                    </div>
                  </div>

                  {/* PEER TO PEER LIVE SCORE */}
                  <div className="space-y-3.5 border-t pt-4">
                    <span className="text-[10px] font-black text-stone-400 font-mono uppercase block">Live Points Status</span>
                    
                    {/* CREATOR SECTION */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50 dark:bg-stone-850 border">
                      <div className="flex items-center gap-2 min-w-0">
                        {currentMatch.creatorPhotoURL ? (
                          <img src={currentMatch.creatorPhotoURL} alt="" className="h-6 w-6 rounded-full" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                            {currentMatch.creatorUsername?.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-bold truncate max-w-[80px]" title={currentMatch.creatorUsername}>
                          {currentMatch.creatorUsername}
                        </span>
                        {user?.uid === currentMatch.creatorId && <span className="text-[9px] font-black text-primary font-mono">(You)</span>}
                      </div>
                      <span className="text-sm font-black text-primary font-mono">{currentMatch.creatorPoints} pts</span>
                    </div>

                    {/* OPPONENT SECTION */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-stone-50 dark:bg-stone-850 border">
                      <div className="flex items-center gap-2 min-w-0">
                        {currentMatch.opponentPhotoURL ? (
                          <img src={currentMatch.opponentPhotoURL} alt="" className="h-6 w-6 rounded-full" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-indigo-500/15 text-indigo-500 text-[10px] font-bold flex items-center justify-center">
                            {currentMatch.opponentUsername?.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-bold truncate max-w-[80px]" title={currentMatch.opponentUsername}>
                          {currentMatch.opponentUsername || 'Opponent'}
                        </span>
                        {user?.uid === currentMatch.opponentId && <span className="text-[9px] font-black text-primary font-mono">(You)</span>}
                      </div>
                      <span className="text-sm font-black text-indigo-500 font-mono">{currentMatch.opponentPoints} pts</span>
                    </div>

                  </div>

                  <div className="text-center pt-2 border-t text-[10px] leading-relaxed text-muted-foreground">
                    ⚡ Correct + speed bonus (+1 point if opponent hasn&apos;t completed matching index).
                  </div>
                </CardContent>
              </Card>

              <Button 
                variant="ghost" 
                className="w-full text-xs font-bold text-destructive hover:bg-destructive/10 cursor-pointer"
                onClick={handleForfeit}
              >
                Forfeit Match
              </Button>
            </div>

            {/* ACTIVE QUESTIONS PRESENTATION PANEL */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="rounded-2xl border shadow-sm">
                <CardHeader className="bg-muted/30 pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                      Question {activeQuestionIndex + 1} of {matchQuestions.length}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      Course: {currentMatch.courseCode}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-6 md:p-8 space-y-8">
                  
                  {/* QUESTION TEXT */}
                  <div className="text-lg md:text-xl font-bold text-foreground leading-relaxed">
                    {matchQuestions[activeQuestionIndex]?.text}
                  </div>

                  {/* MULTIPLE OPTION ANSWERS */}
                  <div className="grid grid-cols-1 gap-3.5">
                    {matchQuestions[activeQuestionIndex]?.options?.map((option: string, idx: number) => {
                      const isSelected = selectedOption === option;
                      let optionClass = "border bg-card hover:bg-muted/40 text-left font-medium p-4 rounded-xl cursor-default transition-all flex items-center gap-3";
                      
                      if (isSelected) {
                        optionClass = "border-primary bg-primary/5 text-primary font-bold text-left p-4 rounded-xl cursor-default transition-all flex items-center gap-3 shadow-sm";
                      }
                      
                      return (
                        <button
                          key={idx}
                          disabled={hasSubmittedAnswer}
                          onClick={() => handleSelectOption(option)}
                          className={optionClass}
                        >
                          <span className={`h-6 w-6 rounded-full flex items-center justify-center border font-mono text-xs ${isSelected ? 'bg-primary border-primary text-white font-heavy' : 'text-stone-400 bg-stone-50 dark:bg-stone-850 border-stone-200'}`}>
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="text-sm text-foreground flex-1">
                            {option}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* SCORE ACTION SUBMIT BUTTON */}
                  <div className="flex justify-end pt-4 border-t">
                    <Button
                      disabled={!selectedOption || hasSubmittedAnswer}
                      onClick={handleSubmitAnswer}
                      className="px-8 font-black h-12"
                      id="submit_compete_answer"
                    >
                      {hasSubmittedAnswer ? "Verifying response..." : "Submit Response"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* LIVE PLAYERS STATUS METAR */}
              <div className="flex gap-4" id="peer-live-game-tracker">
                {(user?.uid === currentMatch.creatorId ? currentMatch.opponentAnswers : currentMatch.creatorAnswers) && (
                  <Card className="flex-1 p-4 rounded-xl bg-card border shadow-sm">
                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Users size={12} /> OP DETAILS SUBMISSIONS
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {matchQuestions.map((q, qIdx) => {
                        const qId = q.id || `q_${qIdx}`;
                        const isCreator = user?.uid === currentMatch.creatorId;
                        const opAns = isCreator ? currentMatch.opponentAnswers?.[qId] : currentMatch.creatorAnswers?.[qId];
                        return (
                          <div 
                            key={qId} 
                            className={`h-6 flex-1 rounded text-[10px] font-bold font-mono flex items-center justify-center border ${opAns ? (opAns.isCorrect ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20') : 'bg-stone-100 dark:bg-stone-800 text-stone-400'}`}
                            title={opAns ? `Finished index ${qIdx + 1}` : `Thinking index ${qIdx + 1}...`}
                          >
                            Q{qIdx + 1}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}
                
                <Card className="flex-1 p-4 rounded-xl bg-card border shadow-sm">
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <User size={12} /> YOUR PROGRESS SUBMISSIONS
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {matchQuestions.map((q, qIdx) => {
                      const qId = q.id || `q_${qIdx}`;
                      const isCreator = user?.uid === currentMatch.creatorId;
                      const myAns = isCreator ? currentMatch.creatorAnswers?.[qId] : currentMatch.opponentAnswers?.[qId];
                      return (
                        <div 
                          key={qId} 
                          className={`h-6 flex-1 rounded text-[10px] font-bold font-mono flex items-center justify-center border ${myAns ? (myAns.isCorrect ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-extrabold' : 'bg-red-500/15 text-red-500 border-red-500/30') : qIdx === activeQuestionIndex ? 'bg-primary/20 text-primary border-primary/30 animate-pulse' : 'bg-stone-100 dark:bg-stone-800 text-stone-400'}`}
                        >
                          Q{qIdx + 1}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {/* RESULTS SCREEN */}
        {gameState === 'results' && currentMatch && (
          <motion.div 
            key="results-screen"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto space-y-6 text-center pt-6"
            id="compete-match-results"
          >
            {/* STYLISH TROPHY ACCENT */}
            <div>
              {currentMatch.winnerId === 'draw' ? (
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-stone-100 text-stone-500 border border-stone-200 mb-4 text-3xl font-mono">
                  🤝
                </div>
              ) : currentMatch.winnerId === user?.uid ? (
                <div className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-amber-500/10 text-amber-500 border-2 border-amber-500/30 mb-4 animate-bounce relative">
                  <Trophy size={48} className="fill-amber-500" />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 rounded-full bg-emerald-500" />
                </div>
              ) : (
                <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-stone-100 text-stone-400 border border-stone-200 mb-4">
                  <X size={40} />
                </div>
              )}
              
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {currentMatch.winnerId === 'draw' 
                  ? "It's a Stand-off Draw!" 
                  : currentMatch.winnerId === user?.uid 
                    ? "Victory! You Won the Match! 🎉" 
                    : "Defeat! Better Luck Next Round!"
                }
              </h1>
              <p className="text-sm mt-1 text-muted-foreground font-mono">
                Lobby Code: {currentMatch.type === 'quick_match' ? 'Quick Pool' : currentMatch.roomCode} | Course: {currentMatch.courseCode}
              </p>
            </div>

            {/* LIVE SCORE STATS SCOREBOARD PANEL */}
            <div className="grid grid-cols-2 bg-card border rounded-2xl items-stretch divide-x shadow-sm select-none">
              <div className="p-6 flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground font-mono uppercase block mb-1">Your Final Score</span>
                <span className={`text-4xl font-black font-mono ${currentMatch.winnerId === user?.uid ? 'text-emerald-500' : 'text-stone-700 dark:text-stone-300'}`}>
                  {user?.uid === currentMatch.creatorId ? currentMatch.creatorPoints : currentMatch.opponentPoints} <span className="text-xs">points</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold mt-2">
                  Duration completed: {userStats.timeTaken} seconds
                </span>
              </div>
              <div className="p-6 flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground font-mono uppercase block mb-1">Opponent Score</span>
                <span className={`text-4xl font-black font-mono ${currentMatch.winnerId !== user?.uid && currentMatch.winnerId !== 'draw' ? 'text-indigo-500' : 'text-stone-600'}`}>
                  {user?.uid === currentMatch.creatorId ? currentMatch.opponentPoints : currentMatch.creatorPoints} <span className="text-xs">points</span>
                </span>
                <span className="text-[10px] text-stone-400 font-bold mt-2">
                  Opponent: {user?.uid === currentMatch.creatorId ? (currentMatch.opponentUsername || 'Peer') : currentMatch.creatorUsername}
                </span>
              </div>
            </div>

            {/* REWARD STAR ACCENTS */}
            {currentMatch.type === 'quick_match' && currentMatch.winnerId === user?.uid && activeSeasonId && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm font-bold p-4 rounded-xl flex items-center justify-center gap-2 max-w-md mx-auto animate-pulse">
                <Trophy size={16} className="fill-amber-500" />
                Prestige Star rewarded! +1 point added to seasonal leader ratings.
              </div>
            )}

            {currentMatch.type === 'custom_room' && (
              <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold p-3.5 rounded-xl max-w-md mx-auto">
                Friendly Match Outcome: No Prestige Stars are awarded for custom private lobby rooms.
              </div>
            )}

            {/* DETAILED QUESTION RECAPLOG SHEETS */}
            <Card className="rounded-2xl border text-left shadow-sm">
              <CardHeader className="bg-muted/30 pb-3 border-b">
                <CardTitle className="text-sm font-mono font-black uppercase">Your Performance Logs</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y font-mono text-xs">
                {userStats.answersLog.map((log, index) => (
                  <div key={index} className="p-4 flex items-center justify-between">
                    <div>
                      <span className="font-bold block text-foreground">
                        Question index #{index + 1}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        Elapsed response duration: {log.time} seconds
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {log.speedBonus && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black">
                          🔥 SPEED BONUS
                        </span>
                      )}
                      <span className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 ${log.isCorrect ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                        {log.isCorrect ? <Check size={12} /> : <X size={12} />}
                        {log.isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="pt-4 flex items-center justify-center gap-4">
              <Button onClick={handleExitMatch} className="px-8 font-black">
                Back to CoLearn Competitions
              </Button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
