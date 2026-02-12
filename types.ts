
export interface RubricItem {
  criterion: string;
  maxScore: number;
  description?: string;
}

export interface Score {
  earned: number;
  total: number;
  percentage: number;
}

export interface RubricFeedback {
  criterion: string;
  score: number;
  feedback: string;
}

export interface AnalysisResponse {
  summary: string;
  score: Score;
  rubric_breakdown: RubricFeedback[];
  critical_gaps: string[];
  personalized_recommendation: string[];
  sentiment: 'Encouraging' | 'Constructive' | 'Urgent';
  plagiarism_score: number;
  ai_probability: number;
}

export interface SubmissionRecord {
  id: string;
  timestamp: string;
  subject: string;
  class: string;
  studentName: string;
  type?: 'ASSIGNMENT' | 'QUIZ' | 'MATERIAL'; // Added field
  analysis: AnalysisResponse;
}

export interface Student {
  id: string; // Firestore Doc ID
  name: string;
  class: string;
  subject: string; // Most recent subject context
  submissions: SubmissionRecord[];
  lastSubmission?: AnalysisResponse;
  riskScore?: number;
  attendanceRate?: number; // New field for integration
  absences?: number; // New field for integration
  totalClasses?: number; // New field for integration
  email?: string; // For emailing features
}

export interface AttendanceRecord {
  id: string;
  timestamp: string;
  studentName: string;
  studentId: string;
  sessionId: string;
  class?: string;
}

export interface ExpectedStudent {
  name: string;
  id: string;
  status: 'Present' | 'Absent';
  timestamp?: string;
}

export interface AttendanceReport {
  id?: string;
  date: string;
  class: string;
  stats: {
    present: number;
    absent: number;
    total: number;
  };
  students: ExpectedStudent[];
  summary: string;
  createdAt: string;
}

// --- CLASSROOM & STUDENT PORTAL TYPES ---

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  description?: string;
  teacherId: string;
  shareCode: string;
  studentIds?: string[]; // Added to track enrolled students
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // Index of correct option
  points: number;
}

export type AssignmentType = 'ASSIGNMENT' | 'QUIZ' | 'MATERIAL';

export interface Assignment {
  id: string;
  classroomId: string;
  type: AssignmentType; // New field
  title: string;
  description: string;
  rubric: string; // Used for Assignments
  quizData?: QuizQuestion[]; // Used for Quizzes
  referenceFiles: Array<{ data: string; mimeType: string; name: string }>; // Teacher uploaded files
  dueDate: string; // Optional for Material
  createdAt: string;
}

export interface ClassroomSubmission {
  id: string;
  assignmentId: string;
  classroomId: string;
  studentName: string;
  studentId: string; // Optional if public
  files: Array<{ data: string; mimeType: string; name: string }>;
  textResponse?: string;
  selectedOptions?: number[]; // Array of indices corresponding to selected options in quiz
  timestamp: string;
  status: 'PENDING' | 'GRADED';
  gradeResult?: AnalysisResponse; // Stores the AI result
}

export enum ViewState {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  GRADER = 'GRADER',
  REPORT_CARD = 'REPORT_CARD',
  CONTENT_GEN = 'CONTENT_GEN',
  ATTENDANCE = 'ATTENDANCE',
  STUDENT_ATTENDANCE_FORM = 'STUDENT_ATTENDANCE_FORM', // Public view for students attendance
  STUDENT_PORTAL = 'STUDENT_PORTAL', // New Public view for student classroom access
  CLASSROOM = 'CLASSROOM', // New Teacher view
  SETTINGS = 'SETTINGS',
}
