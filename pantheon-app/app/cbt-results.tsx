import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

const C = {
  bg: '#F0EFF5',
  surface: '#FFFFFF',
  surfaceDark: '#0A0A0A',
  ink: '#0A0A0A',
  inkMid: '#555555',
  inkLight: '#888888',
  border: '#DEDDE4',
  pill: '#E8E6E0',
  pillText: '#4A4A4A',
  navInactive: '#AAAAAA',
  correct: '#1A7A4A',
  correctBg: '#E6F9EE',
  wrong: '#C0392B',
  wrongBg: '#FDECEC',
  gold: '#C8A96E',
};

const F = {
  display: 'DMSerifDisplay_400Regular',
  body: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function formatTime(s: number) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }

function getGrade(pct: number): { label: string; sub: string } {
  if (pct >= 90) return { label: 'Outstanding!', sub: 'You are in the top 5% of students this week.' };
  if (pct >= 80) return { label: 'Excellent Work!', sub: `You have performed better than ${Math.floor(pct - 10)}% of students in the Engineering department this week.` };
  if (pct >= 70) return { label: 'Great Job!', sub: 'Keep pushing — you\'re above average.' };
  if (pct >= 60) return { label: 'Good Effort!', sub: 'You\'re improving. Review your corrections.' };
  if (pct >= 50) return { label: 'Keep Studying!', sub: 'You passed, but there\'s room to grow.' };
  return { label: 'Needs Improvement', sub: 'Review the topics and try again. You\'ve got this.' };
}

// ── Circular Score ─────────────────────────────────────────────────────────────
function CircleScore({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? correct / total : 0;
  const animPct = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animPct, { toValue: pct, duration: 1200, useNativeDriver: false }).start();
  }, []);

  // SVG-style circle using border trick
  const size = 160;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <View style={s.circleWrap}>
      {/* Background ring */}
      <View style={[s.ring, s.ringBg, { width: size, height: size, borderRadius: size / 2, borderWidth: stroke }]} />
      {/* Animated fill ring — we use a rotation mask approach */}
      <View style={[s.ring, { width: size, height: size, borderRadius: size / 2 }]}>
        <Animated.View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: stroke,
            borderColor: C.ink,
            borderRightColor: 'transparent',
            borderBottomColor: 'transparent',
            position: 'absolute',
            transform: [
              {
                rotate: animPct.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: ['-45deg', '135deg', '315deg'],
                }),
              },
            ],
          }}
        />
        {pct > 0.5 && (
          <Animated.View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: stroke,
              borderColor: C.ink,
              borderLeftColor: 'transparent',
              borderTopColor: 'transparent',
              position: 'absolute',
              transform: [{ rotate: '-45deg' }],
              opacity: animPct.interpolate({ inputRange: [0.5, 0.51], outputRange: [0, 1] }),
            }}
          />
        )}
      </View>

      {/* Center text */}
      <View style={s.circleCenter}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <Text style={s.scoreNum}>{correct}</Text>
          <Text style={s.scoreTotal}>/{total}</Text>
        </View>
        <Text style={s.scoreLabel}>SCORE</Text>
      </View>
    </View>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  iconChild,
  label,
  value,
  delay,
}: {
  iconChild: React.ReactNode;
  label: string;
  value: string;
  delay: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.statCard, { opacity, transform: [{ translateY: y }] }]}>
      <View style={s.statIcon}>{iconChild}</View>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </Animated.View>
  );
}

