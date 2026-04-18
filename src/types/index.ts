export type UserLevel = '1' | '1+' | '2' | '3' | '4';
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
  referralCount: number;
  referredBy?: string;
  isBanned?: boolean;
  banReason?: string;
  theme?: string;
  photoURL?: string;
  createdAt: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  semester: '1st' | '2nd';
  level: string;
  department?: string; // If null/empty, it's a General Course
  createdAt: string;
}

export interface Note {
  id: string;
  courseId: string;
  title: string;
  content: string;
  type: 'lecture' | 'punch' | 'past_question' | 'cbt';
  authorId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface SystemConfig {
  currentSemester: Semester;
  maintenanceMode: boolean;
  updatedBy: string;
  updatedAt: string;
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
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'news' | 'verification' | 'material' | 'system';
  isRead: boolean;
  link?: string;
  createdAt: string;
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
  text: string;
  referencedNoteId?: string;
  createdAt: string;
}
