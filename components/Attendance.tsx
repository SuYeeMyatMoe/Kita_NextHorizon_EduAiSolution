
import React, { useState, useEffect, useMemo } from 'react';
import { db, collection, addDoc, getDocs, auth, query, where, doc, setDoc, onSnapshot, updateDoc, arrayUnion, User, getDoc, deleteDoc } from '../services/firebase';
import { ExpectedStudent, AttendanceReport, Classroom } from '../types';
import { generateAttendanceSummary } from '../services/geminiService';
import { Calendar, Sparkles, Save, Check, History as HistoryIcon, ArrowLeft, Wifi, UserCheck, UserX, RefreshCw, QrCode, Lock } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface AttendanceProps {
  user: User;
  initialClasses: string[];
}

type ViewMode = 'ENTRY' | 'HISTORY';

const Attendance: React.FC<AttendanceProps> = ({ user }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('ENTRY');
  
  // --- ENTRY STATE ---
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // Live Session State
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [students, setStudents] = useState<ExpectedStudent[]>([]);
  const [presentStudentIds, setPresentStudentIds] = useState<Set<string>>(new Set());
  
  // AI & Saving State
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);
  const [recordSaved, setRecordSaved] = useState(false);

  // --- HISTORY STATE ---
  const [historyReports, setHistoryReports] = useState<AttendanceReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<AttendanceReport | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch Classrooms on Mount
  useEffect(() => {
    if (user && user.uid) {
      const fetchClassrooms = async () => {
        try {
          const q = query(collection(db, 'classrooms'), where('teacherId', '==', user.uid));
          const snapshot = await getDocs(q);
          const list: Classroom[] = [];
          snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() } as Classroom));
          setClassrooms(list);
          if (list.length > 0) setSelectedClassId(list[0].id);
        } catch (e) {
          console.error("Error fetching classrooms:", e);
        }
      };
      fetchClassrooms();
    }
  }, [user]);

  // Fetch Students for Selected Class
  useEffect(() => {
    if (selectedClassId) {
        const fetchStudents = async () => {
            try {
                // Optimization: Use studentIds from the classroom document if available.
                // This bypasses potential permission issues with querying the entire 'users' collection.
                const currentClass = classrooms.find(c => c.id === selectedClassId);
                
                if (currentClass && currentClass.studentIds && currentClass.studentIds.length > 0) {
                    const studentPromises = currentClass.studentIds.map(async (studentId) => {
                        try {
                            const studentDoc = await getDoc(doc(db, 'users', studentId));
                            if (studentDoc.exists()) {
                                const data = studentDoc.data();
                                return {
                                    id: studentDoc.id,
                                    name: data.displayName || 'Unknown Student',
                                    status: 'Absent'
                                } as ExpectedStudent;
                            }
                        } catch (err) {
                            console.warn(`Failed to fetch student ${studentId}`, err);
                        }
                        return null;
                    });

                    const results = await Promise.all(studentPromises);
                    const validStudents = results.filter(s => s !== null) as ExpectedStudent[];
                    validStudents.sort((a, b) => a.name.localeCompare(b.name));
                    setStudents(validStudents);
                } else {
                    // If no studentIds are found, we return an empty list rather than risking a permission error
                    // with a broad collection query.
                    setStudents([]);
                }
            } catch (e) {
                console.error("Error fetching students:", e);
                setStudents([]);
            }
        };
        fetchStudents();
        setPresentStudentIds(new Set()); // Reset attendance when class changes
        setIsSessionActive(false);
        setSessionCode('');
    }
  }, [selectedClassId, classrooms]);

  // Real-time Listener for Active Session & CheckIns
  useEffect(() => {
      if (!isSessionActive || !selectedClassId || !attendanceDate) return;

      // 1. Listen to Session Status (mostly to keep code sync, though teacher controls it)
      const sessionDocRef = doc(db, 'classrooms', selectedClassId, 'attendanceSessions', attendanceDate);
      
      // 2. Listen to the checkIns Subcollection
      // This matches the security rule: match /checkIns/{studentId}
      const checkInsColRef = collection(sessionDocRef, 'checkIns');
      
      const unsubscribe = onSnapshot(checkInsColRef, (snapshot) => {
          const attendees = new Set<string>();
          snapshot.forEach(doc => {
              attendees.add(doc.id); // doc.id is studentId based on security rules
          });
          setPresentStudentIds(attendees);
      }, (error) => {
          console.error("Error listening to attendance:", error);
      });

      return () => unsubscribe();
  }, [isSessionActive, selectedClassId, attendanceDate]);

  // Fetch History Effect
  useEffect(() => {
    if (viewMode === 'HISTORY' && user && user.uid) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
           const classQ = query(collection(db, 'classrooms'), where('teacherId', '==', user.uid));
           const classSnap = await getDocs(classQ);
           let allReports: AttendanceReport[] = [];
           
           await Promise.all(classSnap.docs.map(async (classDoc) => {
               const attSnap = await getDocs(collection(db, 'classrooms', classDoc.id, 'attendance'));
               const classReports = attSnap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceReport));
               allReports.push(...classReports);
           }));
           
           allReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
           setHistoryReports(allReports);
        } catch (e) {
          console.error("Error fetching history", e);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [viewMode, user]);

  const stats = useMemo(() => {
    const present = presentStudentIds.size;
    const total = students.length;
    const absent = Math.max(0, total - present);
    return { present, absent, total };
  }, [students, presentStudentIds]);

  // Handlers
  const handleStartSession = async () => {
      if (!selectedClassId) return;
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setSessionCode(code);
      setIsSessionActive(true);

      // Create/Overwrite the live session doc in attendanceSessions
      try {
          await setDoc(doc(db, 'classrooms', selectedClassId, 'attendanceSessions', attendanceDate), {
              code: code,
              active: true,
              createdAt: new Date().toISOString()
          });
      } catch (e) {
          console.error("Error starting session:", e);
          alert("Failed to start live session.");
      }
  };

  const handleStopSession = async () => {
      setIsSessionActive(false);
      if (selectedClassId) {
          // Mark session inactive in DB
          try {
              await updateDoc(doc(db, 'classrooms', selectedClassId, 'attendanceSessions', attendanceDate), {
                  active: false
              });
          } catch (e) { console.error(e); }
      }
  };

  const toggleStudentStatus = async (studentId: string) => {
      // Optimistic update
      const wasPresent = presentStudentIds.has(studentId);
      
      setPresentStudentIds(prev => {
          const next = new Set(prev);
          if (next.has(studentId)) next.delete(studentId);
          else next.add(studentId);
          return next;
      });

      // Sync with Firestore CheckIn Subcollection
      // This allows manual override by teacher to also appear in the subcollection
      try {
          const sessionDocRef = doc(db, 'classrooms', selectedClassId, 'attendanceSessions', attendanceDate);
          const checkInDocRef = doc(sessionDocRef, 'checkIns', studentId);

          if (wasPresent) {
              // Deleting check-in
              await deleteDoc(checkInDocRef);
          } else {
              // Adding check-in
              const student = students.find(s => s.id === studentId);
              await setDoc(checkInDocRef, {
                  studentId: studentId,
                  name: student?.name || 'Manual Entry',
                  timestamp: new Date().toISOString(),
                  type: 'MANUAL'
              });
          }
      } catch (e) {
          console.error("Error syncing manual status:", e);
      }
  };

  const handleGenerateSummary = async () => {
    if (students.length === 0) return;
    setLoadingSummary(true);
    
    const currentClassName = classrooms.find(c => c.id === selectedClassId)?.name || 'Class';
    const absentNames = students
      .filter(s => !presentStudentIds.has(s.id))
      .map(s => s.name);

    const result = await generateAttendanceSummary(
      attendanceDate,
      currentClassName,
      stats.present,
      stats.absent,
      absentNames
    );
    
    setSummary(result);
    setLoadingSummary(false);
  };

  const handleSaveRecord = async () => {
    if (students.length === 0 || !user || !user.uid || !selectedClassId) return;
    setSavingRecord(true);

    try {
      const cleanStudents = students.map(s => ({
        name: s.name,
        id: s.id,
        status: presentStudentIds.has(s.id) ? 'Present' : 'Absent',
        timestamp: null
      }));

      const currentClassName = classrooms.find(c => c.id === selectedClassId)?.name || 'Unknown';

      const payload = {
        teacherId: user.uid,
        date: attendanceDate,
        class: currentClassName,
        classId: selectedClassId,
        stats: stats,
        students: cleanStudents,
        summary: summary || '',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "classrooms", selectedClassId, "attendance"), payload);
      
      // Cleanup live session
      handleStopSession();
      setRecordSaved(true);
      
      setTimeout(() => {
        setRecordSaved(false);
        setSummary('');
        setPresentStudentIds(new Set());
      }, 1500);

    } catch (error) {
      console.error("Error saving record:", error);
      alert("Failed to save record.");
    } finally {
      setSavingRecord(false);
    }
  };

  const renderEntryView = () => (
    <div className="flex flex-col lg:flex-row gap-8 animate-fade-in">
        {/* Left Column: Live Control */}
        <div className="lg:w-1/3 space-y-6">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100 border border-slate-100 relative overflow-hidden">
             {isSessionActive ? (
                 <div className="flex flex-col items-center text-center animate-fade-in">
            
                     <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold mb-6 animate-pulse">
                        <Wifi size={14} /> LIVE SESSION ACTIVE
                     </span>
                     
                     <div className="bg-slate-900 p-4 rounded-3xl shadow-2xl mb-6">
                        <QRCodeCanvas
                            value={sessionCode}
                            size={180}
                            bgColor={"#0f172a"}
                            fgColor={"#ffffff"}
                            level={"H"}
                            includeMargin={true}
                        />
                     </div>

                     <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Entry Code</h3>
                     <div className="text-6xl font-black text-slate-900 tracking-tighter mb-8">{sessionCode}</div>

                     <button 
                        onClick={handleStopSession}
                        className="w-full py-4 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center gap-2"
                     >
                        <Lock size={18} /> Stop Session
                     </button>
                 </div>
             ) : (
                 <div className="flex flex-col items-center text-center py-8">
                     <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 mb-6">
                        <QrCode size={32} />
                     </div>
                     <h3 className="text-2xl font-extrabold text-slate-900 mb-2">Start Attendance</h3>
                     <p className="text-slate-500 text-sm mb-8 px-4">Generate a live code. Students can check-in instantly using their portal.</p>
                     
                     <button 
                        onClick={handleStartSession}
                        disabled={students.length === 0}
                        className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none"
                     >
                        <Wifi size={20} /> Generate Code
                     </button>
                     {students.length === 0 && <p className="text-xs text-rose-500 font-bold mt-4">No students enrolled in this class yet.</p>}
                 </div>
             )}
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
             <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><RefreshCw size={18} className="text-slate-400"/> Manual Override</h4>
             <p className="text-xs text-slate-500 mb-4">Tap any student in the list to manually mark them Present/Absent if they don't have a device.</p>
          </div>
        </div>

        {/* Right: Roster & Analysis */}
        <div className="lg:w-2/3 space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
             <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm text-center">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total</p>
                <p className="text-3xl font-black text-slate-900 mt-1">{stats.total}</p>
             </div>
             <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 text-center">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Present</p>
                <p className="text-3xl font-black text-emerald-700 mt-1">{stats.present}</p>
             </div>
             <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 text-center">
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wide">Absent</p>
                <p className="text-3xl font-black text-rose-700 mt-1">{stats.absent}</p>
             </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleGenerateSummary}
                disabled={students.length === 0 || loadingSummary}
                className="flex-1 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loadingSummary ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {loadingSummary ? 'Analyzing...' : 'AI Summary'}
              </button>

              <button 
                onClick={handleSaveRecord}
                disabled={students.length === 0 || savingRecord || recordSaved}
                className={`flex-1 font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg hover:-translate-y-0.5 ${recordSaved ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-300'}`}
              >
                 {recordSaved ? <Check size={18} /> : savingRecord ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                 {recordSaved ? 'Saved!' : 'Finalize & Save'}
              </button>
          </div>

          {summary && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 animate-fade-in flex gap-4">
               <div className="p-2 bg-white rounded-lg h-fit text-indigo-600"><Sparkles size={20} /></div>
               <div>
                   <h3 className="font-bold text-indigo-900 mb-1">Attendance Insight</h3>
                   <p className="text-slate-700 text-sm leading-relaxed">{summary}</p>
               </div>
            </div>
          )}

          {/* Student Grid */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden min-h-[400px] flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
               <h3 className="font-bold text-slate-800 flex items-center gap-2">
                 <Calendar className="text-slate-400" size={18} />
                 {attendanceDate} Roster
               </h3>
               <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
                   {classrooms.find(c => c.id === selectedClassId)?.name}
               </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 max-h-[500px]">
               {students.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {students.map(student => {
                         const isPresent = presentStudentIds.has(student.id);
                         return (
                             <div 
                                key={student.id} 
                                onClick={() => toggleStudentStatus(student.id)}
                                className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 group ${isPresent ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                             >
                                 <div className="flex items-center gap-3">
                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${isPresent ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                                         {student.name.charAt(0)}
                                     </div>
                                     <div>
                                         <p className={`font-bold text-sm ${isPresent ? 'text-emerald-900' : 'text-slate-700'}`}>{student.name}</p>
                                         <p className={`text-[10px] font-bold uppercase tracking-wide ${isPresent ? 'text-emerald-600' : 'text-slate-400'}`}>
                                             {isPresent ? 'Present' : 'Absent'}
                                         </p>
                                     </div>
                                 </div>
                                 <div className={`p-2 rounded-full transition-all ${isPresent ? 'text-emerald-600 bg-emerald-100' : 'text-slate-300 group-hover:text-slate-400'}`}>
                                     {isPresent ? <UserCheck size={20} /> : <UserX size={20} />}
                                 </div>
                             </div>
                         );
                     })}
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 p-10">
                    <p className="font-bold text-slate-600">No students found.</p>
                    <p className="text-xs mt-2 text-center max-w-xs">Ensure students have joined this class using the Student Portal.</p>
                 </div>
               )}
            </div>
          </div>
        </div>
    </div>
  );

  const renderHistoryView = () => {
    if (selectedReport) {
        return (
            <div className="animate-fade-in space-y-6">
                <button onClick={() => setSelectedReport(null)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm transition-colors">
                    <ArrowLeft size={16} /> Back to History
                </button>
                <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{selectedReport.class} - {new Date(selectedReport.date).toLocaleDateString()}</h2>
                            <p className="text-slate-500 mt-1">{selectedReport.stats.present} Present, {selectedReport.stats.absent} Absent</p>
                        </div>
                        <div className="text-right">
                             <div className="text-3xl font-black text-indigo-600">
                                {Math.round((selectedReport.stats.present / selectedReport.stats.total) * 100)}%
                             </div>
                             <div className="text-xs font-bold text-slate-400 uppercase">Attendance</div>
                        </div>
                    </div>
                    {selectedReport.summary && (
                        <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-xl mb-8">
                             <h4 className="flex items-center gap-2 font-bold text-indigo-900 mb-2"><Sparkles size={16}/> Insight</h4>
                             <p className="text-slate-700 text-sm">{selectedReport.summary}</p>
                        </div>
                    )}
                    <h3 className="font-bold text-slate-800 mb-4">Absentees</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedReport.students.filter(s => s.status === 'Absent').length > 0 ? 
                            selectedReport.students.filter(s => s.status === 'Absent').map((s, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                                    <div className="w-8 h-8 bg-rose-200 text-rose-700 rounded-lg flex items-center justify-center font-bold text-xs">{s.name.charAt(0)}</div>
                                    <span className="font-bold text-slate-700">{s.name}</span>
                                </div>
                            ))
                        : (
                            <p className="text-slate-500 italic">No students were absent.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
             <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                 <h3 className="font-bold text-slate-800 flex items-center gap-2">
                     <HistoryIcon size={18} className="text-slate-400" /> Past Reports
                 </h3>
             </div>
             {loadingHistory ? (
                 <div className="p-10 text-center text-slate-500">Loading records...</div>
             ) : historyReports.length > 0 ? (
                 <table className="w-full">
                     <thead className="bg-slate-50 border-b border-slate-100">
                         <tr>
                             <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Date</th>
                             <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Class</th>
                             <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase">Attendance Rate</th>
                             <th className="px-6 py-4 text-right"></th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100">
                         {historyReports.map(report => (
                             <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                                 <td className="px-6 py-4 font-bold text-slate-700">{report.date}</td>
                                 <td className="px-6 py-4 font-medium text-slate-600">{report.class}</td>
                                 <td className="px-6 py-4 text-center">
                                     <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                         (report.stats.present / report.stats.total) < 0.8 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                     }`}>
                                         {Math.round((report.stats.present / report.stats.total) * 100)}%
                                     </span>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                     <button onClick={() => setSelectedReport(report)} className="text-indigo-600 hover:text-indigo-800 font-bold text-sm hover:underline">View Details</button>
                                 </td>
                             </tr>
                         ))}
                     </tbody>
                 </table>
             ) : (
                 <div className="p-12 text-center text-slate-400">No history found.</div>
             )}
        </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20 no-print">
      {/* Header & View Toggle */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex flex-col xl:flex-row justify-between items-center gap-6">
            <div>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
                <Wifi className="text-indigo-600" size={32} />
                Smart Roll Call
              </h2>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl">
                 <button 
                    onClick={() => setViewMode('ENTRY')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'ENTRY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    Live Entry
                 </button>
                 <button 
                    onClick={() => setViewMode('HISTORY')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'HISTORY' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                    History
                 </button>
            </div>
            
            {viewMode === 'ENTRY' && (
                <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                    {classrooms.length > 0 ? (
                        <select 
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            className="bg-transparent text-sm font-bold text-slate-700 py-2 px-3 outline-none cursor-pointer"
                        >
                            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    ) : (
                        <span className="text-xs px-2 text-slate-400">No classes yet</span>
                    )}
                </div>

                <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input 
                        type="date"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                </div>
            )}
        </div>
      </div>

      {viewMode === 'ENTRY' ? renderEntryView() : renderHistoryView()}
    </div>
  );
};

export default Attendance;
