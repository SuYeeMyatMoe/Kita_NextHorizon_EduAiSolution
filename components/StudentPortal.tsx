
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, query, getDocs, addDoc, auth, signOut, updateStudentJoinedClasses, User, where, doc, updateDoc, arrayUnion, arrayRemove, setDoc, removeStudentJoinedClass, getDoc, serverTimestamp } from '../services/firebase';
import { Classroom, Assignment, AnalysisResponse, ClassroomSubmission } from '../types';
import { ArrowLeft, ArrowRight, Upload, FileText, CheckCircle, Search, Hexagon, LogOut, FileIcon, X, Calendar, Download, Clock, LayoutDashboard, PlusCircle, ChevronLeft, ChevronRight, BookOpen, PlayCircle, Trophy, Star, Zap, Rocket, Smile, Brain, RotateCcw, Sparkles, User as UserIcon, Settings as SettingsIcon, Trash2, AlertCircle, Edit2, Bot, Ticket, KeyRound, Menu, Wifi, Check, Repeat, HelpCircle } from 'lucide-react';
import { generateStudyMaterial } from '../services/geminiService';

interface UploadedFile {
  data: string;
  mimeType: string;
  name: string;
}

type StudentView = 'DASHBOARD' | 'CALENDAR' | 'CLASS_DETAIL' | 'ASSIGNMENT_DETAIL' | 'QUIZ_PLAYER' | 'FLASHCARD_PLAYER' | 'SETTINGS';

interface Flashcard {
  front: string;
  back: string;
}

interface StudyAid {
  summary: string;
  flashcards: Flashcard[];
}

interface StudentPortalProps {
  user: User;
}

