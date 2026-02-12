
import React, { useState, useEffect, useRef } from 'react';
import { db, collection, addDoc, onSnapshot, query, doc, setDoc, where, getDocs, auth, deleteDoc } from '../services/firebase';
import { Classroom, Assignment, ClassroomSubmission, AnalysisResponse, SubmissionRecord, AssignmentType, QuizQuestion } from '../types';
import { analyzeSubmission, generateEducationalContent, generateClassroomQuiz, generateQuizAnalysis } from '../services/geminiService';
import StudentResult from './StudentResult';
import { Plus, Users, Copy, Check, ChevronRight, FileText, Calendar, Upload, X, GraduationCap, ArrowLeft, Loader2, Library, Clock, Sparkles, Pencil, Save, BookOpen, Wand2, Trash2, AlertCircle, PlayCircle, FileBox, HelpCircle, Download, FileIcon, Eye, CheckCircle } from 'lucide-react';

const ClassroomManager: React.FC = () => {
  const [view, setView] = useState<'LIST' | 'DETAIL' | 'GRADING'>('LIST');
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<ClassroomSubmission[]>([]);
  
  const [selectedClass, setSelectedClass] = useState<Classroom | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<ClassroomSubmission | null>(null);
  
  // Creation States
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState(''); 
  const [newClassSubject, setNewClassSubject] = useState('');
  
  // Assignment/Content Creation State
  const [isCreatingContent, setIsCreatingContent] = useState(false);
  const [contentType, setContentType] = useState<AssignmentType>('ASSIGNMENT');
  
  const [newAsmTitle, setNewAsmTitle] = useState('');
  const [newAsmDesc, setNewAsmDesc] = useState('');
  const [newAsmRubric, setNewAsmRubric] = useState('Accuracy (10pts), Clarity (10pts)');
  const [newAsmDueDate, setNewAsmDueDate] = useState('');
  const [newAsmFiles, setNewAsmFiles] = useState<any[]>([]);
  
  // Quiz Builder State
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentOptions, setCurrentOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  
  // Editing Assignment State
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editAsmTitle, setEditAsmTitle] = useState('');
  const [editAsmDesc, setEditAsmDesc] = useState('');
  const [editAsmRubric, setEditAsmRubric] = useState('');
  const [editAsmDueDate, setEditAsmDueDate] = useState('');

  // AI Generation State (for Assignments)
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiContext, setAiContext] = useState('');
  const [isGeneratingAssignment, setIsGeneratingAssignment] = useState(false);

  const [gradingResult, setGradingResult] = useState<AnalysisResponse | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const asmFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Classrooms
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
        collection(db, 'classrooms'), 
        where('teacherId', '==', auth.currentUser.uid)
    );
    const unsub = onSnapshot(q, (snapshot: any) => {
       const list: Classroom[] = [];
       snapshot.forEach((doc: any) => list.push({ id: doc.id, ...doc.data() } as Classroom));
       setClassrooms(list);
    }, (error) => {
       console.error("Error fetching classrooms:", error);
    });
    return () => unsub();
  }, []);

  // Fetch Assignments
  useEffect(() => {
    if (!selectedClass) return;
    const asmQ = collection(db, 'classrooms', selectedClass.id, 'assignments');
    const unsubAsm = onSnapshot(asmQ, (snapshot: any) => {
       const list: Assignment[] = [];
       snapshot.forEach((doc: any) => {
         list.push({ id: doc.id, ...doc.data() } as Assignment);
       });
       setAssignments(list);
    }, (error) => {
       console.error("Error fetching assignments:", error);
    });
    return () => unsubAsm();
  }, [selectedClass]);

  // Fetch Submissions
  useEffect(() => {
    if (!selectedClass || assignments.length === 0) {
        if(assignments.length === 0) setSubmissions([]);
        return;
    }

    const unsubscribes: (() => void)[] = [];
    const subsMap = new Map<string, ClassroomSubmission>();

    assignments.forEach(asm => {
        const q = collection(db, 'classrooms', selectedClass.id, 'assignments', asm.id, 'submissions');
        const unsub = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added' || change.type === 'modified') {
                    subsMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() } as ClassroomSubmission);
                } else if (change.type === 'removed') {
                    subsMap.delete(change.doc.id);
                }
            });
            setSubmissions(Array.from(subsMap.values()));
        }, (err) => {
            console.warn(`Skipping subs for ${asm.id}:`, err.message);
        });
        unsubscribes.push(unsub);
    });

    return () => { unsubscribes.forEach(u => u()); };
  }, [assignments, selectedClass]);

  // ... (Creation Handlers remain same) ...
  const handleCreateClass = async () => {
    if (!newClassName || !auth.currentUser) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await addDoc(collection(db, 'classrooms'), {
      name: newClassName,
      subject: newClassSubject || 'General',
      description: newClassDesc,
      teacherId: auth.currentUser.uid,
      shareCode: code,
      studentIds: [], 
      createdAt: new Date().toISOString()
    });
    setNewClassName(''); setNewClassDesc(''); setNewClassSubject(''); setIsCreatingClass(false);
  };

  const handleDeleteClass = async (classId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (window.confirm("Are you sure you want to delete this class? This action cannot be undone.")) {
        try {
            await deleteDoc(doc(db, 'classrooms', classId));
            // If the deleted class was selected, reset view
            if (selectedClass?.id === classId) {
                setSelectedClass(null);
                setView('LIST');
            }
        } catch (e: any) {
            console.error("Error deleting class:", e);
            alert("Failed to delete class: " + e.message);
        }
    }
  };

  const handleAddQuizQuestion = () => {
    if (!currentQuestion || currentOptions.some(o => !o)) return;
    setQuizQuestions([...quizQuestions, { id: Date.now().toString(), question: currentQuestion, options: [...currentOptions], correctAnswer: correctOption, points: 10 }]);
    setCurrentQuestion(''); setCurrentOptions(['', '', '', '']); setCorrectOption(0);
  };

  const handleRemoveQuizQuestion = (idx: number) => {
    setQuizQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAutoGenerateQuiz = async () => {
    if (!newAsmTitle && !newAsmDesc && newAsmFiles.length === 0) { alert("Please provide a Title, Instructions, or upload files for context first."); return; }
    setIsGeneratingQuiz(true);
    try {
        const questions = await generateClassroomQuiz(newAsmTitle, newAsmDesc, newAsmFiles);
        if (questions.length > 0) setQuizQuestions(prev => [...prev, ...questions]);
        else alert("No questions could be generated. Please try adding more context.");
    } catch (e) { console.error(e); alert("Failed to generate quiz."); } finally { setIsGeneratingQuiz(false); }
  };

  const handleCreateContent = async () => {
    if (!newAsmTitle || !selectedClass || !auth.currentUser) return;
    if (contentType === 'QUIZ' && quizQuestions.length === 0) { alert("Please add at least one question to the quiz."); return; }

    const payload: any = {
      classroomId: selectedClass.id,
      title: newAsmTitle,
      description: newAsmDesc,
      type: contentType,
      referenceFiles: newAsmFiles,
      createdAt: new Date().toISOString()
    };

    if (contentType === 'ASSIGNMENT') { payload.rubric = newAsmRubric; payload.dueDate = newAsmDueDate || new Date().toISOString().split('T')[0]; }
    else if (contentType === 'QUIZ') { payload.quizData = quizQuestions; payload.dueDate = newAsmDueDate || new Date().toISOString().split('T')[0]; payload.rubric = ''; }
    else if (contentType === 'MATERIAL') { payload.rubric = ''; payload.dueDate = ''; }

    await addDoc(collection(db, 'classrooms', selectedClass.id, 'assignments'), payload);
    setNewAsmTitle(''); setNewAsmDesc(''); setNewAsmRubric('Accuracy (10pts), Clarity (10pts)'); setNewAsmDueDate(''); setNewAsmFiles([]); setQuizQuestions([]); setIsCreatingContent(false);
  };

  const handleAiGenerateAssignment = async () => {
    if (!aiTopic) return;
    setIsGeneratingAssignment(true);
    try {
      const data = await generateEducationalContent('Assignment', aiTopic, `Subject: ${selectedClass?.subject || 'General'}. Context: ${aiContext}.`);
      if (data) {
        setNewAsmTitle(data.title);
        let desc = data.overview || "";
        if (data.objectives) desc += "\n\nObjectives:\n" + data.objectives.map((o:string) => `- ${o}`).join('\n');
        if (data.instructions) desc += "\n\nInstructions:\n" + data.instructions.map((i:string) => `${i}`).join('\n');
        setNewAsmDesc(desc);
        if (data.gradingCriteria) setNewAsmRubric(data.gradingCriteria.join('\n'));
        setShowAiModal(false); setAiTopic(''); setAiContext('');
      }
    } catch (e) { console.error(e); alert("Failed to generate content."); } finally { setIsGeneratingAssignment(false); }
  };

  const handleUploadAsmFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) { Array.from(files).forEach((file: File) => { const reader = new FileReader(); reader.onloadend = () => { setNewAsmFiles(prev => [...prev, { name: file.name, mimeType: file.type, data: (reader.result as string).split(',')[1] }]); }; reader.readAsDataURL(file); }); }
  };

  const handleEditAssignment = (asm: Assignment) => {
    setEditingAssignment(asm); setEditAsmTitle(asm.title); setEditAsmDesc(asm.description); setEditAsmRubric(asm.rubric || ''); setEditAsmDueDate(asm.dueDate || '');
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignment || !selectedClass) return;
    try {
        await setDoc(doc(db, 'classrooms', selectedClass.id, 'assignments', editingAssignment.id), {
            title: editAsmTitle, description: editAsmDesc, rubric: editAsmRubric, dueDate: editAsmDueDate
        }, { merge: true });
        setEditingAssignment(null);
    } catch (e) { console.error(e); alert("Failed to update assignment"); }
  };

  const handleGradeSubmission = async (sub: ClassroomSubmission, asm: Assignment) => {
    setIsGrading(true);
    setSelectedSubmission(sub);
    setSelectedAssignment(asm);
    setView('GRADING');
    
    if (sub.status === 'GRADED' && sub.gradeResult) {
        setGradingResult(sub.gradeResult);
        setIsGrading(false);
        return;
    }

    try {
       if (asm.type === 'QUIZ' && asm.quizData) {
           let earned = 0; let total = 0;
           asm.quizData.forEach((q, i) => {
               total += q.points;
               if (sub.selectedOptions && sub.selectedOptions[i] === q.correctAnswer) { earned += q.points; }
           });
           const percentage = Math.round((earned / total) * 100);
           const analysis = await generateQuizAnalysis(asm.quizData, sub.selectedOptions || [], { earned, total, percentage });
           setGradingResult(analysis);
       } else {
           let submissionText = sub.textResponse || "";
           const result = await analyzeSubmission(asm.rubric, asm.title + "\n" + asm.description, submissionText, sub.files, undefined, asm.referenceFiles);
           setGradingResult(result);
       }
    } catch (e) { alert("Error grading submission"); setView('DETAIL'); } finally { setIsGrading(false); }
  };

  const handleSaveGrade = async (studentName: string, className: string, subject: string, result: AnalysisResponse) => {
     if (!selectedSubmission || !selectedClass || !selectedAssignment || !auth.currentUser) return;
     
     try {
         // Update the specific submission document
         await setDoc(doc(db, 'classrooms', selectedClass.id, 'assignments', selectedAssignment.id, 'submissions', selectedSubmission.id), {
           status: 'GRADED',
           gradeResult: result,
           teacherId: auth.currentUser.uid
         }, { merge: true });

         alert("Grade Saved!");
         setView('DETAIL');
     } catch (e: any) {
         console.error("Error saving grade:", e);
         alert("Failed to save grade: " + e.message);
     }
  };

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); setCopiedCode(code); setTimeout(() => setCopiedCode(''), 2000); };
  const renderIconForType = (type: AssignmentType) => { switch (type) { case 'QUIZ': return <PlayCircle size={18} className="text-purple-600" />; case 'MATERIAL': return <FileBox size={18} className="text-emerald-600" />; default: return <FileText size={18} className="text-indigo-600" />; } };
  const downloadFile = (file: { data: string; mimeType: string; name: string }) => { const link = document.createElement('a'); link.href = `data:${file.mimeType};base64,${file.data}`; link.download = file.name; link.click(); };

  if (view === 'LIST') {
      return (
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3"><Library className="text-indigo-600" size={32} /> Classroom Manager</h2><p className="text-slate-500 mt-2 font-medium">Create classes, assign work, and grade submissions.</p></div>
          <button onClick={() => setIsCreatingClass(true)} className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-slate-200 hover:-translate-y-0.5"><Plus size={20} /> New Class</button>
        </header>
        {isCreatingClass && (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 animate-fade-in ring-1 ring-slate-100"><h3 className="font-bold text-xl text-slate-800 mb-6 flex items-center gap-2"><div className="p-2 bg-indigo-50 rounded-lg text-indigo-600"><Users size={20}/></div>Create New Class</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4"><div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Class Name</label><input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="e.g. 5-Cerdas" className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"/></div><div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Subject</label><input value={newClassSubject} onChange={(e) => setNewClassSubject(e.target.value)} placeholder="e.g. Physics" className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"/></div></div><div className="mb-6"><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Description</label><textarea value={newClassDesc} onChange={(e) => setNewClassDesc(e.target.value)} placeholder="Class objectives and details..." className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 font-medium h-24 resize-none"/></div><div className="flex gap-4 border-t border-slate-100 pt-6"><button onClick={handleCreateClass} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">Create Class</button><button onClick={() => setIsCreatingClass(false)} className="text-slate-500 font-bold px-6 py-3 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button></div></div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {classrooms.map(cls => (
             <div key={cls.id} onClick={() => { setSelectedClass(cls); setView('DETAIL'); }} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all group relative flex flex-col h-full cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                   <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors"><BookOpen size={24} /></div>
                   <div className="flex gap-2">
                       <button onClick={(e) => { e.stopPropagation(); copyCode(cls.shareCode); }} className="flex items-center gap-1.5 text-xs font-bold bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white hover:border-indigo-300 transition-all">{copiedCode === cls.shareCode ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}<span className="font-mono">{cls.shareCode}</span></button>
                       <button onClick={(e) => handleDeleteClass(cls.id, e)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors bg-slate-50 border border-slate-200" title="Delete Class"><Trash2 size={16} /></button>
                   </div>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-1">{cls.name}</h3><p className="text-indigo-600 text-sm font-bold mb-3">{cls.subject}</p>{cls.description && <p className="text-slate-500 text-sm leading-relaxed mb-6 line-clamp-2">{cls.description}</p>}
                <div className="mt-auto pt-6 border-t border-slate-50"><button className="w-full py-3.5 rounded-xl bg-slate-50 text-slate-700 font-bold hover:bg-slate-900 hover:text-white transition-all flex items-center justify-center gap-2 group/btn">Manage Class <ChevronRight size={16} className="text-slate-400 group-hover/btn:text-white transition-colors" /></button></div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  // ... (Detail view and other logic remains same)
  if (view === 'DETAIL' && selectedClass) {
      return (
      <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
         <button onClick={() => setView('LIST')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm mb-2 group"><div className="p-1.5 bg-white border border-slate-200 rounded-lg group-hover:border-indigo-300 transition-colors"><ArrowLeft size={16} /></div>Back to Classes</button>
         <div className="flex flex-col md:flex-row justify-between items-end bg-gradient-to-br from-indigo-900 to-slate-900 p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200 relative overflow-hidden text-white"><div className="absolute top-0 right-0 p-12 opacity-10"><Library size={300} /></div><div className="relative z-10"><div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-indigo-200 mb-4"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Active Session</div><h2 className="text-4xl font-extrabold tracking-tight mb-2">{selectedClass.name}</h2><p className="text-indigo-200 font-medium text-lg max-w-2xl">{selectedClass.description || selectedClass.subject}</p><div className="flex items-center gap-4 mt-6"><div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/10"><span className="text-xs font-bold text-slate-400 uppercase">Code</span><span className="font-mono font-bold text-white tracking-wider">{selectedClass.shareCode}</span><button onClick={() => copyCode(selectedClass.shareCode)} className="ml-2 text-slate-400 hover:text-white"><Copy size={14} /></button></div></div></div><button onClick={() => setIsCreatingContent(true)} className="relative z-10 bg-white text-indigo-900 px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform mt-6 md:mt-0"><Plus size={20} /> Add Content</button></div>
         {isCreatingContent && (
            <div className="bg-white p-8 rounded-[2rem] border border-indigo-100 shadow-xl shadow-indigo-50/50 animate-fade-in relative ring-1 ring-indigo-50">
               {/* Content Creation Form */}
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4"><div><h3 className="font-bold text-xl text-slate-900">Create New Content</h3><p className="text-slate-500 text-sm">Select content type.</p></div><div className="flex bg-slate-100 p-1 rounded-xl">{(['ASSIGNMENT', 'QUIZ', 'MATERIAL'] as AssignmentType[]).map(t => (<button key={t} onClick={() => setContentType(t)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${contentType === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{renderIconForType(t)}{t}</button>))}</div>{contentType === 'ASSIGNMENT' && (<button onClick={() => setShowAiModal(true)} className="flex items-center gap-2 text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all hover:-translate-y-0.5"><Sparkles size={16} className="fill-white/20" /> AI Assist</button>)}</div>
               <div className="space-y-5"><div className="grid grid-cols-1 md:grid-cols-3 gap-5"><div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Title</label><input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder={`e.g. ${contentType === 'QUIZ' ? 'Chapter 1 Quiz' : 'Week 1 Assignment'}`} value={newAsmTitle} onChange={e => setNewAsmTitle(e.target.value)}/></div>{contentType !== 'MATERIAL' && (<div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Due Date</label><input type="date" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" value={newAsmDueDate} onChange={e => setNewAsmDueDate(e.target.value)}/></div>)}</div><div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Description / Instructions</label><textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-600 outline-none h-32 resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Detailed instructions..." value={newAsmDesc} onChange={e => setNewAsmDesc(e.target.value)}/></div>{contentType === 'ASSIGNMENT' && (<div><label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">Grading Rubric</label><textarea className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm text-slate-600 outline-none h-24 resize-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Criterion (Points)..." value={newAsmRubric} onChange={e => setNewAsmRubric(e.target.value)}/></div>)}
                   {contentType === 'QUIZ' && (<div className="bg-slate-50 p-6 rounded-2xl border border-slate-200"><div className="flex justify-between items-center mb-4"><h4 className="font-bold text-slate-800 flex items-center gap-2"><HelpCircle size={18} /> Quiz Questions</h4><button onClick={handleAutoGenerateQuiz} disabled={isGeneratingQuiz} className="flex items-center gap-2 text-xs font-bold bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-200 transition-all disabled:opacity-50">{isGeneratingQuiz ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}{isGeneratingQuiz ? 'Generating...' : 'Auto-Generate'}</button></div><div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6"><input className="w-full p-3 mb-3 border border-slate-200 rounded-lg text-sm font-bold" placeholder="Enter Question..." value={currentQuestion} onChange={e => setCurrentQuestion(e.target.value)}/><div className="grid grid-cols-2 gap-3 mb-3">{currentOptions.map((opt, idx) => (<div key={idx} className="flex items-center gap-2"><div onClick={() => setCorrectOption(idx)} className={`w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer ${correctOption === idx ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>{correctOption === idx && <Check size={14} className="text-white" />}</div><input className="flex-1 p-2 border border-slate-200 rounded-lg text-sm" placeholder={`Option ${idx + 1}`} value={opt} onChange={e => { const newOpts = [...currentOptions]; newOpts[idx] = e.target.value; setCurrentOptions(newOpts); }}/></div>))}</div><button onClick={handleAddQuizQuestion} className="w-full py-2 bg-indigo-100 text-indigo-600 font-bold rounded-lg hover:bg-indigo-200 transition-colors">Add Question</button></div><div className="space-y-3">{quizQuestions.map((q, idx) => (<div key={q.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center group"><div><p className="font-bold text-sm text-slate-800"><span className="text-indigo-600 mr-2">Q{idx+1}</span> {q.question}</p><p className="text-xs text-slate-500 mt-1">Answer: {q.options[q.correctAnswer]}</p></div><button onClick={() => handleRemoveQuizQuestion(idx)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button></div>))}</div></div>)}
                   <div className="flex items-center gap-4 pt-2"><button onClick={() => asmFileInputRef.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"><Upload size={18} /> Attach Files</button><input type="file" ref={asmFileInputRef} className="hidden" multiple onChange={handleUploadAsmFile} />{newAsmFiles.length > 0 && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{newAsmFiles.length} files attached</span>}</div>
               </div>
               <div className="flex gap-4 mt-8 pt-6 border-t border-slate-100"><button onClick={handleCreateContent} className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">Publish {contentType}</button><button onClick={() => setIsCreatingContent(false)} className="bg-white text-slate-500 px-6 py-3.5 rounded-xl font-bold hover:bg-slate-50 transition-colors">Cancel</button></div>
            </div>
         )}
         <div className="space-y-6">
            {assignments.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-16 bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><FileText size={32} className="opacity-50" /></div><p className="font-bold text-lg text-slate-600">No content added yet.</p></div>
            ) : (
               assignments.map(asm => {
                 const asmSubs = submissions.filter(s => s.assignmentId === asm.id);
                 return (
                   <div key={asm.id} className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden relative group hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
                      <div className="p-8 flex flex-col md:flex-row justify-between items-start gap-6">
                         <div className="flex-1"><div className="flex items-center gap-3 mb-2">{renderIconForType(asm.type)}<h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{asm.title}</h3>{asm.type !== 'MATERIAL' && (<span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full border border-slate-200 flex items-center gap-1"><Calendar size={12} /> {asm.dueDate}</span>)}</div><p className="text-slate-500 leading-relaxed line-clamp-2 max-w-2xl">{asm.description}</p>{asm.referenceFiles && asm.referenceFiles.length > 0 && (<div className="mt-4 flex flex-wrap gap-2">{asm.referenceFiles.map((file, i) => (<button key={i} onClick={() => downloadFile(file)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"><FileText size={14} /> {file.name} <Download size={12} /></button>))}</div>)}</div>
                         <div className="flex gap-2 shrink-0"><button onClick={() => handleEditAssignment(asm)} className="text-sm font-bold bg-slate-50 text-slate-600 px-5 py-2.5 rounded-xl border border-slate-200 flex items-center gap-2 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all"><Pencil size={16} /> Edit</button></div>
                      </div>
                      {asm.type !== 'MATERIAL' && (<div className="px-8 pb-8"><div className="flex items-center gap-2 mb-4"><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Submissions</span><span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{asmSubs.length}</span></div>{asmSubs.length === 0 ? (<div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center text-sm text-slate-400 italic">No student submissions yet.</div>) : (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">{asmSubs.map(sub => { const submittedDate = new Date(sub.timestamp); const dueDate = new Date(asm.dueDate); const isLate = submittedDate > new Date(dueDate.setHours(23,59,59)); return (<div key={sub.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-white hover:shadow-md transition-all group/sub"><div className="flex justify-between items-start mb-3"><div className="flex items-center gap-3"><div className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-indigo-700 font-bold text-xs shadow-sm">{sub.studentName.charAt(0)}</div><div><p className="text-sm font-bold text-slate-800">{sub.studentName}</p><p className="text-[10px] text-slate-500 font-medium">{new Date(sub.timestamp).toLocaleDateString()} {isLate && <span className="text-rose-500 ml-1">LATE</span>}</p></div></div>{sub.status === 'GRADED' ? (<div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100"><Check size={12} strokeWidth={3} /><span className="text-xs font-bold">{sub.gradeResult?.score.percentage}%</span></div>) : (<span className="w-2 h-2 bg-amber-400 rounded-full" title="Pending"></span>)}</div><button onClick={() => handleGradeSubmission(sub, asm)} className="w-full py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all flex items-center justify-center gap-2 shadow-sm"><GraduationCap size={14} />{sub.status === 'GRADED' ? 'View Result' : (asm.type === 'QUIZ' ? 'Grade with AI' : 'Grade with AI')}</button></div>)})}</div>)}</div>)}
                   </div>
                 );
               })
            )}
         </div>
      </div>
      );
  }

  // GRADING VIEW
  if (view === 'GRADING') {
     return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
           <button onClick={() => setView('DETAIL')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold text-sm mb-4 transition-colors">
             <ArrowLeft size={16} /> Back to Class
           </button>

           {/* EVIDENCE PANEL */}
           {selectedSubmission && !isGrading && (
             <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6 animate-fade-in">
                 <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                     <FileText className="text-indigo-600" size={20} /> Submission Evidence
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {selectedAssignment?.type === 'QUIZ' && selectedAssignment.quizData ? (
                        <div className="col-span-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Quiz Answer Breakdown</h4>
                            <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-3">
                                {selectedAssignment.quizData.map((q, idx) => {
                                    const studentAnswerIdx = selectedSubmission.selectedOptions?.[idx];
                                    const isCorrect = studentAnswerIdx === q.correctAnswer;
                                    return (
                                        <div key={idx} className="flex justify-between items-start p-3 bg-white rounded-lg border border-slate-200">
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-slate-800 mb-1"><span className="text-indigo-600 mr-1">Q{idx+1}</span> {q.question}</p>
                                                <div className="text-xs">
                                                    <span className="text-slate-500">Student: </span>
                                                    <span className={`font-bold ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                        {studentAnswerIdx !== undefined ? q.options[studentAnswerIdx] : 'No Answer'}
                                                    </span>
                                                </div>
                                                {!isCorrect && (
                                                    <div className="text-xs mt-1">
                                                        <span className="text-slate-500">Correct: </span>
                                                        <span className="font-bold text-emerald-600">{q.options[q.correctAnswer]}</span>
                                                    </div>
                                                )}
                                            </div>
                                            {isCorrect ? <CheckCircle size={18} className="text-emerald-500 shrink-0" /> : <X size={18} className="text-rose-500 shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <>
                            {selectedSubmission.textResponse && (
                                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Student Response</h4>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{selectedSubmission.textResponse}</p>
                                </div>
                            )}
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Attached Files</h4>
                                {selectedSubmission.files.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedSubmission.files.map((file, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md"><FileIcon size={16} /></div>
                                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{file.name}</span>
                                                </div>
                                                <button onClick={() => downloadFile(file)} className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"><Download size={12} /> Download</button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (<p className="text-sm text-slate-400 italic">No files attached.</p>)}
                            </div>
                        </>
                    )}
                 </div>
             </div>
           )}

           {isGrading ? (
              <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm animate-fade-in">
                 <div className="relative mb-6">
                    <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                    <div className="relative p-4 bg-white rounded-full shadow-lg border border-indigo-50"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
                 </div>
                 <h2 className="text-2xl font-bold text-slate-800">Analyzing Submission...</h2>
                 <p className="text-slate-500 mt-2 font-medium">Comparing student work against assignment rubric.</p>
              </div>
           ) : gradingResult && selectedSubmission ? (
              <StudentResult 
                result={gradingResult}
                studentName={selectedSubmission.studentName}
                onUpdate={(updated) => setGradingResult(updated)}
                quizData={selectedAssignment?.type === 'QUIZ' ? selectedAssignment.quizData : undefined}
                studentAnswers={selectedAssignment?.type === 'QUIZ' ? selectedSubmission.selectedOptions : undefined}
              />
           ) : (
              <div className="p-12 text-center text-slate-400">Error loading data.</div>
           )}

           {!isGrading && gradingResult && selectedAssignment?.type !== 'MATERIAL' && (
              <div className="fixed bottom-8 right-8 z-50 animate-fade-in-up">
                 <button 
                   onClick={() => selectedSubmission && selectedClass && handleSaveGrade(selectedSubmission.studentName, selectedClass.name, selectedClass.subject, gradingResult)}
                   className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl shadow-slate-900/40 hover:bg-indigo-600 hover:scale-105 transition-all flex items-center gap-3 border border-white/10"
                 >
                    <Check size={20} className="text-emerald-400" /> 
                    <span>Confirm & Save Grade</span>
                 </button>
              </div>
           )}
        </div>
     );
  }

  return null;
};

export default ClassroomManager;
