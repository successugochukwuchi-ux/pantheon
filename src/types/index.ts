export type UserLevel = '1' | '2' | '3' | '4' | '5';
export type Semester = '1st' | '2nd' | 'none';

export interface UserProfile {
  uid: string;
  studentId: string; // 11-digit numeric ID
  email: string;
  username?: string;
  department?: string;
  mobileNumber?: string;
  level: UserLevel;
  academicLevel?: string;
  isActivated: boolean;
  activatedViaPromo?: boolean;
  referralCount: number;
  referredBy?: string;
  isBanned?: boolean;
  banReason?: string;
  theme?: string;
  photoURL?: string;
  currentSessionId?: string;
  createdAt: string;
  At?: string; // University ID/code
  isOnboarded?: boolean;
}

export interface University {
  id: string; // e.g. futo, unilag
  name: string;
  shortName: string;
  departments: Array<{ name: string; disciplineId: string | null }>;
  createdAt: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  semester: '1st' | '2nd';
  level: string;
  department?: string; // If null/empty, it's a General Course
  disabled?: boolean;
  createdAt: string;
  At?: string; // University ID/code
}

export interface Note {
  id: string;
  courseId: string;
  title: string;
  content: string;
  type: 'lecture' | 'past_question' | 'cbt';
  authorId: string;
  videoUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface VideoQuestion {
  id: string;
  noteId: string;
  text: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  createdAt: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  At?: string;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  isActive: boolean;
  source?: string;
}

export interface SystemConfig {
  currentSemester: Semester;
  maintenanceMode: boolean;
  fluxEnabled?: boolean;
  updatedBy: string;
  updatedAt: string;
  standardPrice?: number;
  plusPrice?: number;
  activeSeasonId?: string | null;
  activeSeasonName?: string | null;
}

export interface VerificationRequest {
  id: string;
  uid: string;
  code: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: string;
  studentId?: string;
  username?: string;
}

export interface QuestionSheet {
  id: string;
  courseId: string;
  semester: '1st' | '2nd';
  academicLevel: string;
  year: string;
  isAvailable: boolean;
  createdAt: string;
  authorId: string;
}

export interface Question {
  id: string;
  sheetId: string;
  courseId: string;
  text: string;
  correctAnswer: string;
  incorrectAnswers: string[];
  explanation?: string;
  order: number;
  authorId: string;
  createdAt: string;
  options?: string[];
}

export interface CBTSession {
  id: string;
  userId: string;
  courseId: string;
  score: number;
  totalQuestions: number;
  timeSpent: number;
  isTimed: boolean;
  duration: number;
  completedAt: string;
}

export interface ActivationCode {
  id: string;
  code: string;
  isUsed: boolean;
  usedBy?: string;
  usedByStudentId?: string;
  usedAt?: string;
  createdBy: string;
  createdAt: string;
  type?: 'standard' | 'plus';
  assignedTo?: string;
  assignedToStudentId?: string;
  owner?: string;
  At?: string; // University ID/code
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'news' | 'verification' | 'material' | 'system' | 'announcement';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export type NotificationTarget = 'all' | 'level' | 'uid' | 'academicLevel' | 'department' | 'level_dept';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'news' | 'material' | 'system' | 'announcement';
  targetType: NotificationTarget;
  targetValue: string; // e.g., '100', 'uid_123', 'Mechanical', '100_Mechanical'
  createdAt: string;
  authorId: string;
  At?: string;
}

export interface DiscussionMessage {
  id: string;
  courseId: string;
  userId: string;
  username: string;
  userLevel: string;
  userAcademicLevel?: string;
  text: string;
  referencedNoteId?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderName: string;
  senderPhotoURL?: string;
  text: string;
  referencedNoteId?: string;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  type: 'dm' | 'group';
  uids: string[];
  name?: string;
  lastMessage?: string;
  lastUpdatedAt?: string;
  typing?: { [uid: string]: boolean };
}

export interface PromoConfig {
  isActive: boolean;
  quota: number;
  count: number;
  updatedAt: string;
  updatedBy: string;
}

export interface AIConfig {
  provider: 'openrouter' | 'groq' | 'gemini';
  model: string;
  apiKey: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface SplitAIConfig {
  chat: AIConfig;
  creator: AIConfig;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  chatId: string;
  chatType: 'dm' | 'group';
  targetUids: string[];
  reason: string;
  createdAt: string;
  status: 'pending' | 'resolved' | 'dismissed';
  evidence?: {
    id: string;
    senderUid: string;
    senderName: string;
    senderStudentId: string;
    text: string;
    createdAt: string;
  }[];
  contextBefore?: {
    id: string;
    senderUid: string;
    senderName: string;
    senderStudentId: string;
    text: string;
    createdAt: string;
  }[];
  contextAfter?: {
    id: string;
    senderUid: string;
    senderName: string;
    senderStudentId: string;
    text: string;
    createdAt: string;
  }[];
}

export interface Discipline {
  id: string;
  name: string;
  departments: string[];
  courses?: Record<string, 'allow' | 'lock'>;
  createdAt: string;
}
