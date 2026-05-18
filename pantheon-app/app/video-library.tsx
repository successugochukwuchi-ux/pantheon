import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HamburgerIcon, BellIcon, ChevronDownIcon, MoreIcon } from '../components/Icons';
import { C, F, width } from '../components/Theme';
import { BottomNav } from '../components/BottomNav';

interface Video {
  id: string;
  title: string;
  duration: string;
  views: string;
  rating?: number;
  status?: 'Completed' | 'New' | 'In Progress';
  description: string;
  thumbnail: string;
}

const VIDEOS: Video[] = [
  {
    id: '1',
    title: 'Introduction to Classical Mechanics',
    duration: '12:45',
    views: '2.4k',
    rating: 4.9,
    description: 'Fundamental laws of motion and Newtonian physics applied to everyday systems.',
    thumbnail: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&auto=format&fit=crop',
  },
  {
    id: '2',
    title: 'Vector Addition & Subtraction',
    duration: '08:20',
    views: '1.8k',
    status: 'Completed',
    description: 'Mastering directional magnitudes in two and three dimensional space using standard notation.',
    thumbnail: 'https://images.unsplash.com/photo-1632605914539-a46a3c217559?w=800&auto=format&fit=crop',
  },
  {
    id: '3',
    title: 'Circular Motion Principles',
    duration: '24:15',
    views: '3.1k',
    status: 'New',
    description: 'Centripetal force, angular velocity, and uniform circular movement in mechanical systems.',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop',
  },
  {
    id: '4',
    title: 'Work, Energy, and Power',
    duration: '15:30',
    views: '950',
    description: 'Conservation laws and kinetic versus potential energy transformations in dynamics.',
    thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop',
  },
];

export default function VideoLibraryScreen() {
  const router = useRouter();
  const [course, setCourse] = useState('PHY 101');

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn}>
          <HamburgerIcon />
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/notifications')}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.courseSelectorWrapper}>
           <Text style={s.label}>SELECT COURSE</Text>
           <TouchableOpacity style={s.courseSelector} activeOpacity={0.7}>
              <Text style={s.courseText}>{course}</Text>
              <ChevronDownIcon />
           </TouchableOpacity>
        </View>

        <View style={s.sectionHeader}>
           <Text style={s.sectionTitle}>Video Lessons</Text>
           <Text style={s.count}>12 LESSONS</Text>
        </View>

        <View style={s.videoList}>
          {VIDEOS.map((v) => (
            <TouchableOpacity 
              key={v.id} 
              style={s.videoCard} 
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: '/video-viewer', params: { title: v.title } })}
            >
              <View style={s.thumbnailWrapper}>
                <Image source={{ uri: v.thumbnail }} style={s.thumbnail} />
                <View style={s.durationBadge}>
                  <Text style={s.durationText}>{v.duration}</Text>
                </View>
              </View>
              
              <View style={s.cardBody}>
                <View style={s.titleRow}>
                  <Text style={s.videoTitle} numberOfLines={1}>{v.title}</Text>
                  <MoreIcon color="#999" />
                </View>
                <Text style={s.videoDesc} numberOfLines={2}>{v.description}</Text>
                
                <View style={s.metaRow}>
                  <View style={s.badge}>
                    <Text style={s.badgeIcon}>👁</Text>
                    <Text style={s.badgeText}>{v.views} views</Text>
                  </View>
                  
                  {v.rating && (
                     <View style={s.badge}>
                       <Text style={s.badgeIcon}>☆</Text>
                       <Text style={s.badgeText}>{v.rating}</Text>
                     </View>
                  )}

                  {v.status && (
                     <View style={[s.badge, v.status === 'Completed' && { backgroundColor: '#E8F6EF' }]}>
                        {v.status === 'Completed' && <Text style={{ color: '#27AE60', marginRight: 4 }}>✓</Text>}
                        <Text style={[s.badgeText, v.status === 'Completed' && { color: '#27AE60' }]}>{v.status}</Text>
                     </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.surface,
  },
  headerBrand: { fontFamily: F.bold, fontSize: 18, color: C.ink, letterSpacing: 2 },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  
  content: { flex: 1 },
  courseSelectorWrapper: { padding: 16, backgroundColor: '#F9F8FD' },
  label: { fontFamily: F.bold, fontSize: 11, color: C.inkLight, letterSpacing: 1.2, marginBottom: 8 },
  courseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  courseText: { fontFamily: F.bold, fontSize: 18, color: C.ink },
  
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: { fontFamily: F.bold, fontSize: 22, color: C.ink },
  count: { fontFamily: F.bold, fontSize: 10, color: C.inkLight, letterSpacing: 1 },

  videoList: { paddingHorizontal: 16, gap: 20 },
  videoCard: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  thumbnailWrapper: { height: 180, width: '100%' },
  thumbnail: { width: '100%', height: '100%', backgroundColor: '#eee' },
  durationBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: { color: '#fff', fontSize: 11, fontFamily: F.bold },
  
  cardBody: { padding: 16 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  videoTitle: { flex: 1, fontFamily: F.bold, fontSize: 18, color: C.ink },
  videoDesc: { fontFamily: F.medium, fontSize: 13, color: C.inkMid, lineHeight: 19, marginBottom: 16 },
  
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F2EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeIcon: { fontSize: 12, color: C.inkLight, marginRight: 4 },
  badgeText: { fontFamily: F.bold, fontSize: 11, color: C.inkMid },
});