// ── Bottom Nav ─────────────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: C.navInactive }} />
      <View style={{ width: 13, height: 9, backgroundColor: C.navInactive, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
    </View>
  );
}
function NotesIcon() {
  return (
    <View style={{ width: 16, height: 18, borderWidth: 1.8, borderColor: C.navInactive, borderRadius: 3, justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      {[0, 1, 2].map(i => <View key={i} style={{ width: 9, height: 1.5, backgroundColor: C.navInactive, borderRadius: 1 }} />)}
    </View>
  );
}
function CbtActiveIcon() {
  return (
    <View style={{ width: 20, height: 16, gap: 3 }}>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#fff' }} />
        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#fff' }} />
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {[0,1,2].map(i => <View key={i} style={{ width: 4, height: 4, borderRadius: 1, backgroundColor: '#fff' }} />)}
      </View>
    </View>
  );
}
function ProfileIcon() {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <View style={{ width: 11, height: 11, borderRadius: 5.5, borderWidth: 1.8, borderColor: C.navInactive }} />
      <View style={{ width: 16, height: 6, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 1.8, borderColor: C.navInactive, borderBottomWidth: 0 }} />
    </View>
  );
}
function BottomNav() {
  const router = useRouter();
  return (
    <View style={s.bottomNav}>
      <TouchableOpacity style={s.navTab} onPress={() => router.push('/dashboard')} activeOpacity={0.7}>
        <HomeIcon /><Text style={s.navLabel}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.navTab} onPress={() => router.push('/notes')} activeOpacity={0.7}>
        <NotesIcon /><Text style={s.navLabel}>Notes</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[s.navTab, s.navTabActive]} activeOpacity={0.7}>
        <CbtActiveIcon />
      </TouchableOpacity>
      <TouchableOpacity style={s.navTab} activeOpacity={0.7}>
        <ProfileIcon /><Text style={s.navLabel}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CbtResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    courseId: string; total: string; correct: string; elapsed: string; answers: string;
  }>();

  const total = parseInt(params.total) || 50;
  const correct = parseInt(params.correct) || 0;
  const elapsed = parseInt(params.elapsed) || 0;
  const wrong = total - correct;
  const pct = Math.round((correct / total) * 100);
  const courseLabel = (params.courseId ?? 'mth101').toUpperCase().replace(/([a-z]+)(\d+)/, '$1 $2');
  const grade = getGrade(pct);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY = useRef(new Animated.Value(-20)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerY, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.push('/cbt-setup')} activeOpacity={0.7} style={s.iconBtn}>
          <View style={s.backArrow} />
          <View style={s.backArrowHead} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Practice Results</Text>
        <TouchableOpacity activeOpacity={0.7} style={s.iconBtn}>
          <View style={s.bellBody} />
          <View style={s.bellBase} />
          <View style={s.bellClapper} />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Score card */}
        <Animated.View style={[s.scoreCard, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}>
          <View style={s.courseBadge}>
            <Text style={s.courseBadgeText}>{courseLabel}</Text>
          </View>

          <CircleScore correct={correct} total={total} />

          <Text style={s.gradeLabel}>{grade.label}</Text>
          <Text style={s.gradeSub}>{grade.sub}</Text>
        </Animated.View>

        {/* Stat cards */}
        <StatCard
          delay={200}
          iconChild={
            <View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 14 }}>⏱</Text>
            </View>
          }
          label="Time Spent"
          value={formatTime(elapsed)}
        />

        <StatCard
          delay={300}
          iconChild={
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: C.correct }}>✓</Text>
            </View>
          }
          label="Correct"
          value={`${correct} Answers`}
        />

        <StatCard
          delay={400}
          iconChild={
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: C.wrong }}>✕</Text>
            </View>
          }
          label="Incorrect"
          value={`${wrong} Answers`}
        />

        {/* Percentage bar */}
        <View style={s.pctCard}>
          <View style={s.pctRow}>
            <Text style={s.pctLabel}>ACCURACY</Text>
            <Text style={s.pctValue}>{pct}%</Text>
          </View>
          <View style={s.pctTrack}>
            <Animated.View
              style={[
                s.pctFill,
                {
                  width: `${pct}%`,
                  backgroundColor: pct >= 70 ? C.correct : pct >= 50 ? C.gold : C.wrong,
                },
              ]}
            />
          </View>
        </View>

        {/* Action buttons */}
        <TouchableOpacity style={s.reviewBtn} activeOpacity={0.88}>
          <Text style={s.reviewIcon}>≡✕</Text>
          <Text style={s.reviewBtnText}>Review Corrections</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.retakeBtn}
          activeOpacity={0.85}
          onPress={() => router.push('/cbt-setup')}
        >
          <Text style={s.retakeIcon}>↺</Text>
          <Text style={s.retakeBtnText}>Retake Practice</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.dashboardLink}
          activeOpacity={0.7}
          onPress={() => router.push('/dashboard')}
        >
          <Text style={s.dashboardLinkIcon}>⊞</Text>
          <Text style={s.dashboardLinkText}>Back to Dashboard</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg,
  },
  headerTitle: { fontFamily: F.bold, fontSize: 17, color: C.ink, letterSpacing: 0.3 },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backArrow: { position: 'absolute', width: 16, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  backArrowHead: { position: 'absolute', left: 0, width: 9, height: 9, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] },
  bellBody: { width: 14, height: 13, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 2, borderColor: C.ink, borderBottomWidth: 0 },
  bellBase: { width: 20, height: 2, backgroundColor: C.ink, borderRadius: 1 },
  bellClapper: { width: 6, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 2, borderColor: C.ink, borderTopWidth: 0, marginTop: -1, alignSelf: 'center' },

  // Score card
  scoreCard: {
    backgroundColor: C.surface, borderRadius: 20, borderWidth: 1, borderColor: C.border,
    padding: 24, alignItems: 'center', marginTop: 16, marginBottom: 12,
  },
  courseBadge: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: C.ink, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  courseBadgeText: { fontFamily: F.bold, fontSize: 11, color: '#fff' },
  gradeLabel: { fontFamily: F.display, fontSize: 26, color: C.ink, marginTop: 16, marginBottom: 8 },
  gradeSub: { fontFamily: F.body, fontSize: 14, color: C.inkMid, textAlign: 'center', lineHeight: 20 },

  // Circle
  circleWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ring: { position: 'absolute' },
  ringBg: { borderColor: C.border },
  circleCenter: { alignItems: 'center' },
  scoreNum: { fontFamily: F.display, fontSize: 40, color: C.ink },
  scoreTotal: { fontFamily: F.medium, fontSize: 20, color: C.inkMid, marginBottom: 4 },
  scoreLabel: { fontFamily: F.bold, fontSize: 10, color: C.inkLight, letterSpacing: 2, marginTop: 2 },

  // Stat cards
  statCard: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border,
    padding: 16, marginBottom: 10,
  },
  statIcon: { marginBottom: 12 },
  statLabel: { fontFamily: F.medium, fontSize: 13, color: C.inkMid, marginBottom: 4 },
  statValue: { fontFamily: F.display, fontSize: 22, color: C.ink },

  // Pct card
  pctCard: {
    backgroundColor: C.surface, borderRadius: 16, borderWidth: 1,
    borderColor: C.border, padding: 16, marginBottom: 18,
  },
  pctRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  pctLabel: { fontFamily: F.bold, fontSize: 11, color: C.inkLight, letterSpacing: 1.5 },
  pctValue: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  pctTrack: { height: 8, backgroundColor: C.border, borderRadius: 99, overflow: 'hidden' },
  pctFill: { height: '100%', borderRadius: 99 },

  // Buttons
  reviewBtn: {
    backgroundColor: C.ink, borderRadius: 14, paddingVertical: 18,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    marginBottom: 12,
  },
  reviewIcon: { fontSize: 16, color: '#fff' },
  reviewBtnText: { fontFamily: F.medium, fontSize: 16, color: '#fff' },
  retakeBtn: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingVertical: 18,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    marginBottom: 16,
  },
  retakeIcon: { fontSize: 18, color: C.inkMid },
  retakeBtnText: { fontFamily: F.medium, fontSize: 16, color: C.ink },
  dashboardLink: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 8 },
  dashboardLinkIcon: { fontSize: 16, color: C.inkMid },
  dashboardLinkText: { fontFamily: F.medium, fontSize: 14, color: C.inkMid },

  // Bottom Nav
  bottomNav: {
    position: 'absolute', bottom: 24, left: 16, right: 16,
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 40, paddingVertical: 10, paddingHorizontal: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 8,
    borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'space-around',
  },
  navTab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 3, borderRadius: 30 },
  navTabActive: { backgroundColor: C.surfaceDark, paddingHorizontal: 20, flex: 0, paddingVertical: 10, minWidth: 60 },
  navLabel: { fontFamily: F.medium, fontSize: 11, color: C.navInactive },

  inkMid: C.inkMid,
});
