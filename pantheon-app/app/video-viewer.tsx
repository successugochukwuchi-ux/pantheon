import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BellIcon } from '../components/Icons';
import { C, F } from '../components/Theme';

const { width } = Dimensions.get('window');

function BackIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center' }}>
      <View style={{ width: 12, height: 12, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }, { translateX: 2 }] }} />
    </View>
  );
}

function PlayIconBig() {
  return (
    <View style={s.playBtnBig}>
      <View style={s.playTriangle} />
    </View>
  );
}

export default function VideoViewerScreen() {
  const router = useRouter();
  const { title = "Introduction to Bernoulli's Principle" } = useLocalSearchParams();

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <BackIcon />
        </TouchableOpacity>
        <Text style={s.headerBrand}>PANTHEON</Text>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.push('/notifications')}>
          <BellIcon />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.content} showsVerticalScrollIndicator={false}>
        {/* Video Player Mock */}
        <View style={s.videoPlayer}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop' }} 
            style={s.videoPoster}
            blurRadius={2}
          />
          <View style={s.videoOverlay}>
            <PlayIconBig />
          </View>
        </View>

        <View style={s.details}>
          <View style={s.tags}>
            <View style={s.tag}><Text style={s.tagText}>ENG 201</Text></View>
            <View style={s.tag}><Text style={s.tagText}>Fluid Mechanics</Text></View>
          </View>

          <Text style={s.title}>{title}</Text>
          
          <Text style={s.desc}>
            This lecture covers the fundamental concepts of Bernoulli's equation as it applies to steady, 
            incompressible flows. We explore the relationship between pressure, velocity, and elevation 
            in flowing fluids, providing the mathematical framework necessary for complex engineering calculations.
          </Text>

          <View style={s.metaRow}>
             <View style={s.metaItem}>
                <Text style={s.metaIcon}>👤</Text>
                <Text style={s.metaText}>Dr. N. O. Okoro</Text>
             </View>
             <View style={s.metaItem}>
                <Text style={s.metaIcon}>📅</Text>
                <Text style={s.metaText}>Oct 24, 2023</Text>
             </View>
          </View>

          <View style={s.divider} />

          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7}>
             <View style={s.actionIconBox}>
                <Text style={{ fontSize: 20 }}>📄</Text>
             </View>
             <View style={s.actionInfo}>
                <Text style={s.actionTitle}>Lecture Notes</Text>
                <Text style={s.actionSub}>PDF • 2.4 MB</Text>
             </View>
             <Text style={s.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.actionBtn} activeOpacity={0.7}>
             <View style={s.actionIconBox}>
                <Text style={{ fontSize: 20 }}>💬</Text>
             </View>
             <View style={s.actionInfo}>
                <Text style={s.actionTitle}>Student Discussion</Text>
                <Text style={s.actionSub}>14 ACTIVE THREADS</Text>
             </View>
             <Text style={s.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <View style={s.footer}>
         <TouchableOpacity 
           style={s.primaryBtn} 
           activeOpacity={0.9}
           onPress={() => router.push('/cbt-setup')}
         >
           <Text style={s.primaryBtnText}>EVALUATE YOURSELF</Text>
         </TouchableOpacity>
      </View>
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
  videoPlayer: { width: width - 32, height: 210, alignSelf: 'center', marginTop: 20, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' },
  videoPoster: { width: '100%', height: '100%', opacity: 0.4 },
  videoOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  playBtnBig: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  playTriangle: { width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid', borderLeftWidth: 16, borderTopWidth: 10, borderBottomWidth: 10, borderLeftColor: '#fff', borderTopColor: 'transparent', borderBottomColor: 'transparent', marginLeft: 4 },

  details: { padding: 20 },
  tags: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  tag: { backgroundColor: '#F3F2EE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontFamily: F.bold, fontSize: 12, color: C.inkMid },
  
  title: { fontFamily: F.bold, fontSize: 28, color: C.ink, marginBottom: 16, lineHeight: 34 },
  desc: { fontFamily: F.medium, fontSize: 15, color: C.inkMid, lineHeight: 24, marginBottom: 20 },
  
  metaRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaIcon: { fontSize: 16 },
  metaText: { fontFamily: F.medium, fontSize: 14, color: C.inkMid },

  divider: { height: 1, backgroundColor: C.border, marginBottom: 24 },

  actionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: C.surface, 
    borderRadius: 16, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: C.border, 
    marginBottom: 12 
  },
  actionIconBox: { width: 44, height: 44, backgroundColor: '#F9F8FD', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionInfo: { flex: 1, marginLeft: 16 },
  actionTitle: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  actionSub: { fontFamily: F.bold, fontSize: 10, color: C.inkLight, letterSpacing: 0.5, marginTop: 2 },
  actionArrow: { fontSize: 24, color: C.inkLight },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surface },
  primaryBtn: { backgroundColor: '#000', borderRadius: 16, height: 60, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontFamily: F.bold, fontSize: 15, color: '#fff', letterSpacing: 1 },
});
