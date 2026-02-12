
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Grader from './components/Grader';
import ReportCard from './components/ReportCard';
import ContentGenerator from './components/ContentGenerator';
import Attendance from './components/Attendance';
import Auth from './components/Auth';
import Settings from './components/Settings';
import StudentPortal from './components/StudentPortal';
import ClassroomManager from './components/Classroom';
import ImageGenerator from './components/ImageGenerator';
import { ViewState, Student, SubmissionRecord, Classroom } from './types';
import { auth, signOut, onAuthStateChanged, User, db, collection, getDocs, query, where, setDoc, doc, addDoc } from './services/firebase';
import { Menu } from 'lucide-react';

const MOCK_STUDENTS: Student[] = [];

// New Risk Algorithm
function calculateRisk(attendancePercentage: number, gradePercentage: number) {
  // Step 1: Convert Attendance to Risk
  const attendanceRisk = 100 - attendancePercentage;
  
  // Step 2: Convert Grade to Risk
  const gradeRisk = 100 - gradePercentage;

  // Step 3: Weighted Calculation
  // Risk Score = (Attendance Risk * 0.6) + (Grade Risk * 0.4)
  const riskScore = (attendanceRisk * 0.6) + (gradeRisk * 0.4);

  return Math.max(0, Math.round(riskScore)); // Ensure it doesn't go below 0
}

