import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { C, F } from '../components/Theme';

// ── Icons ────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', left: 5, width: 8, height: 8, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: C.ink, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function SearchIcon() {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, borderWidth: 1.8, borderColor: C.ink }} />
      <View style={{ position: 'absolute', right: 3, bottom: 3, width: 6, height: 2, backgroundColor: C.ink, borderRadius: 1, transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function MoreIcon() {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center', gap: 3 }}>
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.ink }} />
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.ink }} />
      <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: C.ink }} />
    </View>
  );
}

function PlusIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 16, height: 2, backgroundColor: C.ink, borderRadius: 1 }} />
      <View style={{ position: 'absolute', width: 2, height: 16, backgroundColor: C.ink, borderRadius: 1 }} />
    </View>
  );
}

function BookIcon() {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 14, height: 16, borderWidth: 1.5, borderColor: C.ink, borderRadius: 2 }} />
      <View style={{ position: 'absolute', width: 8, height: 1.5, backgroundColor: C.ink, top: 6 }} />
      <View style={{ position: 'absolute', width: 8, height: 1.5, backgroundColor: C.ink, top: 10 }} />
    </View>
  );
}

function EmojiIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.8, borderColor: C.ink }} />
      <View style={{ position: 'absolute', top: 8, left: 7, width: 2, height: 2, borderRadius: 1, backgroundColor: C.ink }} />
      <View style={{ position: 'absolute', top: 8, right: 7, width: 2, height: 2, borderRadius: 1, backgroundColor: C.ink }} />
      <View style={{ position: 'absolute', bottom: 6, width: 8, height: 4, borderBottomWidth: 1.5, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.ink, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} />
    </View>
  );
}

function SendIcon() {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 20, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#fff', transform: [{ rotate: '45deg' }, { translateY: 2 }, { translateX: -2 }] }} />
    </View>
  );
}

function NoteIcon() {
  return (
    <View style={{ width: 44, height: 44, backgroundColor: '#1A1C1E', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 18, height: 22, borderWidth: 1.8, borderColor: '#fff', borderRadius: 4 }}>
         <View style={{ width: 10, height: 1.8, backgroundColor: '#fff', marginTop: 6, marginLeft: 3 }} />
         <View style={{ width: 10, height: 1.8, backgroundColor: '#fff', marginTop: 4, marginLeft: 3 }} />
      </View>
      <View style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 6, height: 6, borderRightWidth: 1.5, borderTopWidth: 1.5, borderColor: '#000', transform: [{ rotate: '45deg' }, { translateX: -1 }, { translateY: 1 }] }} />
      </View>
    </View>
  );
}

function LinkArrowIcon() {
  return (
    <View style={{ width: 16, height: 16, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: '#8E8E8E', transform: [{ rotate: '45deg' }] }} />
    </View>
  );
}