const StudentPortal: React.FC<StudentPortalProps> = ({ user }) => {
  const [view, setView] = useState<StudentView>('DASHBOARD');
  
  // Data
  const [joinedClasses, setJoinedClasses] = useState<Classroom[]>([]);
  const [currentClass, setCurrentClass] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<ClassroomSubmission | null>(null);
  
  // Join Class State
  const [shareCode, setShareCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Attendance State
  const [attendanceCode, setAttendanceCode] = useState('');
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState(false);

  // Submission State
  const [submissionFiles, setSubmissionFiles] = useState<UploadedFile[]>([]);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Quiz Player State
  const [currentQuizQuestionIndex, setCurrentQuizQuestionIndex] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [showQuizResult, setShowQuizResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState<boolean | null>(null);
  
  // Flashcard State
  const [studyData, setStudyData] = useState<StudyAid | null>(null);
  const [isGeneratingStudyAid, setIsGeneratingStudyAid] = useState(false);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  
  // Track all selected answers for submission
  const [selectedOptionsHistory, setSelectedOptionsHistory] = useState<number[]>([]);

  // Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());

  // UI State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch Joined Classes & Assignments on Mount
  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      try {
          const classQ = query(collection(db, 'classrooms'), where('studentIds', 'array-contains', user.uid));
          const classSnap = await getDocs(classQ);
          const userClasses: Classroom[] = [];
          
          classSnap.forEach(doc => {
              userClasses.push({ id: doc.id, ...(doc.data() as any) } as Classroom);
          });
          setJoinedClasses(userClasses);

          let allAssignments: Assignment[] = [];
          for (const cls of userClasses) {
              try {
                  const asmSnap = await getDocs(collection(db, 'classrooms', cls.id, 'assignments'));
                  asmSnap.forEach(doc => {
                      allAssignments.push({ id: doc.id, ...doc.data() } as Assignment);
                  });
              } catch (err) {
                  console.warn(`Error fetching assignments for class ${cls.id}`, err);
              }
          }
          setAssignments(allAssignments);

      } catch (error) {
          console.error("Error fetching student data:", error);
      }
    };

    fetchData();
  }, [user, view]); 

  // Check for existing submission when an assignment is selected
  useEffect(() => {
    if (selectedAssignment && currentClass && user) {
        setStudyData(null); // Reset AI summary
        setIsEditing(false); // Reset edit mode
        const checkSubmission = async () => {
            setExistingSubmission(null);
            try {
                // Query: submissions where studentId == user.uid
                const q = query(
                    collection(db, 'classrooms', currentClass.id, 'assignments', selectedAssignment.id, 'submissions'),
                    where('studentId', '==', user.uid)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const data = snap.docs[0].data() as ClassroomSubmission;
                    setExistingSubmission({ id: snap.docs[0].id, ...data });
                }
            } catch (e) {
                console.error("Error checking submission:", e);
            }
        };
        checkSubmission();
    }
  }, [selectedAssignment, currentClass, user]);


  const handleJoinClass = async () => {
      if (!shareCode) return;
      setJoinError('');
      setIsJoining(true);
      try {
          const q = query(collection(db, 'classrooms'), where('shareCode', '==', shareCode.toUpperCase()));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
              const docSnap = snapshot.docs[0];
              const classData = docSnap.data();
              const found = { id: docSnap.id, ...classData } as Classroom;
              if (user) {
                  await updateStudentJoinedClasses(user.uid, found.id);
                  const currentStudentIds: string[] = classData.studentIds || [];
                  if (!currentStudentIds.includes(user.uid)) {
                      await updateDoc(doc(db, 'classrooms', found.id), {
                          studentIds: arrayUnion(user.uid)
                      });
                  }
                  
                  // Update local state instead of reloading
                  setJoinedClasses(prev => [...prev, found]);
                  
                  // Fetch and add assignments for the newly joined class
                  try {
                    const asmSnap = await getDocs(collection(db, 'classrooms', found.id, 'assignments'));
                    const newAsms: Assignment[] = [];
                    asmSnap.forEach(d => {
                        newAsms.push({ id: d.id, ...d.data() } as Assignment);
                    });
                    setAssignments(prev => [...prev, ...newAsms]);
                  } catch(e) { console.error("Error loading new assignments", e); }

                  setShareCode('');
                  setShowJoinModal(false);
                  alert(`Successfully joined ${found.name}`);
                  setView('DASHBOARD'); 
              }
          } else {
              setJoinError('Invalid Class Code');
          }
      } catch (error: any) {
          console.error("Join Error:", error);
          setJoinError('Error joining class: ' + error.message);
      } finally {
          setIsJoining(false);
      }
  };

  const handleAttendanceCheckIn = async () => {
      if (!attendanceCode || attendanceCode.length !== 4) {
          alert("Please enter the 4-digit session code.");
          return;
      }
      if (!user) return;

      setIsCheckingIn(true);
      
      const today = new Date().toISOString().split('T')[0];
      let success = false;

      // Check all joined classes for a matching live session
      try {
          for (const cls of joinedClasses) {
              // Updated to use attendanceSessions to match strict Firestore Rules
              const sessionRef = doc(db, 'classrooms', cls.id, 'attendanceSessions', today);
              const sessionSnap = await getDoc(sessionRef);
              
              if (sessionSnap.exists()) {
                  const data = sessionSnap.data();
                  if (data.active && data.code === attendanceCode) {
                      // Correct Code Found!
                      // Student MUST write to the 'checkIns' subcollection where they have 'create' permission.
                      // Students DO NOT have permission to update the session doc directly.
                      const checkInRef = doc(sessionRef, 'checkIns', user.uid);
                      await setDoc(checkInRef, {
                          studentId: user.uid,
                          name: user.displayName || 'Student',
                          timestamp: serverTimestamp(), // Use server timestamp for rule consistency if needed
                          type: 'SELF'
                      });
                      
                      success = true;
                      break; // Stop searching once found
                  }
              }
          }

          if (success) {
              setCheckInSuccess(true);
              setAttendanceCode('');
              setTimeout(() => setCheckInSuccess(false), 3000);
          } else {
              alert("Invalid Code or Session Expired.");
          }

      } catch (e) {
          console.error("Check-in Error:", e);
          alert("Check-in failed. Please try again.");
      } finally {
          setIsCheckingIn(false);
      }
  };

  const handleLeaveClass = async (classId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!user) return;
    if (window.confirm("Are you sure you want to leave this class? Your past submissions will be kept.")) {
        try {
            // Update Classroom Document
            await updateDoc(doc(db, 'classrooms', classId), {
                studentIds: arrayRemove(user.uid)
            });
            // Update User Document to keep it in sync
            await removeStudentJoinedClass(user.uid, classId);
            
            // Update UI
            setJoinedClasses(prev => prev.filter(c => c.id !== classId));
            
            if (currentClass?.id === classId) {
                setCurrentClass(null);
                setView('DASHBOARD');
            }
            alert("Left class successfully.");
        } catch (e: any) {
            console.error("Error leaving class:", e);
            alert("Failed to leave class: " + e.message);
        }
    }
  };

  // ... (Rest of file logic remains same) ...
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          const newFile = {
            data: base64String,
            mimeType: file.type,
            name: file.name
          };
          setSubmissionFiles(prev => [...prev, newFile]);
        };
        reader.readAsDataURL(file);
      });
    }
    if (e.target) e.target.value = '';
  };

  const downloadFile = (file: { data: string; mimeType: string; name: string }) => {
      const link = document.createElement('a');
      link.href = `data:${file.mimeType};base64,${file.data}`;
      link.download = file.name;
      link.click();
  };

  const handleEnableEdit = () => {
    if (existingSubmission) {
      setSubmissionText(existingSubmission.textResponse || '');
      setSubmissionFiles(existingSubmission.files || []);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setSubmissionText('');
    setSubmissionFiles([]);
  };

  const handleSubmitWork = async () => {
    if (!selectedAssignment || !currentClass || !user) return;
    
    setSubmitting(true);
    try {
      const payload = {
        assignmentId: selectedAssignment.id,
        classroomId: currentClass.id,
        className: currentClass.name,
        subject: currentClass.subject,
        teacherId: currentClass.teacherId,
        studentName: user.displayName || 'Student',
        studentId: user.uid,
        files: submissionFiles,
        textResponse: submissionText,
        timestamp: new Date().toISOString(),
        status: 'PENDING',
        type: selectedAssignment.type
      };

      let newId = existingSubmission?.id;

      if (existingSubmission && existingSubmission.id) {
         await setDoc(doc(db, 'classrooms', currentClass.id, 'assignments', selectedAssignment.id, 'submissions', existingSubmission.id), payload, { merge: true });
         newId = existingSubmission.id;
      } else {
         const docRef = await addDoc(collection(db, 'classrooms', currentClass.id, 'assignments', selectedAssignment.id, 'submissions'), payload);
         newId = docRef.id;
      }

      setSubmittedSuccess(true);
      setTimeout(() => {
        setSubmittedSuccess(false);
        setSubmissionFiles([]);
        setSubmissionText('');
        setIsEditing(false);
        setExistingSubmission({ 
             id: newId!, 
             assignmentId: selectedAssignment.id, 
             classroomId: currentClass.id, 
             studentName: user.displayName!, 
             studentId: user.uid, 
             files: payload.files, 
             textResponse: payload.textResponse, 
             timestamp: new Date().toISOString(), 
             status: 'PENDING' 
        });
      }, 2000);
    } catch (e) {
      console.error(e);
      alert("Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateStudyAid = async () => {
    if (!selectedAssignment) return;
    setIsGeneratingStudyAid(true);
    try {
      const result = await generateStudyMaterial(
        selectedAssignment.title,
        selectedAssignment.description,
        selectedAssignment.referenceFiles
      );
      if (result) {
        setStudyData(result);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to generate study materials.");
    } finally {
      setIsGeneratingStudyAid(false);
    }
  };

  const startFlashcards = () => {
     if (studyData?.flashcards) {
       setCurrentFlashcardIndex(0);
       setIsFlipped(false);
       setView('FLASHCARD_PLAYER');
     }
  };

  const nextFlashcard = () => {
    if (!studyData) return;
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentFlashcardIndex((prev) => (prev + 1) % studyData.flashcards.length);
    }, 150);
  };

  const prevFlashcard = () => {
    if (!studyData) return;
    setIsFlipped(false);
    setTimeout(() => {
        setCurrentFlashcardIndex((prev) => (prev - 1 + studyData.flashcards.length) % studyData.flashcards.length);
    }, 150);
  };

  const startQuiz = () => {
      setCurrentQuizQuestionIndex(0);
      setQuizScore(0);
      setShowQuizResult(false);
      setSelectedOption(null);
      setIsAnswerCorrect(null);
      setSelectedOptionsHistory([]);
      setView('QUIZ_PLAYER');
  };

  const handleQuizAnswer = (optionIndex: number) => {
      if (selectedOption !== null || !selectedAssignment?.quizData) return;
      
      setSelectedOption(optionIndex);
      const newHistory = [...selectedOptionsHistory];
      newHistory[currentQuizQuestionIndex] = optionIndex;
      setSelectedOptionsHistory(newHistory);

      const currentQ = selectedAssignment.quizData[currentQuizQuestionIndex];
      const correct = optionIndex === currentQ.correctAnswer;
      setIsAnswerCorrect(correct);

      if (correct) {
          setQuizScore(prev => prev + currentQ.points);
      }

      setTimeout(() => {
          if (currentQuizQuestionIndex < (selectedAssignment.quizData?.length || 0) - 1) {
              setCurrentQuizQuestionIndex(prev => prev + 1);
              setSelectedOption(null);
              setIsAnswerCorrect(null);
          } else {
              finishQuiz(correct ? quizScore + currentQ.points : quizScore, newHistory);
          }
      }, 1500);
  };

  const finishQuiz = async (finalScore: number, finalHistory: number[]) => {
      setShowQuizResult(true);
      if (!selectedAssignment || !currentClass || !user) return;

      const totalPoints = selectedAssignment.quizData?.reduce((acc, q) => acc + q.points, 0) || 100;
      const percentage = Math.round((finalScore / totalPoints) * 100);

      const gradeResult: AnalysisResponse = {
          summary: `Completed Quiz: ${selectedAssignment.title}`,
          score: { earned: finalScore, total: totalPoints, percentage: percentage },
          rubric_breakdown: [],
          critical_gaps: [],
          personalized_recommendation: [],
          sentiment: percentage > 80 ? 'Encouraging' : percentage > 50 ? 'Constructive' : 'Urgent',
          plagiarism_score: 0,
          ai_probability: 0
      };

      try {
          await addDoc(collection(db, 'classrooms', currentClass.id, 'assignments', selectedAssignment.id, 'submissions'), {
              assignmentId: selectedAssignment.id,
              classroomId: currentClass.id,
              className: currentClass.name,
              subject: currentClass.subject,
              teacherId: currentClass.teacherId,
              studentName: user.displayName || 'Student',
              studentId: user.uid,
              files: [],
              textResponse: 'Quiz Completed',
              selectedOptions: finalHistory, 
              timestamp: new Date().toISOString(),
              status: 'GRADED',
              gradeResult: gradeResult,
              type: 'QUIZ'
          });
      } catch (e) {
          console.error("Error submitting quiz:", e);
      }
  };

  const getDaysInMonth = (date: Date) => {
      const year = date.getFullYear();
      const month = date.getMonth();
      const days = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      return { days, firstDay };
  };

  const handleNavClick = (newView: StudentView) => {
    setView(newView);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row relative">
       <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        .animate-slide-up { animation: slideUp 0.5s ease-out forwards; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-pop { animation: pop 0.3s ease-out; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
      `}</style>
      
      {/* Mobile Header */}
      {view !== 'QUIZ_PLAYER' && view !== 'FLASHCARD_PLAYER' && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
           <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-600 hover:text-slate-900 transition-colors p-1">
             <Menu size={24} />
           </button>
           <h1 className="font-bold text-slate-800 flex items-center gap-2"><Hexagon className="w-5 h-5 text-indigo-600 fill-indigo-600" /> NextHorizon</h1>
           <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">{user?.displayName?.charAt(0) || 'S'}</div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      {view !== 'QUIZ_PLAYER' && view !== 'FLASHCARD_PLAYER' && (
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:h-screen md:sticky md:top-0
      `}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg"><Hexagon className="w-6 h-6 text-white fill-indigo-600" /></div>
              <div><h1 className="font-bold text-slate-900 leading-none">NextHorizon</h1><p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Student Portal</p></div>
           </div>
           <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-slate-600 p-1">
             <X size={20} />
           </button>
        </div>
        <nav className="p-4 space-y-2 flex-1">
           <button onClick={() => handleNavClick('DASHBOARD')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'DASHBOARD' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}><LayoutDashboard size={20} /> Dashboard</button>
           <button onClick={() => handleNavClick('CALENDAR')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'CALENDAR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}><Calendar size={20} /> Calendar</button>
           <button onClick={() => handleNavClick('SETTINGS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${view === 'SETTINGS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}><SettingsIcon size={20} /> Settings</button>
        </nav>
        <div className="p-4 border-t border-slate-100">
           <div className="flex items-center gap-3 px-4 py-3 mb-2"><div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">{user?.displayName?.charAt(0) || 'S'}</div><div className="flex-1 min-w-0"><p className="text-sm font-bold text-slate-900 truncate">{user?.displayName}</p><p className="text-xs text-slate-500 truncate">Student Account</p></div></div>
           <button onClick={() => signOut(auth)} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl font-bold text-xs transition-colors"><LogOut size={14} /> Sign Out</button>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8">
        
        {/* DASHBOARD */}
        {view === 'DASHBOARD' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
             <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div><h2 className="text-3xl font-extrabold text-slate-900">Your Classes</h2><p className="text-slate-500 mt-2 font-medium">Access your learning materials and assignments.</p></div>
                <div className="flex gap-3">
                    <button onClick={() => setShowJoinModal(true)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"><PlusCircle size={20} /> Join Class</button>
                </div>
             </header>

             {/* Live Attendance Widget */}
             <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 rounded-3xl shadow-xl shadow-emerald-200 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                 <div>
                     <h3 className="text-xl font-bold flex items-center gap-2"><Wifi size={24} className="animate-pulse" /> Live Attendance Check-In</h3>
                     <p className="text-emerald-100 mt-1">Is your teacher running a live roll call? Enter the 4-digit code here.</p>
                 </div>
                 <div className="flex items-center gap-2">
                     <input 
                       type="text" 
                       maxLength={4} 
                       placeholder="0000" 
                       value={attendanceCode}
                       onChange={(e) => setAttendanceCode(e.target.value)}
                       className="w-24 p-3 text-center text-xl font-black text-white rounded-xl outline-none focus:ring-4 focus:ring-white/30 transition-all placeholder:text-slate-300"
                     />
                     <button 
                        onClick={handleAttendanceCheckIn}
                        disabled={isCheckingIn || checkInSuccess}
                        className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${checkInSuccess ? 'bg-white text-emerald-600' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
                     >
                        {isCheckingIn ? 'Checking...' : checkInSuccess ? <><CheckCircle size={20}/> Checked In!</> : 'Check In'}
                     </button>
                 </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {joinedClasses.length > 0 ? joinedClasses.map(cls => (
                     <div key={cls.id} onClick={() => { setCurrentClass(cls); setView('CLASS_DETAIL'); }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group cursor-pointer relative flex flex-col h-full">
                         <div className="flex justify-between items-start mb-4"><div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><BookOpen size={24} /></div><button onClick={(e) => handleLeaveClass(cls.id, e)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><LogOut size={16} /></button></div>
                         <h3 className="text-xl font-extrabold text-slate-900 mb-1">{cls.name}</h3><p className="text-indigo-600 text-sm font-bold mb-3">{cls.subject}</p><p className="text-slate-500 text-sm leading-relaxed mb-6 line-clamp-2">{cls.description}</p>
                         <div className="mt-auto pt-6 border-t border-slate-50"><button className="w-full py-3 rounded-xl bg-slate-50 text-slate-700 font-bold group-hover:bg-slate-900 group-hover:text-white transition-all flex items-center justify-center gap-2">Enter Class <ChevronRight size={16} /></button></div>
                     </div>
                 )) : (
                     <div className="col-span-full py-20 text-center"><div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400"><LayoutDashboard size={40} /></div><h3 className="text-lg font-bold text-slate-600">No classes joined yet</h3><p className="text-slate-400">Ask your teacher for a class code to get started.</p></div>
                 )}
             </div>
          </div>
        )}

        {/* CALENDAR VIEW */}
        {view === 'CALENDAR' && (
          <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
             <div className="flex items-center justify-between">
                <h2 className="text-3xl font-extrabold text-slate-900">Calendar</h2>
                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                   <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronLeft size={20} /></button>
                   <span className="font-bold text-lg w-48 text-center flex items-center justify-center text-slate-800">
                      {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                   </span>
                   <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"><ChevronRight size={20} /></button>
                </div>
             </div>
             
             <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
                {/* Days Header */}
                <div className="grid grid-cols-7 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wide py-2">{d}</div>
                  ))}
                </div>
                
                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: getDaysInMonth(calendarDate).firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-20 md:h-24 bg-slate-50/30 rounded-xl" />
                  ))}
                  {Array.from({ length: getDaysInMonth(calendarDate).days }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day).toISOString().split('T')[0];
                      const dayAssignments = assignments.filter(a => a.dueDate === dateStr);
                      const isToday = new Date().toDateString() === new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day).toDateString();
                      
                      return (
                        <div key={day} className={`h-20 md:h-24 p-2 rounded-2xl border transition-all hover:shadow-md ${isToday ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100' : 'bg-white border-slate-100 hover:border-indigo-200'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>{day}</span>
                                {dayAssignments.length > 0 && <span className="text-[10px] font-bold bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full">{dayAssignments.length}</span>}
                            </div>
                            <div className="space-y-1 overflow-y-auto max-h-[calc(100%-1.5rem)] custom-scrollbar">
                                {dayAssignments.map(asm => (
                                    <div key={asm.id} className="text-[10px] font-bold truncate bg-slate-100 text-slate-600 p-1 rounded hover:bg-indigo-100 hover:text-indigo-700 cursor-pointer" title={asm.title} onClick={() => { 
                                         // Find class for this assignment to set context
                                         const cls = joinedClasses.find(c => c.id === asm.classroomId);
                                         if(cls) { setCurrentClass(cls); setSelectedAssignment(asm); setView('ASSIGNMENT_DETAIL'); }
                                    }}>
                                        {asm.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                      );
                  })}
                </div>
             </div>

             {/* Upcoming List */}
             <div>
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Clock size={20} className="text-indigo-600" /> Upcoming Deadlines</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {assignments.filter(a => a.dueDate && new Date(a.dueDate) >= new Date()).sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 6).map(asm => (
                      <div key={asm.id} onClick={() => { 
                           const cls = joinedClasses.find(c => c.id === asm.classroomId);
                           if(cls) { setCurrentClass(cls); setSelectedAssignment(asm); setView('ASSIGNMENT_DETAIL'); }
                      }} className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:shadow-lg hover:border-indigo-200 transition-all group">
                         <div className="text-center px-4 py-2 bg-slate-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                            <span className="block text-xs font-bold text-slate-400 uppercase group-hover:text-indigo-400">{new Date(asm.dueDate).toLocaleString('default', { month: 'short' })}</span>
                            <span className="block text-2xl font-black text-slate-800 group-hover:text-indigo-600">{new Date(asm.dueDate).getDate()}</span>
                         </div>
                         <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">{asm.title}</h4>
                            <p className="text-xs text-slate-500 font-bold truncate mt-1 flex items-center gap-1">
                                {joinedClasses.find(c => c.id === asm.classroomId)?.subject || 'Class'} 
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span> 
                                {joinedClasses.find(c => c.id === asm.classroomId)?.name}
                            </p>
                         </div>
                      </div>
                   ))}
                   {assignments.filter(a => a.dueDate && new Date(a.dueDate) >= new Date()).length === 0 && (
                       <div className="col-span-full p-8 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">No upcoming deadlines.</div>
                   )}
                </div>
             </div>
          </div>
        )}

        {/* CLASS DETAIL */}
        {view === 'CLASS_DETAIL' && currentClass && (
          <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
             <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm group"><div className="p-1.5 bg-white border border-slate-200 rounded-lg group-hover:border-indigo-300 transition-colors"><ArrowLeft size={16} /></div> Back to Dashboard</button>
             <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl shadow-slate-200"><div className="absolute top-0 right-0 p-12 opacity-10"><BookOpen size={200} /></div><div className="relative z-10"><span className="inline-block px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-indigo-200 border border-white/10 mb-4">{currentClass.subject}</span><h2 className="text-4xl font-extrabold tracking-tight mb-4">{currentClass.name}</h2><p className="text-indigo-100 text-lg max-w-2xl">{currentClass.description}</p></div></div>
             
             <div>
                 <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><FileText className="text-indigo-600" /> Assignments & Materials</h3>
                 <div className="grid grid-cols-1 gap-4">
                     {assignments.filter(a => a.classroomId === currentClass.id).length > 0 ? assignments.filter(a => a.classroomId === currentClass.id).map(asm => (
                         <div key={asm.id} onClick={() => { setSelectedAssignment(asm); setView('ASSIGNMENT_DETAIL'); }} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all cursor-pointer group flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${asm.type === 'QUIZ' ? 'bg-purple-50 text-purple-600' : asm.type === 'MATERIAL' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>{asm.type === 'QUIZ' ? <PlayCircle size={24} /> : asm.type === 'MATERIAL' ? <FileIcon size={24} /> : <FileText size={24} />}</div>
                                <div><h4 className="font-bold text-slate-800 text-lg group-hover:text-indigo-700 transition-colors">{asm.title}</h4><div className="flex items-center gap-3 mt-1"><span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex items-center gap-1"><Calendar size={12}/> {asm.dueDate || 'No Due Date'}</span></div></div>
                             </div>
                             <div className="p-2 bg-slate-50 rounded-full text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all"><ChevronRight size={20} /></div>
                         </div>
                     )) : <div className="text-center py-12 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">No assignments posted yet.</div>}
                 </div>
             </div>
          </div>
        )}

        {/* ASSIGNMENT DETAIL */}
        {view === 'ASSIGNMENT_DETAIL' && selectedAssignment && (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-20">
             <button onClick={() => setView('CLASS_DETAIL')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm group"><div className="p-1.5 bg-white border border-slate-200 rounded-lg group-hover:border-indigo-300 transition-colors"><ArrowLeft size={16} /></div> Back to Class</button>
             
             <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                 <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-3"><span className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedAssignment.type === 'QUIZ' ? 'bg-purple-100 text-purple-700 border-purple-200' : selectedAssignment.type === 'MATERIAL' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-indigo-100 text-indigo-700 border-indigo-200'}`}>{selectedAssignment.type}</span><span className="text-xs font-bold text-slate-500 flex items-center gap-1"><Calendar size={12} /> Due: {selectedAssignment.dueDate}</span></div>
                            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">{selectedAssignment.title}</h2>
                        </div>
                        {selectedAssignment.type === 'QUIZ' && (<button onClick={startQuiz} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 flex items-center gap-2 animate-pulse"><PlayCircle size={20} /> Start Quiz</button>)}
                    </div>
                 </div>
                 <div className="p-8 space-y-8">
                     <div className="prose prose-slate max-w-none"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-2">Instructions</h3><p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{selectedAssignment.description}</p></div>
                     {selectedAssignment.referenceFiles?.length > 0 && (<div><h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3">Reference Materials</h3><div className="flex flex-wrap gap-3">{selectedAssignment.referenceFiles.map((f, i) => (<button key={i} onClick={() => downloadFile(f)} className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors"><FileIcon size={16} /> {f.name} <Download size={14} className="ml-1 opacity-50" /></button>))}</div></div>)}
                 </div>
             </div>

             {/* AI Study Aid Generation - Restricted to MATERIAL only */}
             {selectedAssignment.type === 'MATERIAL' && (
                <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200 flex items-center justify-between">
                   <div><h3 className="font-bold text-lg flex items-center gap-2"><Sparkles size={18} className="text-yellow-300" /> AI Study Companion</h3><p className="text-indigo-100 text-sm opacity-90">Generate flashcards and summaries from this assignment.</p></div>
                   <button onClick={handleGenerateStudyAid} disabled={isGeneratingStudyAid} className="bg-white text-indigo-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors disabled:opacity-70 flex items-center gap-2">{isGeneratingStudyAid ? <span className="animate-spin">⏳</span> : <Brain size={16} />} {isGeneratingStudyAid ? 'Generating...' : 'Create Study Aid'}</button>
                </div>
             )}

             {/* Study Aid Display */}
             {studyData && (
                <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-6 animate-fade-in ring-4 ring-indigo-50">
                    <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Bot size={20} className="text-indigo-600"/> AI Summary</h3><button onClick={startFlashcards} className="text-xs font-bold bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-200 transition-colors">Review Flashcards</button></div>
                    <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">{studyData.summary}</p>
                </div>
             )}

             {/* Submission Area */}
             {selectedAssignment.type === 'ASSIGNMENT' && (
               <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm relative">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center"><h3 className="font-bold text-slate-800 flex items-center gap-2"><Upload size={20} className="text-indigo-600" /> Your Submission</h3>
                      {existingSubmission && existingSubmission.status === 'GRADED' && (<span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle size={12}/> Graded: {existingSubmission.gradeResult?.score.percentage}%</span>)}
                      {existingSubmission && existingSubmission.status === 'PENDING' && (<span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1"><Clock size={12}/> Pending Review</span>)}
                  </div>
                  
                  <div className="p-8">
                     {existingSubmission && !isEditing ? (
                        <div className="space-y-6">
                           {existingSubmission.textResponse && (<div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700">{existingSubmission.textResponse}</div>)}
                           {existingSubmission.files?.length > 0 && (<div className="space-y-2">{existingSubmission.files.map((f, i) => (<div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl"><div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><FileText size={16}/></div><span className="text-sm font-bold text-slate-700">{f.name}</span></div>))}</div>)}
                           {existingSubmission.gradeResult && (<div className="mt-6 p-6 bg-emerald-50 rounded-2xl border border-emerald-100"><h4 className="font-bold text-emerald-800 mb-2 flex items-center gap-2"><Trophy size={18}/> Feedback</h4><p className="text-emerald-900 text-sm mb-4">{existingSubmission.gradeResult.summary}</p><div className="space-y-2">{existingSubmission.gradeResult.rubric_breakdown.map((r, i) => (<div key={i} className="flex justify-between text-xs bg-white/60 p-2 rounded-lg"><span className="font-bold text-emerald-800">{r.criterion}</span><span className="font-bold">{r.score} pts</span></div>))}</div></div>)}
                           {existingSubmission.status !== 'GRADED' && (
                               <button onClick={handleEnableEdit} className="mt-4 text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-xl transition-colors flex items-center gap-2"><Edit2 size={16} /> Edit Submission</button>
                           )}
                        </div>
                     ) : (
                        <div className="space-y-6">
                            <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Written Response</label><textarea value={submissionText} onChange={(e) => setSubmissionText(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 h-32 resize-none text-sm font-medium" placeholder="Type your answer here..." /></div>
                            <div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Attachments</label><div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all group"><Upload size={24} className="text-slate-400 group-hover:text-indigo-500 mb-2" /><span className="text-sm font-bold text-slate-500 group-hover:text-indigo-600">Click to upload files</span></div><input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                                {submissionFiles.length > 0 && (<div className="mt-3 space-y-2">{submissionFiles.map((f, i) => (<div key={i} className="flex justify-between items-center p-3 bg-indigo-50 rounded-xl border border-indigo-100"><span className="text-xs font-bold text-indigo-700 truncate max-w-[200px]">{f.name}</span><button onClick={() => setSubmissionFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-indigo-400 hover:text-rose-500"><X size={14} /></button></div>))}</div>)}
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button onClick={handleSubmitWork} disabled={submitting || (!submissionText && submissionFiles.length === 0)} className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-2">{submitting ? 'Turning In...' : submittedSuccess ? 'Submitted!' : 'Turn In Assignment'}</button>
                                {isEditing && <button onClick={handleCancelEdit} className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50">Cancel</button>}
                            </div>
                        </div>
                     )}
                  </div>
               </div>
             )}
          </div>
        )}

        {/* QUIZ PLAYER */}
        {view === 'QUIZ_PLAYER' && selectedAssignment?.quizData && (
          <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
             <div className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-slate-200 animate-pop">
                {showQuizResult ? (
                    <div className="p-12 text-center animate-fade-in relative overflow-hidden">
                        {/* Confetti Decoration */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-10 left-10 w-4 h-4 bg-yellow-400 rounded-full animate-float"></div>
                            <div className="absolute top-20 right-20 w-3 h-3 bg-indigo-400 rounded-full animate-float" style={{animationDelay: '1s'}}></div>
                            <div className="absolute bottom-10 left-20 w-5 h-5 bg-rose-400 rounded-full animate-float" style={{animationDelay: '0.5s'}}></div>
                        </div>

                        <div className="w-32 h-32 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6 text-yellow-500 ring-8 ring-yellow-50 shadow-xl animate-pop">
                           <Trophy size={64} className="drop-shadow-sm" />
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 mb-2">Quiz Complete!</h2>
                        <p className="text-slate-500 font-bold mb-8">Great effort! Here is your result.</p>
                        
                        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 mb-8 max-w-sm mx-auto">
                           <div className="text-7xl font-black text-indigo-600 tracking-tighter mb-1">{quizScore}</div>
                           <div className="text-sm font-bold text-slate-400 uppercase tracking-wide">
                              Total Points / {selectedAssignment.quizData.reduce((acc, q) => acc + q.points, 0)}
                           </div>
                        </div>

                        <button 
                           onClick={() => setView('ASSIGNMENT_DETAIL')} 
                           className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-1 active:scale-95 flex items-center gap-2 mx-auto"
                        >
                           <Rocket size={20} />
                           Return to Assignment
                        </button>
                    </div>
                ) : (
                    <div className="p-8 md:p-10 relative">
                        {/* Progress */}
                        <div className="flex justify-between items-center mb-8">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                               Question {currentQuizQuestionIndex + 1} / {selectedAssignment.quizData.length}
                            </span>
                            <button onClick={() => setView('ASSIGNMENT_DETAIL')} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                               <X size={24} />
                            </button>
                        </div>
                        
                        {/* Question Area */}
                        <div key={currentQuizQuestionIndex} className="animate-slide-up">
                           <div className="mb-10">
                               <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
                                  {selectedAssignment.quizData[currentQuizQuestionIndex].question}
                               </h3>
                           </div>
                           
                           {/* Options */}
                           <div className="space-y-4">
                               {selectedAssignment.quizData[currentQuizQuestionIndex].options.map((opt, idx) => {
                                   const isSelected = selectedOption === idx;
                                   const showCorrect = isSelected && isAnswerCorrect;
                                   const showWrong = isSelected && !isAnswerCorrect;

                                   return (
                                       <button 
                                         key={idx} 
                                         onClick={() => handleQuizAnswer(idx)}
                                         disabled={selectedOption !== null}
                                         className={`w-full p-5 rounded-2xl text-left font-bold transition-all border-2 flex justify-between items-center group relative overflow-hidden ${
                                             showCorrect ? 'bg-emerald-500 border-emerald-500 text-white animate-pop shadow-lg shadow-emerald-200 scale-[1.02]' 
                                             : showWrong ? 'bg-rose-500 border-rose-500 text-white animate-shake shadow-lg shadow-rose-200'
                                             : selectedOption !== null && idx === selectedAssignment.quizData![currentQuizQuestionIndex].correctAnswer 
                                               ? 'bg-emerald-100 border-emerald-200 text-emerald-800 opacity-60' // Dim correct answer if user missed it
                                               : 'bg-white border-slate-100 text-slate-700 hover:border-indigo-500 hover:shadow-md active:scale-95'
                                         }`}
                                         style={{ animationDelay: `${idx * 0.05}s` }}
                                       >
                                           <span className="relative z-10 text-lg">{opt}</span>
                                           {showCorrect && <CheckCircle className="text-white relative z-10 animate-pop" size={24} />}
                                           {showWrong && <AlertCircle className="text-white relative z-10 animate-shake" size={24} />}
                                       </button>
                                   );
                               })}
                           </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-10 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                               className="h-full bg-indigo-600 transition-all duration-500 ease-out" 
                               style={{ width: `${((currentQuizQuestionIndex) / selectedAssignment.quizData.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                )}
             </div>
          </div>
        )}

        {/* FLASHCARD PLAYER */}
        {view === 'FLASHCARD_PLAYER' && studyData && (
            <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <button onClick={() => setView('ASSIGNMENT_DETAIL')} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 bg-white/10 rounded-full"><X size={24} /></button>
                
                <div className="w-full max-w-2xl flex flex-col items-center">
                    
                    {/* Progress Dots */}
                    <div className="flex gap-2 mb-8">
                       {studyData.flashcards.map((_, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === currentFlashcardIndex ? 'bg-white w-6' : 'bg-white/20'}`} />
                       ))}
                    </div>

                    <div className="w-full h-[450px] relative perspective-1000 group">
                         {/* Stack Effect Behind */}
                        <div className="absolute top-4 left-4 right-4 bottom-0 bg-white/10 rounded-[2rem] transform scale-95 origin-bottom transition-all"></div>
                        <div className="absolute top-2 left-2 right-2 bottom-0 bg-white/20 rounded-[2rem] transform scale-[0.98] origin-bottom transition-all"></div>

                        <div 
                            className={`w-full h-full relative transform-style-3d transition-all duration-700 ease-out cursor-pointer shadow-2xl ${isFlipped ? 'rotate-y-180' : ''}`}
                            onClick={() => setIsFlipped(!isFlipped)}
                        >
                            {/* Front */}
                            <div className="absolute inset-0 backface-hidden bg-gradient-to-br from-white to-slate-50 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center shadow-2xl border border-white/50">
                                 <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm">
                                    <HelpCircle size={28} />
                                 </div>
                                 <h3 className="text-3xl font-bold text-slate-800 leading-snug">{studyData.flashcards[currentFlashcardIndex].front}</h3>
                                 
                                 <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 animate-pulse">
                                       <Repeat size={12} /> Tap to Flip
                                    </span>
                                 </div>
                            </div>
                            
                            {/* Back */}
                            <div className="absolute inset-0 backface-hidden rotate-y-180 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-[2rem] p-12 flex flex-col items-center justify-center text-center shadow-2xl border border-white/10 text-white">
                                 <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white mb-6 backdrop-blur-sm">
                                    <Sparkles size={28} />
                                 </div>
                                 <h3 className="text-2xl font-medium leading-relaxed">{studyData.flashcards[currentFlashcardIndex].back}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="mt-10 flex items-center gap-8">
                        <button onClick={prevFlashcard} className="p-5 bg-white rounded-full text-slate-900 shadow-xl hover:scale-110 active:scale-95 transition-all"><ArrowLeft size={24} /></button>
                        <span className="text-white font-bold text-lg tracking-widest font-mono">{currentFlashcardIndex + 1} / {studyData.flashcards.length}</span>
                        <button onClick={nextFlashcard} className="p-5 bg-white rounded-full text-slate-900 shadow-xl hover:scale-110 active:scale-95 transition-all"><ArrowRight size={24} /></button>
                    </div>
                </div>
            </div>
        )}

        {/* SETTINGS */}
        {view === 'SETTINGS' && (
           <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <h2 className="text-3xl font-extrabold text-slate-900">Account Settings</h2>
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-4 mb-8">
                      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl">{user?.displayName?.charAt(0)}</div>
                      <div><h3 className="text-xl font-bold text-slate-900">{user?.displayName}</h3><p className="text-slate-500">{user?.email}</p></div>
                  </div>
                  <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-400 uppercase">School</span>
                          <p className="font-bold text-slate-800">{user?.school || 'Not specified'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-xs font-bold text-slate-400 uppercase">Role</span>
                          <p className="font-bold text-slate-800 capitalize">{user?.role}</p>
                      </div>
                  </div>
              </div>
           </div>
        )}
      </main>

      {/* Join Class Modal - MOVED OUTSIDE OF VIEWS */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-0 max-w-md w-full shadow-2xl transform transition-all scale-100 overflow-hidden ring-1 ring-slate-200">
              <div className="relative">
                  {/* Decorative Background */}
                  <div className="h-32 bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 opacity-20">
                          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                              <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
                          </svg>
                      </div>
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg border border-white/30 z-10">
                          <KeyRound className="text-white w-8 h-8" strokeWidth={2.5} />
                      </div>
                      <button 
                        onClick={() => setShowJoinModal(false)} 
                        className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 rounded-full text-white/90 hover:text-white transition-colors backdrop-blur-sm"
                      >
                        <X size={18} />
                      </button>
                  </div>
              </div>

              <div className="p-8">
                  <div className="text-center mb-6">
                      <h3 className="text-2xl font-extrabold text-slate-900">Join a Class</h3>
                      <p className="text-slate-500 font-medium mt-1">Enter the access code from your teacher.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="relative">
                        <label className="absolute -top-2 left-4 bg-white px-2 text-xs font-bold text-indigo-600">Class Code</label>
                        <input 
                            value={shareCode} 
                            onChange={(e) => {
                                setShareCode(e.target.value.toUpperCase());
                                setJoinError('');
                            }} 
                            placeholder="XY9Z2A" 
                            maxLength={6} 
                            className="w-full p-4 bg-white border-2 border-indigo-100 rounded-2xl text-center text-3xl font-mono font-bold tracking-[0.5em] outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all uppercase text-slate-800 placeholder:text-slate-200" 
                            autoFocus
                        />
                        {shareCode.length === 6 && !joinError && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 bg-emerald-50 rounded-full p-1"><CheckCircle size={20} /></div>
                        )}
                    </div>
                    
                    {joinError && (
                        <div className="flex items-center justify-center gap-2 text-rose-600 text-sm font-bold bg-rose-50 p-3 rounded-xl border border-rose-100">
                            <AlertCircle size={16} /> {joinError}
                        </div>
                    )}

                    <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs">{user.displayName?.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 font-bold">Joining as</p>
                            <p className="text-sm font-bold text-slate-900 truncate">{user.displayName}</p>
                        </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleJoinClass} 
                    disabled={shareCode.length !== 6 || isJoining} 
                    className="w-full mt-6 bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
                  >
                      {isJoining ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Join Classroom</span>
                          <ArrowRight size={20} />
                        </>
                      )}
                  </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPortal;