// Helper to generate consistent numbers based on string input (Deterministic)
// This fixes the issue where data changes on every reload
function getDeterministicNumber(str: string, min: number, max: number) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const normalized = Math.abs(hash) % 100; // 0-99
  const range = max - min;
  return min + Math.floor((normalized / 100) * range);
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Data State
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
         if (currentUser.role === 'student') {
             setView(ViewState.STUDENT_PORTAL);
         } else {
             setView(ViewState.DASHBOARD);
         }
      } else {
          setView(ViewState.AUTH);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data - COMPREHENSIVE FETCH (Hierarchical to avoid permission issues)
  useEffect(() => {
    if (user && user.role === 'teacher' && user.uid) {
       const fetchStudents = async () => {
           try {
              // 1. Fetch Teacher's Classrooms
              const classQ = query(collection(db, 'classrooms'), where('teacherId', '==', user.uid));
              const classSnap = await getDocs(classQ);
              const classroomsList: Classroom[] = [];
              classSnap.forEach(doc => classroomsList.push({ id: doc.id, ...doc.data() } as Classroom));
              setClassrooms(classroomsList);

              let allSubmissionDocs: any[] = [];

              // 2. Fetch Submissions via Hierarchy: Classroom -> Assignment -> Submission
              // This avoids collectionGroup permission errors if indexes/rules aren't perfect
              for (const cls of classroomsList) {
                  // Get assignments for this class
                  const asmCol = collection(db, 'classrooms', cls.id, 'assignments');
                  const asmSnap = await getDocs(asmCol);
                  
                  // Get submissions for each assignment
                  // Use Promise.all for parallel fetching within the class
                  const submissionPromises = asmSnap.docs.map(async (asmDoc) => {
                      const subCol = collection(db, 'classrooms', cls.id, 'assignments', asmDoc.id, 'submissions');
                      const subSnap = await getDocs(subCol);
                      return subSnap.docs.map(s => ({ 
                          id: s.id, 
                          ...s.data(),
                          // Ensure legacy data has class info if missing
                          classroomId: cls.id,
                          className: s.data().className || cls.name,
                          subject: s.data().subject || cls.subject
                      }));
                  });

                  const nestedSubs = await Promise.all(submissionPromises);
                  nestedSubs.forEach(subs => allSubmissionDocs.push(...subs));
              }

              // 2.5 Fetch Standalone Grader Reports
              // These are saved directly to 'reportCards' by the AI Grader
              try {
                  const reportsQ = query(collection(db, 'reportCards'), where('teacherId', '==', user.uid));
                  const reportsSnap = await getDocs(reportsQ);
                  reportsSnap.forEach(doc => {
                      const data = doc.data();
                      allSubmissionDocs.push({
                          id: doc.id,
                          ...data,
                          // Ensure essential fields map correctly for the dashboard
                          gradeResult: data.gradeResult, 
                          type: data.type || 'GRADER_ENTRY'
                      });
                  });
              } catch (reportErr) {
                  console.warn("Failed to fetch reportCards:", reportErr);
              }

              // 3. Process Data into Student Objects
              const studentMap = new Map<string, Student>();
              const classSet = new Set<string>();
              const subjectSet = new Set<string>();

              allSubmissionDocs.forEach((data) => {
                  // Construct ID based on Name+Class to group students
                  // Use className as fallback grouping if classroomId is missing (manual entries)
                  // TRIM STRINGS to prevent "Student " vs "Student" duplicates
                  const cleanName = (data.studentName || 'Unknown').trim();
                  const cleanClass = (data.classroomId || data.className || 'General').trim();
                  const studentKey = `${cleanName}_${cleanClass}`;
                  
                  const submission: SubmissionRecord = {
                      id: data.id,
                      timestamp: data.timestamp,
                      subject: data.subject || 'General',
                      class: data.className || 'General',
                      studentName: cleanName,
                      analysis: data.gradeResult || data.lastSubmission, // Fallback for manual grade structure
                      type: data.type || 'ASSIGNMENT'
                  };

                  if (submission.analysis) {
                      if (!studentMap.has(studentKey)) {
                          // Generate DETERMINISTIC attendance between 70% and 100% 
                          // Uses the unique studentKey so it stays consistent across reloads for the same student
                          const mockAttendance = getDeterministicNumber(studentKey, 70, 100);
                          
                          studentMap.set(studentKey, {
                              id: studentKey,
                              name: cleanName,
                              class: data.className || 'Unknown',
                              subject: data.subject || 'General',
                              submissions: [],
                              riskScore: 0, // Placeholder, calculated below
                              attendanceRate: mockAttendance, 
                              absences: Math.round((100 - mockAttendance) / 4)
                          });
                      }
                      
                      const student = studentMap.get(studentKey)!;
                      student.submissions.push(submission);
                      
                      // Update lastSubmission to be the most recent one
                      if (!student.lastSubmission || new Date(submission.timestamp) > new Date(student.submissions.find(s => s.analysis === student.lastSubmission)?.timestamp || 0)) {
                          student.lastSubmission = submission.analysis;
                      }
                  }

                  if (data.className) classSet.add(data.className);
                  if (data.subject) subjectSet.add(data.subject);
              });
              
              // 4. Calculate Final Risk Scores using Algorithm
              const studentsArray = Array.from(studentMap.values()).map(student => {
                  // Calculate Average Grade
                  let avgGrade = 0;
                  if (student.submissions.length > 0) {
                      const totalScore = student.submissions.reduce((sum, sub) => sum + (sub.analysis?.score?.percentage || 0), 0);
                      avgGrade = totalScore / student.submissions.length;
                  }

                  // Apply Formula
                  student.riskScore = calculateRisk(student.attendanceRate || 100, avgGrade);
                  
                  return student;
              });

              setStudents(studentsArray);
              setClasses(Array.from(classSet));
              setSubjects(Array.from(subjectSet));

           } catch (e) {
               console.error("Error fetching dashboard data", e);
           }
       };
       fetchStudents();
    }
  }, [user, view]); // Added 'view' to dependency to refresh data when switching back to dashboard

  if (!user) return <Auth />;
  if (user.role === 'student') return <StudentPortal user={user} />;

  return (
    // Fixed layout: h-screen + overflow-hidden ensures Sidebar is full height 
    // and content scrolls independently. This fixes the "Sign Out" visibility issue.
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar 
        currentView={view} 
        setView={setView} 
        isOpen={isSidebarOpen} 
        closeSidebar={() => setIsSidebarOpen(false)} 
        onLogout={() => signOut(auth)}
      />

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between shadow-sm z-30">
           <button onClick={() => setIsSidebarOpen(true)} className="text-slate-600 hover:text-slate-900">
             <Menu size={24} />
           </button>
           <h1 className="font-bold text-slate-800">NextHorizon</h1>
           <div className="w-6" /> 
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 relative">
          {view === ViewState.DASHBOARD && <Dashboard students={students} />}
          {view === ViewState.GRADER && <Grader classrooms={classrooms} subjects={subjects} />}
          {view === ViewState.CLASSROOM && <ClassroomManager />}
          {view === ViewState.REPORT_CARD && <ReportCard students={students} classes={classes} subjects={subjects} />}
          {view === ViewState.CONTENT_GEN && (
             <div className="space-y-12">
                <ContentGenerator />
                <ImageGenerator />
             </div>
          )}
          {view === ViewState.ATTENDANCE && <Attendance user={user} initialClasses={classes} />}
          {view === ViewState.SETTINGS && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default App;