function SeenIcon() {
  return (
    <View style={{ flexDirection: 'row', gap: -6 }}>
       <View style={{ width: 10, height: 6, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderColor: C.ink, transform: [{ rotate: '-45deg' }] }} />
       <View style={{ width: 10, height: 6, borderLeftWidth: 1.5, borderBottomWidth: 1.5, borderColor: C.ink, transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ChatRoomScreen() {
  const router = useRouter();
  const { groupName = 'MTH 101 Study Group', isGroup } = useLocalSearchParams();
  const [msg, setMsg] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStep, setReportStep] = useState<'reason' | 'detail' | 'success'>('reason');
  const [selectedReason, setSelectedReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');

  const isGroupChat = isGroup === 'true';

  const notes = [
    { id: '1', title: 'Calculus I: Fundamentals of Limits', course: 'MTH 101' },
    { id: '2', title: 'Calculus I: Differentiation Basics', course: 'MTH 101' },
    { id: '3', title: 'Mechanics: Kinematics', course: 'PHY 101' },
  ];

  const REPORT_REASONS = [
    'Bullying or Harassment',
    'Spam',
    'Hate Speech',
    'Academic Dishonesty',
    'Inappropriate Content',
    'Other'
  ];

  const handleReportSubmit = () => {
    setReportStep('success');
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Note Picker Modal */}
      <Modal visible={notePickerOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Reference Note</Text>
              <TouchableOpacity onPress={() => setNotePickerOpen(false)}>
                <Text style={s.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {notes.map(n => (
                <TouchableOpacity 
                   key={n.id} 
                   style={s.noteItem}
                   onPress={() => {
                     setMsg(prev => prev + ` [NOTE:${n.id}]`);
                     setNotePickerOpen(false);
                   }}
                >
                  <Text style={s.noteItemTitle}>{n.title}</Text>
                  <Text style={s.noteItemCourse}>{n.course}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Header */}

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerTitle}>{groupName}</Text>
          <Text style={s.headerStatus}>12 MEMBERS ONLINE</Text>
        </View>
        <View style={s.headerActions}>
           <TouchableOpacity style={s.headerIconBtn}><SearchIcon /></TouchableOpacity>
           <TouchableOpacity style={s.headerIconBtn} onPress={() => setMenuOpen(true)}><MoreIcon /></TouchableOpacity>
        </View>
      </View>

      {/* 3-Dot Menu Modal */}
      <Modal visible={menuOpen} transparent animationType="fade">
        <TouchableOpacity 
          style={s.menuOverlay} 
          activeOpacity={1} 
          onPress={() => setMenuOpen(false)}
        >
          <View style={s.menuContent}>
            {isGroupChat && (
              <TouchableOpacity 
                style={s.menuItem} 
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/add-members');
                }}
              >
                <Text style={s.menuItemText}>Invite Members</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={s.menuItem} 
              onPress={() => {
                setMenuOpen(false);
                setReportOpen(true);
                setReportStep('reason');
              }}
            >
              <Text style={[s.menuItemText, { color: '#E74C3C' }]}>Report {isGroupChat ? 'Group' : 'User'}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.menuItem, { borderBottomWidth: 0 }]} 
              onPress={() => setMenuOpen(false)}
            >
              <Text style={s.menuItemText}>Mute Notifications</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal visible={reportOpen} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Report {isGroupChat ? 'Group' : 'User'}</Text>
              <TouchableOpacity onPress={() => setReportOpen(false)}>
                <Text style={s.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>

            {reportStep === 'reason' && (
              <ScrollView>
                <Text style={s.reportSub}>Why are you reporting this?</Text>
                {REPORT_REASONS.map((r) => (
                  <TouchableOpacity 
                    key={r} 
                    style={s.reasonItem}
                    onPress={() => {
                      setSelectedReason(r);
                      setReportStep('detail');
                    }}
                  >
                    <Text style={s.reasonText}>{r}</Text>
                    <View style={s.reasonArrow} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {reportStep === 'detail' && (
              <View>
                <Text style={s.reportSub}>Provide more details (Optional)</Text>
                <Text style={[s.reasonText, { marginBottom: 12, opacity: 0.6 }]}>Reason: {selectedReason}</Text>
                <TextInput
                  style={s.reportInput}
                  placeholder="Tell us what happened..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  value={reportDetail}
                  onChangeText={setReportDetail}
                />
                <TouchableOpacity style={s.reportSubmitBtn} onPress={handleReportSubmit}>
                   <Text style={s.reportSubmitText}>Submit Report</Text>
                </TouchableOpacity>
              </View>
            )}

            {reportStep === 'success' && (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <View style={s.successCircle}>
                  <Text style={{ color: '#fff', fontSize: 24 }}>✓</Text>
                </View>
                <Text style={s.successTitle}>Report Submitted</Text>
                <Text style={s.successMsg}>
                  Thank you for helping keep Pantheon safe. Our moderators will review this information.
                </Text>
                <TouchableOpacity style={s.reportSubmitBtn} onPress={() => setReportOpen(false)}>
                   <Text style={s.reportSubmitText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        
        {/* Date Divider */}
        <View style={s.dateDivider}>
          <Text style={s.dateText}>TODAY, SEPTEMBER 14</Text>
        </View>

        {/* Message from Other */}
        <TouchableOpacity 
          style={s.msgWrapper} 
          onLongPress={() => setReplyingTo({ sender: 'Chidi Okafor', text: "Has anyone finished the MTH 101 assignment..." })}
          activeOpacity={0.9}
        >
          <Image source={{ uri: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=100&auto=format&fit=crop' }} style={s.msgAvatar} />
          <View style={s.msgContentArea}>
             <Text style={s.msgSender}>Chidi Okafor</Text>
             <View style={s.msgBubble}>
               <Text style={s.msgText}>
                 Has anyone finished the MTH 101 assignment on Linear Algebra? I'm stuck on question 4.
               </Text>
             </View>
             <Text style={s.msgTime}>09:42 AM</Text>
          </View>
        </TouchableOpacity>

        {/* Shared Reference Message */}
        <View style={s.msgWrapper}>
          <View style={s.refAvatarPlaceholder}><View style={{ width: 14, height: 18, borderWidth: 1.5, borderColor: C.inkMid, borderRadius: 2 }} /></View>
          <View style={s.msgContentArea}>
             <Text style={s.msgSender}>Shared Reference</Text>
             <TouchableOpacity style={s.refCard} activeOpacity={0.8}>
                <NoteIcon />
                <View style={s.refInfo}>
                   <Text style={s.refTitle}>Lecture Note: Matrices (MTH 101)</Text>
                   <Text style={s.refSubtitle}>Shared from Study Timer Session</Text>
                </View>
                <LinkArrowIcon />
             </TouchableOpacity>
          </View>
        </View>

        {/* Message from Me with Reply */}
        <View style={[s.msgWrapper, { justifyContent: 'flex-end' }]}>
          <View style={[s.msgContentArea, { alignItems: 'flex-end' }]}>
             <View style={[s.msgBubble, s.msgBubbleMe]}>
               <View style={s.replyBar}>
                  <Text style={s.replySender}>@Chidi Okafor</Text>
                  <Text style={s.replyText} numberOfLines={1}>Has anyone finished the MTH 101 assignment...</Text>
               </View>
               <Text style={[s.msgText, { color: '#fff' }]}>
                 I'm almost done. I can help with question 4!
               </Text>
             </View>
             <View style={s.meStatus}>
               <Text style={s.msgTime}>09:44 AM</Text>
               <SeenIcon />
             </View>
          </View>
        </View>

        {/* Message from Me */}
        <View style={[s.msgWrapper, { justifyContent: 'flex-end' }]}>
          <View style={[s.msgContentArea, { alignItems: 'flex-end' }]}>
             <View style={[s.msgBubble, s.msgBubbleMe]}>
               <Text style={[s.msgText, { color: '#fff' }]}>
                 I just went through it. Check page 12 of the lecture notes. The formula for the determinant is explained clearly there.
               </Text>
             </View>
             <View style={s.meStatus}>
               <Text style={s.msgTime}>09:45 AM</Text>
               <SeenIcon />
             </View>
          </View>
        </View>

        {/* Another message from other */}
        <View style={s.msgWrapper}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=100&auto=format&fit=crop' }} style={s.msgAvatar} />
          <View style={s.msgContentArea}>
             <Text style={s.msgSender}>Amina Bello</Text>
             <View style={s.msgBubble}>
               <Text style={s.msgText}>
                 Thanks! Just found it. @Chidi check your DM, I sent the steps for question 3 too.
               </Text>
             </View>
             <Text style={s.msgTime}>09:46 AM</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Input Area */}
      <View style={s.inputContainer}>
        {replyingTo && (
          <View style={s.replyOverlay}>
            <View style={s.replyIndicator} />
            <View style={{ flex: 1 }}>
              <Text style={s.replySenderAdmin}>Replying to {replyingTo.sender}</Text>
              <Text style={s.replyTextAdmin} numberOfLines={1}>{replyingTo.text}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={{ fontSize: 20 }}>×</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity style={s.addBtn}>
            <PlusIcon />
          </TouchableOpacity>
          <View style={s.inputWrapper}>
            <TextInput 
              style={s.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#C4C2B8"
              value={msg}
              onChangeText={setMsg}
            />
            <TouchableOpacity 
              style={s.inputIcon} 
              onPress={() => setNotePickerOpen(true)}
            >
              <BookIcon />
            </TouchableOpacity>
            <TouchableOpacity style={s.inputIcon}><EmojiIcon /></TouchableOpacity>
          </View>
          <TouchableOpacity 
            style={s.sendBtn}
            onPress={() => {
              setMsg('');
              setReplyingTo(null);
            }}
          >
            <SendIcon />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7FF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E4DE',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerInfo: { flex: 1, marginLeft: 8 },
  headerTitle: { fontFamily: F.bold, fontSize: 32, color: C.ink, letterSpacing: -1 },
  headerStatus: { fontFamily: F.bold, fontSize: 11, color: C.inkMid, letterSpacing: 1.2, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerIconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  dateDivider: {
    alignSelf: 'center',
    backgroundColor: '#E9E7E0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 32,
    marginTop: 8,
  },
  dateText: { fontFamily: F.bold, fontSize: 11, color: C.inkMid, letterSpacing: 0.5 },

  msgWrapper: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 12,
  },
  msgAvatar: { width: 36, height: 36, borderRadius: 12, alignSelf: 'flex-end' },
  refAvatarPlaceholder: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E9E7E0', justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  msgContentArea: { flex: 1, maxWidth: '85%' },
  msgSender: { fontFamily: F.medium, fontSize: 13, color: C.inkMid, marginBottom: 4 },
  msgBubble: {
    backgroundColor: '#EBE9DF',
    padding: 16,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  msgBubbleMe: {
    backgroundColor: '#000',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  msgText: {
    fontFamily: F.medium,
    fontSize: 16,
    color: C.ink,
    lineHeight: 22,
  },
  msgTime: { fontFamily: F.medium, fontSize: 12, color: C.inkMid, marginTop: 4 },

  meStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  
  replyBar: { borderLeftWidth: 3, borderLeftColor: '#fff', paddingLeft: 8, marginBottom: 8, opacity: 0.8 },
  replySender: { fontFamily: F.bold, fontSize: 12, color: '#fff', marginBottom: 2 },
  replyText: { fontFamily: F.medium, fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  refCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refInfo: { flex: 1 },
  refTitle: { fontFamily: F.bold, fontSize: 15, color: C.ink, marginBottom: 2 },
  refSubtitle: { fontFamily: F.medium, fontSize: 11, color: C.inkMid },

  inputContainer: {
    padding: 12,
    paddingBottom: 24,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E4DE',
  },
  replyOverlay: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F3F2EE', borderRadius: 12 },
  replyIndicator: { width: 4, height: '100%', backgroundColor: '#000', borderRadius: 2 },
  replySenderAdmin: { fontFamily: F.bold, fontSize: 13, color: '#000' },
  replyTextAdmin: { fontFamily: F.medium, fontSize: 13, color: C.inkLight },

  addBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontFamily: F.bold, fontSize: 20, color: C.ink },
  modalClose: { fontFamily: F.bold, fontSize: 14, color: C.inkMid },
  noteItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  noteItemTitle: { fontFamily: F.bold, fontSize: 16, color: C.ink, marginBottom: 3 },
  noteItemCourse: { fontFamily: F.bold, fontSize: 12, color: C.inkLight, letterSpacing: 0.5 },

  inputWrapper: {
    flex: 1,
    height: 52,
    backgroundColor: '#F3F2EE',
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontFamily: F.medium,
    fontSize: 16,
    color: C.ink,
    paddingRight: 8,
  },
  inputIcon: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  
  // Menu styles
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)' },
  menuContent: { 
    position: 'absolute', 
    top: 60, 
    right: 20, 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    minWidth: 180,
  },
  menuItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  menuItemText: { fontFamily: F.bold, fontSize: 14, color: C.ink },

  // Report Flow
  reportSub: { fontFamily: F.bold, fontSize: 13, color: C.inkMid, letterSpacing: 1, marginBottom: 20 },
  reasonItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F5F5F5' 
  },
  reasonText: { fontFamily: F.bold, fontSize: 15, color: C.ink },
  reasonArrow: { width: 8, height: 8, borderTopWidth: 2, borderRightWidth: 2, borderColor: C.inkLight, transform: [{ rotate: '45deg' }] },
  reportInput: { 
    backgroundColor: '#F3F2EE', 
    borderRadius: 16, 
    padding: 16, 
    height: 120, 
    fontFamily: F.medium, 
    fontSize: 15, 
    color: C.ink, 
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  reportSubmitBtn: { 
    backgroundColor: '#000', 
    borderRadius: 16, 
    paddingVertical: 16, 
    alignItems: 'center',
    width: '100%'
  },
  reportSubmitText: { fontFamily: F.bold, fontSize: 15, color: '#fff' },
  successCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#27AE60', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontFamily: F.bold, fontSize: 20, color: C.ink, marginBottom: 8 },
  successMsg: { fontFamily: F.medium, fontSize: 14, color: C.inkMid, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  sendBtn: {
    width: 52,
    height: 52,
    backgroundColor: '#000',
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
