
export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT'
}

export enum EmotionType {
  HAPPY = 'Happy',
  SAD = 'Sad',
  ANGRY = 'Angry',
  SURPRISED = 'Surprised',
  NEUTRAL = 'Neutral',
  CONFUSED = 'Confused',
  FRUSTRATED = 'Frustrated',
  ANXIOUS = 'Anxious'
}

export enum EngagementLevel {
  HIGH = 'High',
  MEDIUM = 'Medium',
  LOW = 'Low'
}

export interface Feedback {
  id: string;
  text: string;
  date: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
}

export interface Conversation {
  participantId: string;
  initiatorId: string;
  status: 'pending' | 'accepted' | 'rejected';
  messages: ChatMessage[];
}

export interface EmotionalAnalysis {
  emotion: EmotionType;
  engagement: EngagementLevel;
  stressScore: number; 
  attentionScore: number; 
  confidence: number;
  summary: string;
}

export interface StudentRecord {
  id: string;
  email?: string; // Optional if using password login
  username?: string; // For password-based login
  password?: string; // For password-based login
  name: string;
  gender?: 'male' | 'female' | 'other';
  normalizedName?: string; // For case-insensitive search
  avatar: string;
  isProfileComplete: boolean; // True once student sets name/photo
  lastAnalysis?: EmotionalAnalysis;
  history: EmotionalAnalysis[];
  isFlagged: boolean;
  feedback?: Feedback[];
  conversations?: Conversation[];
}

export interface TextSentimentResult {
  sentiment: string;
  stressScore: number;
  keywords: string[];
  interventionRecommended: boolean;
  analysis: string;
}
