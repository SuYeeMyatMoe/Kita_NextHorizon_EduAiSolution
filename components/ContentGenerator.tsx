
import React, { useState, useRef, useEffect } from 'react';
import { generateEducationalContent } from '../services/geminiService';
import { Loader2, BookOpen, Copy, Check, FileDown, Trash2, PenTool, FileQuestion, ClipboardList, Eye, EyeOff, Upload, X, Paperclip, Image as ImageIcon, MonitorPlay, MessageSquare, FileAudio, Mic, StopCircle, ChevronLeft, ChevronRight, LayoutTemplate } from 'lucide-react';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

type ContentType = 'Exam' | 'Assignment' | 'Presentation';

interface UploadedFile {
  data: string;
  mimeType: string;
  name: string;
}

const ContentGenerator: React.FC = () => {
  const [contentType, setContentType] = useState<ContentType>('Assignment');
  const [topic, setTopic] = useState('');
  const [requirements, setRequirements] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Data is now an object, not a string
  const [generatedData, setGeneratedData] = useState<any>(null);
  
  // Presentation Navigation
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  
  const [loading, setLoading] = useState(false);
  const [showAnswerKey, setShowAnswerKey] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef(0);
  const uploadedFilesRef = useRef<UploadedFile[]>([]); // Ref to track files for async access

  // Sync ref with state
  useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  // Keyboard navigation for slides
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!generatedData || contentType !== 'Presentation') return;
      
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex(prev => Math.min((generatedData.slides?.length || 1) - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generatedData, contentType]);

  // --- AUDIO RECORDING HANDLERS ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          const newFile = {
            data: base64String,
            mimeType: 'audio/webm',
            name: `Voice Note (${new Date().toLocaleTimeString()}).webm`
          };
          setUploadedFiles(prev => [...prev, newFile]);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone Access Error:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- FILE HANDLERS ---
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
          setUploadedFiles(prev => [...prev, newFile]);
        };
        reader.readAsDataURL(file);
      });
    }
    if (e.target) e.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    // 1. Stop Audio if recording and wait for file processing
    if (isRecording) {
      stopRecording();
      // Wait for the onstop -> FileReader process to complete and state/ref to update
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Use Ref to get the absolute latest files including the just-recorded audio
    const currentFiles = uploadedFilesRef.current;

    if (!topic && currentFiles.length === 0) {
      alert("Please provide a topic or upload reference material.");
      return;
    }

    setLoading(true);
    setGeneratedData(null);
    setShowAnswerKey(false);
    setCurrentSlideIndex(0); 
    
    const currentId = ++requestIdRef.current;

    try {
      const result = await generateEducationalContent(contentType as any, topic, requirements, currentFiles);
      
      if (currentId === requestIdRef.current) {
        setGeneratedData(result);
      }
    } catch (e) {
      if (currentId === requestIdRef.current) {
        console.error(e);
        alert("Failed to generate content. Please try again.");
      }
    } finally {
      if (currentId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleStopGeneration = () => {
    requestIdRef.current++;
    setLoading(false);
  };

  const copyToClipboard = () => {
    let textToCopy = "";
    const contentDiv = document.getElementById('generated-content-display');
    if (contentDiv) {
      textToCopy = contentDiv.innerText;
    }
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    if (!generatedData) return;

    if (contentType === 'Presentation') {
        try {
            const pptx = new PptxGenJS();
            pptx.layout = 'LAYOUT_16x9';

            pptx.defineSlideMaster({
              title: "MASTER_SLIDE",
              background: { color: "FFFFFF" },
              slideNumber: { x: 9.3, y: 5.25, fontSize: 10, color: "64748B", fontFace: "Arial" },
              objects: [
                 { rect: { x: 0, y: 5.45, w: "100%", h: 0.15, fill: { color: "6366F1" } } }, 
              ]
            });

            const titleSlide = pptx.addSlide();
            titleSlide.background = { color: 'F8FAFC' }; 
            titleSlide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.4, h: 5.625, fill: { color: '6366F1' } });
            
            titleSlide.addText(generatedData.title, { 
                x: 1, y: 1.5, w: '85%', h: 1.5, 
                fontSize: 44, bold: true, align: 'left', color: '1E293B', fontFace: 'Arial',
                shrinkText: true
            });
            if (generatedData.overview) {
                titleSlide.addText(generatedData.overview, { 
                    x: 1, y: 3.2, w: '85%', h: 1.5, 
                    fontSize: 18, align: 'left', color: '64748B', fontFace: 'Arial',
                    shrinkText: true
                });
            }

            generatedData.slides?.forEach((slideData: any) => {
                const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
                
                slide.addText(slideData.title, { 
                    x: 0.5, y: 0.3, w: '90%', h: 1.0, 
                    fontSize: 28, bold: true, color: '0F172A', fontFace: 'Arial',
                    shrinkText: true, valign: 'middle'
                });

                const isReferenceSlide = slideData.title.toLowerCase().includes("reference");
                const hasVisualCue = !!slideData.visualCue;

                if (isReferenceSlide) {
                    if (slideData.contentPoints && slideData.contentPoints.length > 0) {
                         const refs = slideData.contentPoints.map((p: string) => ({
                             text: p,
                             options: { fontSize: 12, color: '334155', breakLine: true, bullet: true, paraSpaceBefore: 10 }
                         }));
                         slide.addText(refs, { 
                             x: 0.5, y: 1.5, w: '90%', h: 3.75, 
                             align: 'left', valign: 'top', shrinkText: true 
                         });
                    }
                } else {
                    const textWidth = hasVisualCue ? 5.0 : 9.0;
                    
                    if (slideData.contentPoints && slideData.contentPoints.length > 0) {
                         const bulletPoints = slideData.contentPoints.map((p: string) => ({
                             text: p,
                             options: { 
                               fontSize: 16, 
                               color: '334155', 
                               breakLine: true, 
                               bullet: { type: 'round', indent: 15 }, 
                               paraSpaceBefore: 12 
                             }
                         }));
                         
                         slide.addText(bulletPoints, { 
                             x: 0.5, y: 1.6, w: textWidth, h: 3.5, 
                             align: 'left', valign: 'top', 
                             shrinkText: true 
                         });
                    }

                    if (hasVisualCue) {
                        slide.addShape(pptx.ShapeType.rect, { 
                            x: 5.7, y: 1.6, w: 3.8, h: 3.5, 
                            fill: { color: 'F1F5F9' }, 
                            line: { color: 'CBD5E1', width: 1, dashType: 'dash' } 
                        });
                        slide.addText("PLACE IMAGE HERE", { 
                            x: 5.7, y: 2.5, w: 3.8, h: 0.5, 
                            fontSize: 14, bold: true, align: 'center', color: '94A3B8' 
                        });
                        slide.addText(`Suggested: ${slideData.visualCue}`, { 
                            x: 5.8, y: 3.0, w: 3.6, h: 1.2, 
                            fontSize: 10, italic: true, color: '64748B', align: 'center', valign: 'top',
                            shrinkText: true
                        });
                    }
                }
                
                if (slideData.speakerNotes) {
                    slide.addNotes(slideData.speakerNotes);
                }
            });

            await pptx.writeFile({ fileName: `Presentation-${topic.replace(/\s+/g, '-')}.pptx` });
        } catch (error) {
            console.error("PPTX Generation Error:", error);
            alert("Failed to generate PowerPoint. Please try again.");
        }
    } else {
        let htmlContent = "";

        if (contentType === 'Exam') {
          htmlContent = `
            <h1>${generatedData.title}</h1>
            <p><strong>Instructions:</strong> ${generatedData.instructions}</p>
            <hr/>
            ${generatedData.sections.map((section: any) => `
              <h3>${section.sectionTitle}</h3>
              ${section.questions.map((q: any) => `
                <div style="margin-bottom: 15px;">
                  <p><strong>${q.number}.</strong> ${q.text} <span style="float:right;">(${q.marks})</span></p>
                  ${q.options && q.options.length > 0 ? `
                    <ul style="list-style-type: none; padding-left: 20px;">
                      ${q.options.map((opt: string) => `<li>${opt}</li>`).join('')}
                    </ul>
                  ` : ''}
                </div>
              `).join('')}
            `).join('')}
            
            <br style="page-break-before: always" />
            
            <h1>Answer Key & Marking Scheme</h1>
            <table style="width:100%; border-collapse: collapse; border: 1px solid black;">
              <thead>
                 <tr>
                   <th style="border: 1px solid black; padding: 8px;">No.</th>
                   <th style="border: 1px solid black; padding: 8px;">Answer</th>
                   <th style="border: 1px solid black; padding: 8px;">Explanation</th>
                 </tr>
              </thead>
              <tbody>
                 ${generatedData.answerKey.map((key: any) => `
                   <tr>
                     <td style="border: 1px solid black; padding: 8px;">${key.questionNumber}</td>
                     <td style="border: 1px solid black; padding: 8px;"><strong>${key.answer}</strong></td>
                     <td style="border: 1px solid black; padding: 8px;">${key.explanation}</td>
                   </tr>
                 `).join('')}
              </tbody>
            </table>
          `;
        } 
        else {
          const instructionsList = Array.isArray(generatedData.instructions) ? generatedData.instructions : [generatedData.instructions];
          const objectivesList = Array.isArray(generatedData.objectives) ? generatedData.objectives : [generatedData.objectives];
          const criteriaList = Array.isArray(generatedData.gradingCriteria) ? generatedData.gradingCriteria : [generatedData.gradingCriteria];

          htmlContent = `
            <h1>${generatedData.title}</h1>
            <p>${generatedData.overview}</p>
            
            <h3>Objectives</h3>
            <ul>${objectivesList.map((o: string) => `<li>${o}</li>`).join('')}</ul>

            <h3>Instructions</h3>
            <ol>${instructionsList.map((i: string) => `<li>${i}</li>`).join('')}</ol>

            <h3>Submission Guidelines</h3>
            <p>${generatedData.submissionGuidelines}</p>

            <h3>Grading Criteria</h3>
            <ul>${criteriaList.map((c: string) => `<li>${c}</li>`).join('')}</ul>
          `;
        }

        const file = new Blob([`
          <html>
            <head>
              <meta charset="utf-8">
              <title>${topic} - ${contentType}</title>
              <style>
                body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: black; }
              </style>
            </head>
            <body>
              ${htmlContent}
            </body>
          </html>
        `], {type: 'application/msword'});
        
        const element = document.createElement("a");
        element.href = URL.createObjectURL(file);
        element.download = `${contentType}-${topic.replace(/\s+/g, '-')}.doc`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }
  };

  const handleDiscard = () => {
    if (window.confirm("Are you sure you want to discard this content? This action cannot be undone.")) {
      setGeneratedData(null);
      setCurrentSlideIndex(0);
    }
  };

  const types: {id: ContentType, icon: any}[] = [
    { id: 'Exam', icon: PenTool },
    { id: 'Assignment', icon: ClipboardList },
    { id: 'Presentation', icon: MonitorPlay },
  ];

  const renderPresentation = (data: any) => {
     const slide = data.slides?.[currentSlideIndex];
     if (!slide) return <div className="p-8">No slides available</div>;
     const totalSlides = data.slides?.length || 0;
     const progress = ((currentSlideIndex + 1) / totalSlides) * 100;

     return (
         <div className="flex flex-col h-full bg-slate-100/50 relative overflow-hidden rounded-3xl border border-slate-200">
             <div className="px-6 py-4 bg-white border-b border-slate-200 flex justify-between items-center z-10">
                 <div className="flex items-center gap-3">
                     <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><MonitorPlay size={20} /></div>
                     <div><h2 className="text-lg font-bold text-slate-900 truncate max-w-md">{data.title}</h2></div>
                 </div>
                 <div className="flex items-center gap-2">
                     <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">Slide {currentSlideIndex + 1} of {totalSlides}</span>
                 </div>
             </div>
             <div className="flex-1 bg-slate-50 flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
                 <button onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))} className="absolute left-2 z-20 p-3 bg-white border border-slate-200 rounded-full shadow-sm text-slate-600 hover:text-indigo-600"><ChevronLeft size={24} /></button>
                 <button onClick={() => setCurrentSlideIndex(prev => Math.min(totalSlides - 1, prev + 1))} className="absolute right-2 z-20 p-3 bg-white border border-slate-200 rounded-full shadow-sm text-slate-600 hover:text-indigo-600"><ChevronRight size={24} /></button>
                 <div className="w-full max-w-5xl aspect-video bg-white rounded-2xl shadow-xl overflow-hidden relative flex flex-col animate-fade-in border border-slate-100">
                     <div className="px-10 pt-10 pb-4"><h3 className="text-slate-900 text-3xl font-bold leading-tight">{slide.title}</h3><div className="h-1.5 w-16 bg-indigo-500 mt-4 rounded-full"></div></div>
                     <div className="flex-1 px-10 pb-10 grid grid-cols-1 md:grid-cols-2 gap-10 overflow-y-auto">
                         <div className="space-y-4"><ul className="space-y-4">{slide.contentPoints?.map((p: string, i: number) => (<li key={i} className="text-slate-600 font-medium text-lg flex items-start gap-3"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2.5 shrink-0"></span><span>{p}</span></li>))}</ul></div>
                         {slide.visualCue && (<div className="hidden md:flex bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 flex-col items-center justify-center p-6 text-center h-full max-h-[90%] relative overflow-hidden group"><div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 text-slate-300 flex items-center justify-center mb-4"><ImageIcon size={28} /></div><p className="text-xs font-bold text-slate-400 uppercase">Image Placeholder</p><p className="text-sm text-slate-500 italic px-2">"{slide.visualCue}"</p></div>)}
                     </div>
                     <div className="absolute bottom-0 left-0 h-1 bg-slate-50 w-full"><div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} /></div>
                 </div>
             </div>
         </div>
     );
  };

  const renderExam = (data: any) => (
      <div className="space-y-8">
          <div className="bg-white p-2 rounded-xl">
              <div className="text-center border-b-2 border-slate-100 pb-6 mb-6"><h2 className="text-2xl font-bold text-slate-900 uppercase">{data.title}</h2><p className="text-slate-500 mt-2">{data.instructions}</p></div>
              {data.sections?.map((section: any, i: number) => (
                  <div key={i} className="mb-8"><h3 className="text-lg font-bold text-slate-800 mb-4 bg-slate-100 px-4 py-2 rounded-lg">{section.sectionTitle}</h3><div className="space-y-6 px-2">{section.questions?.map((q: any, j: number) => (<div key={j} className="border-b border-slate-50 pb-4 last:border-0"><div className="flex justify-between items-start gap-4"><div className="flex gap-3"><span className="font-bold text-slate-900">{q.number}.</span><div className="space-y-2"><p className="text-slate-800 font-medium">{q.text}</p>{q.options && <ul className="space-y-1 ml-1">{q.options.map((opt: string, k: number) => <li key={k} className="text-slate-600 text-sm flex items-center gap-2"><div className="w-4 h-4 rounded-full border border-slate-300"></div>{opt}</li>)}</ul>}</div></div><span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">{q.marks}</span></div></div>))}</div></div>
              ))}
          </div>
      </div>
  );

  const renderAssignment = (data: any) => (
     <div className="space-y-6">
        <div className="border-b border-slate-100 pb-4"><h2 className="text-2xl font-bold text-slate-900">{data.title}</h2><p className="text-slate-600 mt-2">{data.overview}</p></div>
        <div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100"><h3 className="font-bold text-indigo-900 mb-3 text-sm uppercase">Learning Objectives</h3><ul className="list-disc list-inside space-y-2 text-slate-700 text-sm">{Array.isArray(data.objectives) ? data.objectives.map((o: string, i: number) => <li key={i}>{o}</li>) : <li>{data.objectives}</li>}</ul></div>
        <div><h3 className="font-bold text-slate-800 mb-3">Instructions</h3><ol className="list-decimal list-inside space-y-3 text-slate-700">{Array.isArray(data.instructions) ? data.instructions.map((inst: string, i: number) => <li key={i}>{inst}</li>) : <li>{data.instructions}</li>}</ol></div>
     </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20 print-area">
      <header className="mb-8 no-print">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Content Studio</h2>
        <p className="text-slate-500 mt-2 font-medium">Generate exams, assignments, and presentation slides instantly.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Column */}
        <div className="lg:col-span-4 space-y-6 no-print">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            
            {/* Type Selection */}
            <div className="grid grid-cols-1 gap-3">
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setContentType(t.id);
                    setGeneratedData(null); 
                  }}
                  className={`p-4 rounded-xl border flex items-center gap-4 transition-all text-left ${
                    contentType === t.id 
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                      : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${contentType === t.id ? 'bg-white/20' : 'bg-slate-100'}`}>
                    <t.icon size={20} />
                  </div>
                  <span className="font-bold">{t.id}</span>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Topic / Subject</label>
              <input 
                type="text" 
                className="w-full p-4 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm font-medium transition-all"
                placeholder="e.g. Photosynthesis, World War II..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            {/* ... Rest of input fields ... */}
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Reference Materials & Requirements</label>
              <textarea 
                className="w-full h-24 p-4 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm font-medium transition-all resize-none mb-3"
                placeholder={contentType === 'Presentation' ? "e.g. 5 slides, focus on visual diagrams..." : "e.g. 10 short questions..."}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
              
              {/* File Upload / Mic */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                 <div 
                   className="border-2 border-dashed border-slate-200 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-colors h-24"
                   onClick={() => fileInputRef.current?.click()}
                 >
                     <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,image/*,.txt" multiple onChange={handleFileUpload} />
                     <Upload size={20} className="text-indigo-500 mb-1" />
                     <span className="text-xs font-bold text-slate-500 text-center">Upload Files</span>
                 </div>
                 <div 
                   onClick={isRecording ? stopRecording : startRecording}
                   className={`border-2 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all h-24 ${isRecording ? 'bg-rose-50 border-rose-300' : 'border-dashed border-slate-200 hover:bg-slate-50'}`}
                 >
                     {isRecording ? <StopCircle size={24} className="text-rose-600 animate-pulse" /> : <Mic size={20} className="text-indigo-500 mb-1" />}
                     <span className="text-xs font-bold text-slate-500 text-center">{isRecording ? 'Stop' : 'Voice Note'}</span>
                 </div>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                  <div className="space-y-2 mb-4 animate-fade-in">
                      {uploadedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-100 rounded-lg border border-slate-200">
                              <div className="flex items-center gap-2 overflow-hidden">
                                  {file.mimeType.startsWith('audio') ? (
                                      <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md"><FileAudio size={14} /></div>
                                  ) : (
                                      <div className="p-1.5 bg-slate-200 text-slate-600 rounded-md"><Paperclip size={14} /></div>
                                  )}
                                  <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{file.name}</span>
                              </div>
                              <button 
                                  onClick={() => removeFile(idx)} 
                                  className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-1 rounded-md transition-colors"
                              >
                                  <X size={14} />
                              </button>
                          </div>
                      ))}
                  </div>
              )}
            </div>

            {loading ? (
              <button 
                onClick={handleStopGeneration}
                className="w-full bg-rose-50 border-2 border-rose-200 text-rose-600 hover:bg-rose-100 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
              >
                <StopCircle className="w-5 h-5 animate-pulse" />
                Stop Generating
              </button>
            ) : (
              <button 
                onClick={handleGenerate}
                disabled={!topic && uploadedFiles.length === 0 && !isRecording}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <PenTool className="w-5 h-5" />
                Generate Content
              </button>
            )}
          </div>
        </div>

        {/* Output Column */}
        <div className="lg:col-span-8">
           <div className="bg-white rounded-3xl shadow-sm border border-slate-100 h-full min-h-[600px] flex flex-col relative overflow-hidden">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/50 backdrop-blur-sm z-10 animate-fade-in">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                        <div className="relative p-6 bg-white rounded-full shadow-lg border border-indigo-50">
                            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800 mb-2">Generating Content...</h3>
                    <p className="text-slate-500 max-w-sm">AI is analyzing your topic and requirements to create professional educational material.</p>
                </div>
              ) : generatedData ? (
                <div className="flex flex-col h-full">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 no-print">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg"><BookOpen size={18} /></div>
                         <h3 className="font-bold text-slate-800">{contentType} Draft</h3>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleDiscard} className="text-sm flex items-center gap-1.5 text-rose-600 px-4 py-2 hover:bg-rose-50 rounded-lg"><Trash2 size={16} /> Discard</button>
                        <button onClick={handleDownload} className="text-sm flex items-center gap-1.5 text-indigo-600 px-4 py-2 hover:bg-indigo-50 rounded-lg"><FileDown size={16} /> Download</button>
                      </div>
                  </div>
                  
                  <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar" id="generated-content-display">
                     {contentType === 'Presentation' && renderPresentation(generatedData)}
                     {contentType === 'Exam' && renderExam(generatedData)}
                     {contentType === 'Assignment' && renderAssignment(generatedData)}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10">
                  <BookOpen size={64} className="mb-4 opacity-50" />
                  <p className="text-lg font-bold text-slate-400">Content Canvas</p>
                  <p className="text-sm text-slate-400 text-center max-w-xs mt-2">Configure on the left to generate content.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ContentGenerator;
