import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomNav } from '../components/BottomNav';
import { C, F } from '../components/Theme';

// ── Icons ────────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <View style={{ width: 24, height: 18, justifyContent: 'space-between' }}>
      <View style={{ height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: C.ink, width: '70%', borderRadius: 1 }} />
      <View style={{ height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
    </View>
  );
}

function BellIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 18, height: 20, borderWidth: 2, borderColor: C.ink, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
      <View style={{ width: 8, height: 3, backgroundColor: C.ink, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, marginTop: -2 }} />
      <View style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#000', borderWidth: 1, borderColor: C.bg }} />
    </View>
  );
}

function DatabaseIcon() {
  return (
    <View style={{ width: 28, height: 28 }}>
      <View style={{ width: 24, height: 8, borderRadius: 4, borderWidth: 2, borderColor: C.ink }} />
      <View style={{ width: 24, height: 8, borderRadius: 4, borderWidth: 2, borderColor: C.ink, marginTop: -2 }} />
      <View style={{ width: 24, height: 8, borderRadius: 4, borderWidth: 2, borderColor: C.ink, marginTop: -2 }} />
    </View>
  );
}

function TrashIcon() {
  return (
    <View style={{ width: 44, height: 44, backgroundColor: '#F5F5F5', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E4DE' }}>
      <View style={{ width: 14, height: 2, backgroundColor: '#8E8E8E', borderRadius: 1, marginBottom: 2 }} />
      <View style={{ width: 12, height: 14, borderWidth: 1.5, borderColor: '#8E8E8E', borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
    </View>
  );
}

function DownloadIcon() {
  return (
    <View style={{ width: 16, height: 16, marginRight: 6 }}>
      <View style={{ position: 'absolute', bottom: 0, width: 16, height: 2, backgroundColor: '#fff', borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 7, top: 2, width: 2, height: 10, backgroundColor: '#fff', borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 4, top: 7, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#fff', transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

function CheckCircleIcon() {
  return (
    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#000', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
      <View style={{ width: 8, height: 4, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#000', transform: [{ rotate: '-45deg' }, { translateY: -1 }] }} />
    </View>
  );
}

function CloudIcon() {
  return (
    <View style={{ width: 24, height: 24, marginRight: 12 }}>
      <View style={{ position: 'absolute', bottom: 4, left: 4, width: 16, height: 10, borderWidth: 2, borderColor: C.inkMid, borderRadius: 5 }} />
      <View style={{ position: 'absolute', top: 5, left: 8, width: 8, height: 8, borderWidth: 2, borderColor: C.inkMid, borderRadius: 4, backgroundColor: C.bg }} />
    </View>
  );
}

// ── Components ───────────────────────────────────────────────────────────────

function CourseItem({ code, size, type, isDownloaded }: { code: string; size: string; type: string; isDownloaded?: boolean }) {
  return (
    <View style={[s.courseCard, !isDownloaded && s.courseCardAvailable]}>
      <View style={s.courseIcon}>
        <Text style={s.courseIconText}>{code.substring(0, 3)}</Text>
      </View>
      <View style={s.courseInfo}>
        <Text style={s.courseCodeText}>{code}</Text>
        <Text style={s.courseMetaText}>{size} • {type}</Text>
      </View>
      {isDownloaded ? (
        <TouchableOpacity activeOpacity={0.7}>
          <TrashIcon />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={s.getBtn} activeOpacity={0.8}>
          <DownloadIcon />
          <Text style={s.getBtnText}>Get</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function NoteGrabberScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerIcon}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={s.logoText}>PANTHEON</Text>
        <TouchableOpacity onPress={() => router.push('/notifications')} style={s.headerIcon}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={s.statusSection}>
          <Text style={s.statusLabel}>STATUS</Text>
          <Text style={s.statusHeading}>Current Semester: Rainy Semester 2025/2026</Text>
        </View>

        {/* Storage Card */}
        <View style={s.storageCard}>
          <View style={s.storageHeader}>
            <View>
              <Text style={s.storageSub}>Local Resources</Text>
              <Text style={s.storageTitle}>Total Offline Storage: 1.2 GB</Text>
            </View>
            <DatabaseIcon />
          </View>
          
          <View style={s.progressContainer}>
            <View style={s.progressBarBg}>
              <View style={[s.progressBarFill, { width: '45%' }]} />
            </View>
            <View style={s.progressStats}>
              <Text style={s.progressText}>450 MB Used</Text>
              <Text style={s.progressText}>2.0 GB Limit</Text>
            </View>
          </View>
        </View>

        {/* Downloaded Section */}
        <View style={s.sectionHeader}>
          <CheckCircleIcon />
          <Text style={s.sectionHeaderText}>Downloaded Courses</Text>
        </View>

        <CourseItem code="MTH 101" size="245 MB" type="PDF & Audio" isDownloaded />
        <CourseItem code="PHY 101" size="180 MB" type="PDF Notes" isDownloaded />

        {/* Available Section */}
        <View style={s.sectionHeader}>
          <CloudIcon />
          <Text style={s.sectionHeaderText}>Available Courses</Text>
        </View>

        <CourseItem code="CHM 101" size="320 MB" type="Full Package" />
        <CourseItem code="GST 101" size="50 MB" type="Text Only" />
        <CourseItem code="MTH 103" size="195 MB" type="Video & PDF" />

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="notes" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EEE5',
  },
  headerIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: F.bold, fontSize: 24, letterSpacing: -1, color: '#000' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },

  statusSection: { marginBottom: 24 },
  statusLabel: { fontFamily: F.bold, fontSize: 13, color: C.inkMid, letterSpacing: 1, marginBottom: 6 },
  statusHeading: { fontFamily: F.bold, fontSize: 28, color: C.ink, lineHeight: 34 },

  storageCard: {
    backgroundColor: C.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: C.border,
    padding: 24,
    marginBottom: 32,
  },
  storageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  storageSub: { fontFamily: F.medium, fontSize: 15, color: C.inkMid, marginBottom: 4 },
  storageTitle: { fontFamily: F.bold, fontSize: 26, color: C.ink },

  progressContainer: {},
  progressBarBg: { height: 12, backgroundColor: '#E5E4DE', borderRadius: 6, marginBottom: 10, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#000', borderRadius: 6 },
  progressStats: { flexDirection: 'row', justifyContent: 'space-between' },
  progressText: { fontFamily: F.bold, fontSize: 13, color: C.inkMid },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8 },
  sectionHeaderText: { fontFamily: F.bold, fontSize: 24, color: C.ink },

  courseCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  courseCardAvailable: { backgroundColor: 'rgba(255,255,255,0.4)', borderWidth: 0 },
  courseIcon: { width: 60, height: 60, backgroundColor: '#000', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  courseIconText: { fontFamily: F.bold, fontSize: 16, color: '#fff' },
  courseInfo: { flex: 1 },
  courseCodeText: { fontFamily: F.bold, fontSize: 18, color: C.ink, marginBottom: 2 },
  courseMetaText: { fontFamily: F.medium, fontSize: 14, color: C.inkMid },

  getBtn: {
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  getBtnText: { fontFamily: F.bold, fontSize: 14, color: '#fff' },
});
