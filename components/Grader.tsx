
import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, Check, Loader2, Play, File as FileIcon, X, Plus, ChevronRight, Youtube, Presentation, AlignLeft, Save, Paperclip, ExternalLink, AlertCircle, User } from 'lucide-react';
import { analyzeSubmission } from '../services/geminiService';
import StudentResult from './StudentResult';
import { AnalysisResponse, Classroom } from '../types';
import { db, doc, getDoc, collection, addDoc, auth } from '../services/firebase';

interface UploadedFile {
  data: string;
  mimeType: string;
  name: string;
}

type SubmissionTab = 'DOCUMENT' | 'PRESENTATION' | 'VIDEO';

interface GraderProps {
  classrooms: Classroom[];
  subjects: string[];
}

interface StudentOption {
    id: string;
    name: string;
}

const Grader: React.FC<GraderProps> = ({ classrooms, subjects }) => {
  const [rubric, setRubric] = useState<string>(
    "Critical Thinking (10): Analyzes the problem deeply.\nEvidence (10): Uses specific examples.\nClarity (10): Writing is clear and concise."
  );
  const [assignmentQuestion, setAssignmentQuestion] = useState<string>("");
  const [assignmentFiles, setAssignmentFiles] = useState<UploadedFile[]>([]);
  
  const [submissionText, setSubmissionText] = useState<string>("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  
  // Metadata inputs
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");

  // Validation State
  const [showValidation, setShowValidation] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [activeTab, setActiveTab] = useState<SubmissionTab>('DOCUMENT');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assignmentFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Students when Class Changes
  useEffect(() => {
      if (selectedClassId) {
          const fetchStudents = async () => {
              try {
                  const currentClass = classrooms.find(c => c.id === selectedClassId);
                  // Auto-fill subject if available from class
                  if (currentClass?.subject) {
                      setSelectedSubject(currentClass.subject);
                  }

                  if (currentClass && currentClass.studentIds && currentClass.studentIds.length > 0) {
                      const studentPromises = currentClass.studentIds.map(async (studentId) => {
                          try {
                              const studentDoc = await getDoc(doc(db, 'users', studentId));
                              if (studentDoc.exists()) {
                                  const data = studentDoc.data();
                                  return {
                                      id: studentDoc.id,
                                      name: data.displayName || 'Unknown Student'
                                  };
                              }
                          } catch (e) { console.warn(e); }
                          return null;
                      });
                      const results = await Promise.all(studentPromises);
                      setStudents(results.filter(s => s !== null) as StudentOption[]);
                  } else {
                      setStudents([]);
                  }
              } catch (e) {
                  console.error("Error fetching students for grader:", e);
                  setStudents([]);
              }
          };
          fetchStudents();
          setSelectedStudentId(""); // Reset student selection
          if (result) setResult(null); 
      } else {
          setStudents([]);
      }
  }, [selectedClassId, classrooms]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isAssignment: boolean = false) => {
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
          
          if (isAssignment) {
            setAssignmentFiles(prev => [...prev, newFile]);
          } else {
            setUploadedFiles(prev => [...prev, newFile]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (index: number, isAssignment: boolean = false) => {
    if (isAssignment) {
      setAssignmentFiles(prev => prev.filter((_, i) => i !== index));
    } else {
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleAnalyze = async () => {
    // Validation Check
    if (!selectedClassId || !selectedStudentId || !selectedSubject.trim()) {
      setShowValidation(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const hasText = !!submissionText.trim();
    const hasFiles = uploadedFiles.length > 0;
    const hasVideo = !!youtubeUrl.trim();

    if (!hasText && !hasFiles && !hasVideo) {
      alert("Please provide some content (text, files, or video) for submission.");
      return;
    }

    setShowValidation(false);
    setLoading(true);
    setResult(null);
    setSaveSuccess(false);
    
    try {
      const data = await analyzeSubmission(rubric, assignmentQuestion, submissionText, uploadedFiles, youtubeUrl, assignmentFiles);
      setResult(data);
    } catch (error) {
      alert("Analysis failed. Please check your API Key and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReportCard = async () => {
      // Robust Validation to prevent Permission Errors
      if (!auth.currentUser) {
          alert("You must be logged in to save.");
          return;
      }
      if (!selectedClassId) {
          alert("Classroom selection is missing. Please select a class.");
          return;
      }
      if (!selectedStudentId) {
          alert("Student selection is missing. Please select a student.");
          return;
      }
      if (!result) {
          alert("No analysis result to save.");
          return;
      }

      setIsSaving(true);
      try {
          const studentName = students.find(s => s.id === selectedStudentId)?.name || 'Unknown';
          const currentClass = classrooms.find(c => c.id === selectedClassId);
          
          // Structure matches the 'SubmissionRecord' consumption in App.tsx
          // We save to 'reportCards' collection, which App.tsx will now fetch.
          const payload = {
              classroomId: selectedClassId,
              className: currentClass?.name || 'Unknown Class',
              subject: selectedSubject || currentClass?.subject || 'General',
              studentId: selectedStudentId,
              studentName: studentName,
              teacherId: auth.currentUser.uid,
              
              // Key: Store the FULL result object as gradeResult
              gradeResult: result, 
              
              // Metadata
              timestamp: new Date().toISOString(),
              type: 'GRADER_ENTRY', // Tag to identify source
              
              // Flat fields for easier querying if needed
              score: result.score.percentage,
              summary: result.summary
          };

          await addDoc(collection(db, 'reportCards'), payload);
          
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
      } catch (e: any) {
          console.error("Error saving report card:", e);
          if (e.code === 'permission-denied') {
              alert("Permission Denied: Ensure you are the teacher of this class.");
          } else {
              alert("Failed to save report card. " + e.message);
          }
      } finally {
          setIsSaving(false);
      }
  };

  const handleReset = () => {
    setResult(null);
    setUploadedFiles([]);
    setAssignmentFiles([]);
    setSubmissionText("");
    setYoutubeUrl("");
    setActiveTab('DOCUMENT');
    setShowValidation(false);
    // Keep class selected for easier bulk grading, but reset student
    setSelectedStudentId("");
  };

  const tabs = [
    { id: 'DOCUMENT', label: 'Written / Doc', icon: FileText },
    { id: 'PRESENTATION', label: 'Presentation', icon: Presentation },
    { id: 'VIDEO', label: 'YouTube Video', icon: Youtube },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 print-area">
      <header className="no-print mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">AI Grading Engine</h2>
        <p className="text-slate-500 mt-2 font-medium">Automated assessment for multimodal student submissions.</p>
      </header>

      {!result ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 no-print">
          {/* Left Column: Context (Rubric & Question) */}
          <div className="lg:col-span-5 space-y-6">
             {/* Student Details */}
            <div className={`bg-white p-6 rounded-2xl shadow-sm border transition-colors ${showValidation && (!selectedClassId || !selectedStudentId || !selectedSubject) ? 'border-rose-300 ring-4 ring-rose-50' : 'border-slate-100'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Student & Class Details
                </h3>
                {showValidation && (!selectedClassId || !selectedStudentId || !selectedSubject) && (
                  <span className="text-xs font-bold text-rose-600 flex items-center gap-1">
                    <AlertCircle size={12} /> Required
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Class <span className="text-rose-500">*</span></label>
                    <select 
                      className={`w-full p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium text-slate-700 appearance-none ${showValidation && !selectedClassId ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                    >
                      <option value="">Select Class...</option>
                      {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">Subject <span className="text-rose-500">*</span></label>
                    <input 
                      list="subjects-list"
                      className={`w-full p-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium text-slate-700 ${showValidation && !selectedSubject ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      placeholder="Select..."
                    />
                     <datalist id="subjects-list">
                      {subjects.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">Student Name <span className="text-rose-500">*</span></label>
                  <div className="relative">
                      <select 
                        disabled={!selectedClassId}
                        className={`w-full p-3 pl-10 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition font-medium text-slate-700 appearance-none ${showValidation && !selectedStudentId ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                      >
                        <option value="">{selectedClassId ? (students.length > 0 ? "Select Student..." : "No students found") : "Select Class First"}</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <User className="absolute left-3 top-3.5 text-slate-400 w-5 h-5 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Assignment & Rubric */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Assignment Question / Prompt</label>
                <div className="space-y-3">
                   <textarea 
                    className="w-full h-28 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none text-sm font-medium text-slate-700"
                    value={assignmentQuestion}
                    onChange={(e) => setAssignmentQuestion(e.target.value)}
                    placeholder="e.g. Explain the process of photosynthesis and its importance..."
                  />
                  
                  {/* Assignment Files List */}
                  {assignmentFiles.length > 0 && (
                    <div className="space-y-2">
                       {assignmentFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-100 rounded-lg text-xs">
                             <div className="flex items-center gap-2 truncate">
                               <Paperclip size={14} className="text-slate-500" />
                               <span className="truncate max-w-[150px] font-medium text-slate-700">{file.name}</span>
                             </div>
                             <button onClick={() => removeFile(idx, true)} className="text-slate-400 hover:text-rose-500">
                               <X size={14} />
                             </button>
                          </div>
                       ))}
                    </div>
                  )}

                  <div 
                    onClick={() => assignmentFileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 w-full p-3 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-colors"
                  >
                     <input 
                       type="file" 
                       ref={assignmentFileInputRef} 
                       className="hidden" 
                       accept=".pdf,image/*,.doc,.docx,.txt" 
                       multiple 
                       onChange={(e) => handleFileUpload(e, true)}
                     />
                     <Upload size={16} className="text-slate-400" />
                     <span className="text-xs font-bold text-slate-500">Attach Assignment File (PDF/Image/Doc)</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Grading Rubric</label>
                <textarea 
                  className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none font-mono text-sm text-slate-700"
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  placeholder="Enter criteria and points..."
                />
              </div>
            </div>
          </div>

          {/* Right Column: Submission Input */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col relative overflow-hidden min-h-[600px]">
              
              <div className="mb-6 z-10">
                  <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    Student Submission
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">Multimodal</span>
                  </h3>
                  <p className="text-slate-500 text-sm mt-1 font-medium">Select submission type and provide content.</p>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl z-10 w-full overflow-x-auto">
                {tabs.map((tab) => {
                   const Icon = tab.icon;
                   const isActive = activeTab === tab.id;
                   return (
                     <button
                       key={tab.id}
                       onClick={() => setActiveTab(tab.id as SubmissionTab)}
                       className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                         isActive 
                           ? 'bg-white text-indigo-600 shadow-sm' 
                           : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                       }`}
                     >
                       <Icon size={18} />
                       {tab.label}
                     </button>
                   );
                })}
              </div>
              
              <div className="space-y-6 flex-1 z-10">
                
                {/* VIDEO TAB CONTENT */}
                {activeTab === 'VIDEO' && (
                  <div className="animate-fade-in space-y-6">
                     <div className={`group rounded-2xl border-2 transition-all duration-300 ${youtubeUrl ? 'border-indigo-100 bg-white shadow-sm' : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200 hover:bg-slate-50'}`}>
                        <div className="p-4 border-b border-slate-100/50 flex justify-between items-center bg-white/50 rounded-t-2xl">
                          <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg ${youtubeUrl ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                              <Youtube size={16} strokeWidth={2.5} />
                            </div>
                            <label className="text-sm font-bold text-slate-700">YouTube URL</label>
                          </div>
                        </div>
                        <div className="p-4">
                           <input 
                              type="text"
                              className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-sm font-medium placeholder:text-slate-400 text-slate-700"
                              placeholder="https://www.youtube.com/watch?v=..."
                              value={youtubeUrl}
                              onChange={(e) => setYoutubeUrl(e.target.value)}
                            />
                            
                            {youtubeUrl && (
                               <div className="mt-4 p-5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                     <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                       <Play size={20} className="fill-red-600" />
                                     </div>
                                     <div>
                                       <p className="text-sm font-bold text-slate-800">Video Attached</p>
                                       <p className="text-xs text-slate-500">Ready for AI Analysis</p>
                                     </div>
                                  </div>
                                  <a 
                                    href={youtubeUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors flex items-center gap-2"
                                  >
                                    Open in YouTube <ExternalLink size={14} />
                                  </a>
                               </div>
                            )}
                        </div>
                    </div>
                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                      <div className="flex items-start gap-3">
                        <Youtube className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-indigo-900">Video Grading</p>
                          <p className="text-xs text-indigo-700 mt-1">The system will use Google Search to analyze the video title, description, and content context.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* PRESENTATION TAB CONTENT */}
                {activeTab === 'PRESENTATION' && (
                  <div className="animate-fade-in space-y-6">
                     <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 mb-2">
                       <div className="flex items-start gap-3">
                         <Presentation className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                         <div>
                           <p className="text-sm font-bold text-emerald-900">Presentation Mode</p>
                           <p className="text-xs text-emerald-700 mt-1">Upload slides (PDF/Images) below. You can also paste speaker notes or transcript in the text box.</p>
                         </div>
                       </div>
                     </div>
                  </div>
                )}
                
                {/* SHARED INPUTS */}
                {(activeTab === 'DOCUMENT' || activeTab === 'PRESENTATION') && (
                  <div className={`group rounded-2xl border-2 transition-all duration-300 ${uploadedFiles.length > 0 ? 'border-indigo-100 bg-white shadow-sm' : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200 hover:bg-slate-50'}`}>
                      <div className="p-4 border-b border-slate-100/50 flex justify-between items-center bg-white/50 rounded-t-2xl">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-1.5 rounded-lg ${uploadedFiles.length > 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                            <Upload size={16} strokeWidth={2.5} />
                          </div>
                          <label className="text-sm font-bold text-slate-700">
                             {activeTab === 'PRESENTATION' ? 'Upload Slides (PDF/Images)' : 'Attachments'}
                          </label>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white px-2 py-1 rounded border border-slate-100">PDF, Images, Text</span>
                      </div>

                      <div className="p-4 space-y-4">
                        {/* Active File List */}
                        {uploadedFiles.length > 0 && (
                            <div className="grid grid-cols-1 gap-2 animate-fade-in">
                              {uploadedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 group/file hover:bg-indigo-50 transition-colors">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                      <div className={`p-2 rounded-lg shrink-0 ${file.mimeType.includes('pdf') ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'}`}>
                                        {file.mimeType.includes('pdf') ? <FileText size={18} /> : <FileIcon size={18} />}
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{file.mimeType.split('/')[1] || 'FILE'}</span>
                                      </div>
                                    </div>
                                    <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-rose-500 p-2 hover:bg-white rounded-lg transition-all opacity-0 group-hover/file:opacity-100 focus:opacity-100">
                                      <X size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                              ))}
                            </div>
                        )}

                        {/* Drop Zone */}
                        <div 
                            className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${uploadedFiles.length > 0 ? 'border-slate-200 bg-white hover:border-indigo-400' : 'border-indigo-200 bg-indigo-50/30 hover:bg-indigo-50 hover:border-indigo-400'}`}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              accept=".pdf,image/*,text/*,.txt,.doc,.docx" 
                              multiple 
                              onChange={(e) => handleFileUpload(e, false)}
                            />
                            <div className={`transition-transform duration-200 ${uploadedFiles.length > 0 ? '' : 'scale-110 mb-2'}`}>
                              <Plus className={`w-6 h-6 ${uploadedFiles.length > 0 ? 'text-slate-400' : 'text-indigo-500'}`} />
                            </div>
                            {uploadedFiles.length === 0 && (
                              <p className="text-sm font-bold text-indigo-900 mt-2">
                                {activeTab === 'PRESENTATION' ? 'Click to Upload Slides' : 'Click to Upload Files'}
                              </p>
                            )}
                            {uploadedFiles.length > 0 && (
                              <p className="text-xs font-bold text-slate-500 mt-1">Add another file</p>
                            )}
                        </div>
                      </div>
                  </div>
                )}

                {/* Text Input Section */}
                <div className={`group rounded-2xl border-2 transition-all duration-300 ${submissionText ? 'border-indigo-100 bg-white shadow-sm' : 'border-slate-100 bg-slate-50/50 hover:border-indigo-200 hover:bg-slate-50'}`}>
                    <div className="p-4 border-b border-slate-100/50 flex justify-between items-center bg-white/50 rounded-t-2xl">
                      <div className="flex items-center gap-2.5">
                         <div className={`p-1.5 rounded-lg ${submissionText ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                           <AlignLeft size={16} strokeWidth={2.5} />
                         </div>
                         <label className="text-sm font-bold text-slate-700">
                           {activeTab === 'PRESENTATION' ? 'Speaker Notes / Transcript' : activeTab === 'VIDEO' ? 'Video Context / Description' : 'Written Response'}
                         </label>
                      </div>
                    </div>
                    <div className="p-4">
                       <textarea 
                          className="w-full h-32 p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none text-sm font-medium placeholder:text-slate-400 text-slate-700 leading-relaxed"
                          placeholder={
                             activeTab === 'PRESENTATION' ? "Paste speaker notes here..." : 
                             activeTab === 'VIDEO' ? "Describe the video content or paste transcript..." :
                             "Paste the student's essay, answer, or text content here..."
                          }
                          value={submissionText}
                          onChange={(e) => setSubmissionText(e.target.value)}
                        />
                    </div>
                </div>

              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 z-10">
                <button 
                  onClick={handleAnalyze}
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-xl shadow-slate-200 transform transition-all hover:-translate-y-1 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] hover:animate-[shimmer_1s_infinite]"></div>
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin w-5 h-5" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="fill-current w-5 h-5" />
                      Run Analysis
                    </>
                  )}
                </button>
                {showValidation && (!selectedClassId || !selectedStudentId || !selectedSubject) && (
                   <p className="text-center text-rose-600 font-bold text-sm mt-3 flex items-center justify-center gap-2">
                     <AlertCircle size={14} /> Please select Class, Student, and Subject above.
                   </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in relative">
          <div className="flex justify-between items-center mb-6 no-print max-w-6xl mx-auto">
            <button 
              onClick={handleReset}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
            >
              <Plus size={18} />
              Grade Next
            </button>
            <button 
                onClick={handleSaveReportCard}
                disabled={isSaving || saveSuccess || !selectedClassId || !selectedStudentId}
                className={`px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center gap-2 ${saveSuccess ? 'bg-emerald-500' : 'bg-slate-900 hover:bg-slate-800'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : saveSuccess ? <Check size={18} /> : <Save size={18} />}
                {saveSuccess ? 'Saved to Report Card' : 'Save Report Card'}
            </button>
          </div>
          <StudentResult 
            result={result} 
            studentName={students.find(s => s.id === selectedStudentId)?.name || "Student"} 
            onUpdate={(updatedResult) => setResult(updatedResult)}
          />
        </div>
      )}
    </div>
  );
};

export default Grader;
