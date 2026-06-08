import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { BellIcon } from '../components/Icons';
import { F } from '../components/Theme';
import { useTheme } from '../context/ThemeContext';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

function BackIcon() {
  const { colors: C } = useTheme();
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center' }}>
      <View style={{ width: 12, height: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }, { translateX: 2 }] }} />
    </View>
  );
}

interface VideoQuestion {
  id: string;
  text: string;
  correctAnswer: string;
  incorrectAnswers: string[];
}

export default function VideoViewerScreen() {
  const router = useRouter();
  const { colors: C } = useTheme();
  const s = useMemo(() => createStyles(C), [C]);
  const { profile } = useAuth();

  const { noteId, title = "Video Lesson", videoUrl: rawVideoUrl = "" } = useLocalSearchParams<{ 
    noteId: string; 
    title: string; 
    videoUrl: string;
    courseId: string;
  }>();

  const [note, setNote] = useState<any>(null);
  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // 1. Fetch note details dynamically to get the full, live description
  useEffect(() => {
    if (!noteId || !profile) return;
    const docRef = doc(db, 'notes', noteId);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setNote({ id: docSnap.id, ...docSnap.data() });
      }
    }, (err) => {
      console.error('Error fetching note details:', err);
    });
    return () => unsub();
  }, [noteId, profile]);

  // 2. Fetch the dynamic quiz check questions (VideoQuestions) for this lesson/note
  useEffect(() => {
    if (!noteId || !profile) return;
    setLoadingQuestions(true);
    const q = query(collection(db, 'notes', noteId, 'videoQuestions'));
    const unsub = onSnapshot(q, (snapshot) => {
      const qList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VideoQuestion));
      setQuestions(qList);
      setLoadingQuestions(false);
    }, (err) => {
      console.error('Error fetching video questions:', err);
      setLoadingQuestions(false);
    });
    return () => unsub();
  }, [noteId, profile]);

  // Translate drive/youtube link to the secure embed formats
  const embedUrl = useMemo(() => {
    const url = rawVideoUrl || note?.videoUrl || '';
    if (!url) return '';

    // Handle Google Drive link formats
    if (url.includes('drive.google.com')) {
      if (url.includes('/preview')) {
        return url;
      }
      // Extract file id
      let fileId = '';
      const matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (matchD && matchD[1]) {
        fileId = matchD[1];
      } else {
        const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (matchId && matchId[1]) {
          fileId = matchId[1];
        }
      }
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    // Handle YouTube link formats
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        videoId = match[2];
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=0&modestbranding=1&rel=0&showinfo=0&controls=1`;
      }
    }

    return url;
  }, [rawVideoUrl, note?.videoUrl]);

  const isDriveVideo = useMemo(() => {
    const url = rawVideoUrl || note?.videoUrl || '';
    return url.includes('drive.google.com');
  }, [rawVideoUrl, note?.videoUrl]);

  // Script to inject inside Drive web previews to block actions & sniffers
  const injectedJavaScript = `
    (function() {
      // Create global styles to securely hide share, popout, menu buttons
      var style = document.createElement('style');
      style.innerHTML = \`
        .ndfHFb-c43Zgc-M6LaS-wZVH6-uCObO,
        .ndfHFb-c43Zgc-N7A4sc,
        .ndfHFb-c43Zgc-Xv79td,
        .ndfHFb-c43Zgc-T3iA6d-header,
        .ndfHFb-c43Zgc-xl07Ob,
        .ndfHFb-c43Zgc-xl07Ob-gV3S8e,
        .drive-viewer-header,
        .drive-viewer-chrome,
        div[role="toolbar"],
        div[class*="header"],
        div[class*="toolbar"],
        div[aria-label="Pop-out"],
        div[aria-label="Open in new window"],
        a[href*="drive.google.com"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        /* Top black action overlay header */
        .ndfHFb-c43Zgc-XL7Sbe {
          display: none !important;
        }
      \`;
      document.head.appendChild(style);

      // Continually remove potential elements from showing up
      setInterval(function() {
        var items = [
          document.querySelector('.ndfHFb-c43Zgc-T3iA6d-header'),
          document.querySelector('.ndfHFb-c43Zgc-N7A4sc'),
          document.querySelector('.ndfHFb-c43Zgc-xl07Ob'),
          document.querySelector('div[aria-label="Pop-out"]'),
          document.querySelector('div[aria-label="Open in new window"]'),
          document.querySelector('a[href*="drive.google.com"]')
        ];
        items.forEach(function(el) {
          if (el) {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
          }
        });
        
        var anchors = document.getElementsByTagName('a');
        for (var i = 0; i < anchors.length; i++) {
          if (anchors[i].href && anchors[i].href.indexOf('drive.google.com') > -1) {
            anchors[i].style.display = 'none';
          }
        }
      }, 500);
    })();
    true;
  `;

  // Submit and calculate concept check quiz performance
  const calculateScore = () => {
    let corr = 0;
    questions.forEach(q => {
      if (userAnswers[q.id] === q.correctAnswer) {
        corr++;
      }
    });
    return corr;
  };

  const handleQuizSubmit = () => {
    if (Object.keys(userAnswers).length < questions.length) {
      Alert.alert('Incomplete', 'Please answer all concept check questions before submitting!');
      return;
    }
    setShowResults(true);
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: C.bg }]} edges={['top']}>
      <View style={[s.header, { backgroundColor: C.surface, borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={[s.headerBrand, { color: C.ink }]}>COLEARN</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/notifications')}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* Real Dynamic Responsive Web Video Player */}
        <View style={s.videoPlayer}>
          {embedUrl ? (
            isDriveVideo ? (
              <View style={{ flex: 1, backgroundColor: '#000' }}>
                {/* Custom secure header covering Google's top bar */}
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 45,
                  backgroundColor: '#0a0a0a',
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.08)',
                  zIndex: 30,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 13 }}>🔒</Text>
                    <Text 
                      style={{ 
                        fontFamily: F.bold, 
                        fontSize: 11, 
                        color: '#f4f4f5', 
                        letterSpacing: 0.5,
                      }}
                      numberOfLines={1}
                    >
                      {note?.title || title || "Protected Stream"}
                    </Text>
                  </View>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 1,
                    borderColor: 'rgba(16, 185, 129, 0.2)',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                  }}>
                    <Text style={{ color: '#34d399', fontSize: 9, fontFamily: F.bold }}>SECURE SANDBOX</Text>
                  </View>
                </View>

                {/* Cropping middle container */}
                <View style={{
                  position: 'absolute',
                  top: 45,
                  bottom: 35,
                  left: 0,
                  right: 0,
                  overflow: 'hidden',
                  backgroundColor: '#000',
                  zIndex: 10,
                }}>
                  <WebView
                    originWhitelist={['*']}
                    source={{ uri: embedUrl }}
                    style={{
                      position: 'absolute',
                      top: -45,
                      left: 0,
                      right: 0,
                      height: 210,
                      backgroundColor: '#000',
                    }}
                    injectedJavaScript={injectedJavaScript}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowsFullscreenVideo={true}
                    mediaPlaybackRequiresUserAction={false}
                    onShouldStartLoadWithRequest={(request) => {
                      if (
                        request.url.includes('/preview') || 
                        request.url.includes('/embed/') || 
                        request.url.includes('youtube.com/embed/') || 
                        request.url.includes('googleusercontent.com')
                      ) {
                        return true;
                      }
                      if (request.url.includes('drive.google.com/file/d/') && !request.url.includes('/preview')) {
                        return false;
                      }
                      return true;
                    }}
                  />
                </View>

                {/* Custom secure bottom bar masking Google buttons */}
                <View style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 35,
                  backgroundColor: '#0a0a0a',
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.08)',
                  zIndex: 30,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 12,
                }}>
                  <Text style={{ fontSize: 10, color: '#a1a1aa', fontFamily: F.medium }}>
                    🔒 Controls are protected online
                  </Text>
                  <Text style={{ fontSize: 8, color: '#71717a', fontFamily: F.mono, letterSpacing: 1 }}>
                    SECURE CONTEXT
                  </Text>
                </View>
              </View>
            ) : (
              <WebView
                originWhitelist={['*']}
                source={{ uri: embedUrl }}
                style={{ flex: 1, backgroundColor: '#000' }}
                injectedJavaScript={injectedJavaScript}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsFullscreenVideo={true}
                mediaPlaybackRequiresUserAction={false}
                onShouldStartLoadWithRequest={(request) => {
                  if (
                    request.url.includes('/preview') || 
                    request.url.includes('/embed/') || 
                    request.url.includes('youtube.com/embed/') || 
                    request.url.includes('googleusercontent.com')
                  ) {
                    return true;
                  }
                  if (request.url.includes('drive.google.com/file/d/') && !request.url.includes('/preview')) {
                    return false;
                  }
                  return true;
                }}
              />
            )
          ) : (
            <View style={s.noVideoPlaceholder}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🎥</Text>
              <Text style={{ color: C.inkLight, fontFamily: F.bold }}>Loading Video Stream...</Text>
            </View>
          )}
        </View>

        <View style={s.details}>
          <View style={s.tags}>
            <View style={[s.tag, { backgroundColor: C.tagBg || C.bgAlt }]}>
              <Text style={[s.tagText, { color: C.tagText || C.inkMid }]}>
                {note?.type ? note.type.toUpperCase() : 'VIDEO LESSON'}
              </Text>
            </View>
            <View style={[s.tag, { backgroundColor: C.tagBg || C.bgAlt }]}>
              <Text style={[s.tagText, { color: C.tagText || C.inkMid }]}>Core Concept</Text>
            </View>
          </View>

          <Text style={[s.title, { color: C.ink }]}>{note?.title || title}</Text>
          
          <Text style={[s.desc, { color: C.inkMid }]}>
            {note?.summary || note?.description || 
              "This lecture covers intermediate course content. We will explore key theoretical modules, solve standard formulas step-by-step, and solidify core concepts with interactive checkers."
            }
          </Text>

          {/* Dynamic Interactive Concept Quizzing */}
          {loadingQuestions ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={C.ink} />
              <Text style={{ marginTop: 8, color: C.inkLight, fontFamily: F.medium, fontSize: 13 }}>Loading Concept check...</Text>
            </View>
          ) : questions.length > 0 ? (
            <View style={s.quizSection}>
              <View style={[s.divider, { backgroundColor: C.border }]} />
              <View style={s.quizHeader}>
                <Text style={[s.quizMainTitle, { color: C.ink }]}>Concept Check Quiz</Text>
                <Text style={[s.quizCount, { color: C.inkLight }]}>{questions.length} QUESTIONS</Text>
              </View>

              {questions.map((q, idx) => {
                // Stabilize sorting of option answers alphabetically
                const options = useMemo(() => {
                  return [...q.incorrectAnswers, q.correctAnswer].sort();
                }, [q]);

                return (
                  <View key={q.id} style={[s.qCard, { backgroundColor: C.surface, borderColor: C.border }]}>
                    <Text style={[s.qIdxText, { color: C.inkLight }]}>QUESTION {idx + 1}</Text>
                    <Text style={[s.qText, { color: C.ink }]}>{q.text}</Text>

                    <View style={s.optionsList}>
                      {options.map((opt, oIdx) => {
                        const isSelected = userAnswers[q.id] === opt;
                        const isCorrectAnswer = opt === q.correctAnswer;
                        
                        let cardBg = C.surface;
                        let borderC = C.border;
                        let textC = C.inkMid;

                        if (showResults) {
                          if (isCorrectAnswer) {
                            cardBg = '#E8F6EF';
                            borderC = '#27AE60';
                            textC = '#27AE60';
                          } else if (isSelected) {
                            cardBg = '#FCE8E6';
                            borderC = '#E74C3C';
                            textC = '#E74C3C';
                          } else {
                            cardBg = C.bgAlt;
                            borderC = 'transparent';
                            textC = C.inkLight;
                          }
                        } else if (isSelected) {
                          cardBg = C.bgAlt;
                          borderC = C.ink;
                          textC = C.ink;
                        }

                        return (
                          <TouchableOpacity
                            key={oIdx}
                            style={[s.optionBtn, { backgroundColor: cardBg, borderColor: borderC }]}
                            onPress={() => {
                              if (!showResults) {
                                setUserAnswers(prev => ({ ...prev, [q.id]: opt }));
                              }
                            }}
                            activeOpacity={0.7}
                            disabled={showResults}
                          >
                            <Text style={[s.optionText, { color: textC }, isSelected && { fontFamily: F.bold }]}>
                              {showResults && isCorrectAnswer ? '✓ ' : showResults && isSelected ? '✗ ' : isSelected ? '● ' : '○ '}
                              {opt}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              {!showResults ? (
                <TouchableOpacity 
                  style={[s.submitQuizBtn, { backgroundColor: C.ink }]}
                  onPress={handleQuizSubmit}
                  activeOpacity={0.85}
                >
                  <Text style={[s.submitQuizBtnText, { color: C.bg }]}>SUBMIT MINI-QUIZ</Text>
                </TouchableOpacity>
              ) : (
                <View style={[s.scoreCard, { backgroundColor: C.bgAlt, borderColor: C.border }]}>
                  <Text style={[s.scorePercentage, { color: C.ink }]}>
                    {Math.round((calculateScore() / questions.length) * 100)}%
                  </Text>
                  <Text style={[s.scoreSummary, { color: C.inkMid }]}>
                    You got {calculateScore()} of {questions.length} questions correct!
                  </Text>
                  <TouchableOpacity
                    style={[s.retryBtn, { borderColor: C.border }]}
                    onPress={() => {
                      setShowResults(false);
                      setUserAnswers({});
                    }}
                  >
                    <Text style={[s.retryBtnText, { color: C.ink }]}>Try Again</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={[s.footer, { backgroundColor: C.surface, borderTopColor: C.border }]}>
         <TouchableOpacity 
           style={[s.primaryBtn, { backgroundColor: C.ink }]} 
           activeOpacity={0.9}
           onPress={() => router.push('/cbt-setup')}
         >
           <Text style={[s.primaryBtnText, { color: C.bg }]}>EVALUATE YOURSELF</Text>
         </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (C: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 18, letterSpacing: 2 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  content: { flex: 1 },
  videoPlayer: { width: width - 32, height: 210, alignSelf: 'center', marginTop: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  noVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  details: { padding: 20 },
  tags: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontFamily: F.bold, fontSize: 12 },
  
  title: { fontFamily: F.bold, fontSize: 24, marginBottom: 16, lineHeight: 30 },
  desc: { fontFamily: F.medium, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  
  divider: { height: 1, marginVertical: 24 },

  footer: { padding: 20, borderTopWidth: 1 },
  primaryBtn: { borderRadius: 16, height: 60, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontFamily: F.bold, fontSize: 15, letterSpacing: 1 },

  // Interactive Quiz Styles
  quizSection: { marginTop: 12 },
  quizHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 },
  quizMainTitle: { fontFamily: F.bold, fontSize: 18 },
  quizCount: { fontFamily: F.bold, fontSize: 10, letterSpacing: 1 },

  qCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  qIdxText: { fontFamily: F.bold, fontSize: 11, letterSpacing: 1.2, marginBottom: 8 },
  qText: { fontFamily: F.bold, fontSize: 16, lineHeight: 22, marginBottom: 16 },
  optionsList: { gap: 10 },
  optionBtn: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  optionText: {
    fontFamily: F.medium,
    fontSize: 14,
  },
  submitQuizBtn: {
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  submitQuizBtnText: {
    fontFamily: F.bold,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  scoreCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  scorePercentage: {
    fontFamily: F.bold,
    fontSize: 40,
    marginBottom: 6,
  },
  scoreSummary: {
    fontFamily: F.medium,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 120,
    alignItems: 'center',
  },
  retryBtnText: {
    fontFamily: F.bold,
    fontSize: 13,
  },
});
