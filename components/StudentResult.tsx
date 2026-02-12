
import React, { useState, useEffect } from 'react';
import { AnalysisResponse, QuizQuestion } from '../types';
import { CheckCircle, AlertTriangle, Lightbulb, TrendingUp, AlertCircle, FileDown, FileText, Shield, Edit2, Save, X, Mail, HelpCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface StudentResultProps {
  result: AnalysisResponse;
  studentName?: string;
  onUpdate?: (updatedResult: AnalysisResponse) => void;
  quizData?: QuizQuestion[];
  studentAnswers?: number[];
}

const StudentResult: React.FC<StudentResultProps> = ({ result, studentName = "Student", onUpdate, quizData, studentAnswers }) => {
  // Ensure we have a valid score object to prevent "reading 'earned' of undefined"
  const safeScore = result?.score || { earned: 0, total: 0, percentage: 0 };
  const { sentiment, rubric_breakdown = [], critical_gaps = [], personalized_recommendation = [], summary = "No summary available.", plagiarism_score = 0, ai_probability = 0 } = result || {};
  
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [editValues, setEditValues] = useState({ earned: safeScore.earned, total: safeScore.total });

  // Reset edit values when result changes externally
  useEffect(() => {
      const currentScore = result?.score || { earned: 0, total: 0 };
      setEditValues({ earned: currentScore.earned, total: currentScore.total });
  }, [result]);

  const handleScoreSave = () => {
      if (onUpdate) {
          const pct = Math.round((editValues.earned / editValues.total) * 100) || 0;
          onUpdate({
              ...result,
              score: {
                  earned: editValues.earned,
                  total: editValues.total,
                  percentage: pct
              }
          });
      }
      setIsEditingScore(false);
  };

  const sentimentData = {
    Urgent: { color: 'text-rose-600 bg-rose-50 border-rose-100', icon: AlertCircle, label: 'Needs Attention' },
    Constructive: { color: 'text-amber-600 bg-amber-50 border-amber-100', icon: TrendingUp, label: 'Growing' },
    Encouraging: { color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: CheckCircle, label: 'On Track' }
  };

  const currentSentiment = sentimentData[sentiment] || sentimentData['Constructive'];
  const SentimentIcon = currentSentiment.icon;

  const chartData = [
    { name: 'Earned', value: safeScore.earned },
    { name: 'Lost', value: Math.max(0, safeScore.total - safeScore.earned) },
  ];
  const COLORS = ['#6366f1', '#e2e8f0'];

  const livePercentage = Math.round((editValues.earned / editValues.total) * 100) || 0;

  const handleEmailStudent = () => {
    const subject = `Grade Report: ${studentName}`;
    const body = `Dear ${studentName},\n\nHere is your grade report for the recent assignment.\n\nScore: ${safeScore.percentage}% (${safeScore.earned}/${safeScore.total})\nSummary: ${summary}\n\nKey Feedback:\n${critical_gaps.map(g => '- ' + g).join('\n')}\n\nRecommendations:\n${personalized_recommendation.map(r => '- ' + r).join('\n')}\n\nBest regards,\nYour Teacher`;
    
    // Open default mail client
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleDownloadText = () => {
    const textContent = `REPORT: ${studentName}\n\nSUMMARY: ${summary}\nSCORE: ${safeScore.percentage}%\n\nINTEGRITY:\nAI Likelihood: ${ai_probability}%\nPlagiarism: ${plagiarism_score}%\n\nGAPS:\n${critical_gaps.join('\n')}`;
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${studentName}_Report.txt`;
    link.click();
  };

  const handleDownloadDoc = () => {
    const element = document.createElement("a");
    const file = new Blob([`
      <html>
        <head>
          <meta charset="utf-8">
          <title>${studentName} - Report</title>
          <style>
            body { font-family: 'Arial', sans-serif; font-size: 12pt; line-height: 1.5; color: #000; }
            h1, h2, h3 { color: #000; }
            .header { border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
            .score { font-size: 24pt; font-weight: bold; color: #4f46e5; }
            .section { margin-bottom: 20px; }
            .gap-item { margin-bottom: 10px; }
            .rubric-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .rubric-table th, .rubric-table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            .rubric-table th { background-color: #f3f4f6; }
            .integrity { background-color: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>NextHorizon AI Report</h1>
            <h2>Student: ${studentName}</h2>
            <p>Summary: ${summary}</p>
          </div>
          
          <div class="section">
            <h3>Overall Performance</h3>
            <p>Score: <span class="score">${safeScore.percentage}%</span> (${safeScore.earned}/${safeScore.total})</p>
            <p>Sentiment: ${sentiment}</p>
          </div>

          <div class="section integrity">
             <h3>Academic Integrity</h3>
             <p>AI Generation Likelihood: <strong>${ai_probability}%</strong></p>
             <p>Plagiarism Score: <strong>${plagiarism_score}%</strong></p>
          </div>

          <div class="section">
             <h3>Critical Gaps</h3>
             <ul>
               ${critical_gaps.map(gap => `<li>${gap}</li>`).join('')}
             </ul>
          </div>

          <div class="section">
             <h3>Recommendations</h3>
             <ol>
               ${personalized_recommendation.map(rec => `<li>${rec}</li>`).join('')}
             </ol>
          </div>

          <div class="section">
             <h3>Rubric Breakdown</h3>
             <table class="rubric-table">
               <thead>
                 <tr>
                   <th>Criterion</th>
                   <th>Feedback</th>
                   <th>Score</th>
                 </tr>
               </thead>
               <tbody>
                 ${rubric_breakdown.map(item => `
                   <tr>
                     <td>${item.criterion}</td>
                     <td>${item.feedback}</td>
                     <td>${item.score}</td>
                   </tr>
                 `).join('')}
               </tbody>
             </table>
          </div>
        </body>
      </html>
    `], {type: 'application/msword'});
    
    element.href = URL.createObjectURL(file);
    element.download = `${studentName.replace(/\s+/g, '_')}_Report.doc`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6 animate-fade-in print-area max-w-6xl mx-auto">
      {/* Action Header - Hidden in Print */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
               <CheckCircle size={18} />
             </div>
             <h3 className="text-slate-800 font-bold text-lg">Analysis Complete</h3>
           </div>
           <p className="text-slate-500 text-sm mt-1 ml-10">Review the AI-generated insights below.</p>
        </div>
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <button 
              onClick={handleEmailStudent}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 text-sm font-bold transition-all"
            >
              <Mail size={18} /> Email Student
            </button>
            <button 
              onClick={handleDownloadText}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-5 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-sm font-bold transition-all"
            >
              <FileText size={18} /> Text
            </button>
            <button 
              onClick={handleDownloadDoc}
              className="flex-1 sm:flex-none justify-center flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl hover:from-indigo-900 hover:to-indigo-800 text-sm font-bold transition-all shadow-xl shadow-indigo-900/10 hover:shadow-indigo-900/20 hover:-translate-y-0.5 group"
            >
              <FileDown size={18} className="text-indigo-200 group-hover:text-white transition-colors" /> 
              <span>Save as .doc</span>
            </button>
        </div>
      </div>

      {/* Main Report Card */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden break-inside-avoid print:border-none print:shadow-none">
        {/* Banner */}
        <div className="bg-slate-50/50 border-b border-slate-100 p-6 md:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-start gap-5">
             <div className="w-28 h-28 shrink-0 rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white flex items-center justify-center text-3xl font-bold shadow-xl shadow-indigo-200 print:shadow-none transition-all">
                {isEditingScore ? livePercentage : safeScore.percentage}%
             </div>
             <div>
               <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{studentName}</h2>
               <div className="flex items-center gap-3 mt-2">
                 <span className={`px-4 py-1.5 rounded-full text-xs font-bold border flex items-center gap-2 ${currentSentiment.color}`}>
                   <SentimentIcon size={14} />
                   {currentSentiment.label}
                 </span>
                 
                 {isEditingScore ? (
                    <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-indigo-200 shadow-sm animate-fade-in ring-2 ring-indigo-50">
                        <input 
                        type="number" 
                        value={editValues.earned} 
                        onChange={(e) => setEditValues({...editValues, earned: Number(e.target.value)})}
                        className="w-16 text-center bg-white border border-slate-200 rounded px-1 py-1 text-slate-900 font-bold text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        autoFocus
                        />
                        <span className="text-slate-400 font-medium">/</span>
                        <input 
                        type="number" 
                        value={editValues.total} 
                        onChange={(e) => setEditValues({...editValues, total: Number(e.target.value)})}
                        className="w-16 text-center bg-white border border-slate-200 rounded px-1 py-1 text-slate-900 font-bold text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                        <div className="flex gap-1 ml-1">
                            <button onClick={handleScoreSave} className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-md transition"><Save size={16} /></button>
                            <button onClick={() => setIsEditingScore(false)} className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md transition"><X size={16} /></button>
                        </div>
                    </div>
                 ) : (
                    <div className="flex items-center gap-2 group">
                        <span className="text-slate-500 font-semibold text-sm bg-white px-3 py-1 rounded-full border border-slate-200">
                        {safeScore.earned} / {safeScore.total} Points
                        </span>
                        {onUpdate && (
                            <button 
                                onClick={() => { setEditValues({earned: safeScore.earned, total: safeScore.total}); setIsEditingScore(true); }} 
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors print:hidden opacity-0 group-hover:opacity-100"
                                title="Edit Score"
                            >
                                <Edit2 size={14} />
                            </button>
                        )}
                    </div>
                 )}
               </div>
             </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm max-w-lg print:border-slate-200">
            <p className="text-slate-600 text-sm md:text-base leading-relaxed font-medium">
              "{summary}"
            </p>
          </div>
        </div>

        {/* Content Grid */}
        <div className="p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 print:block">
          
          {/* Left Column: Charts & Gaps */}
          <div className="lg:col-span-4 space-y-8 print:mb-8">
             {/* Circular Chart */}
             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-indigo-100 transition-colors print:border-slate-200">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Score Distribution</h4>
                <div className="relative" style={{ height: '224px', width: '100%' }}>
                  {/* Fixed Recharts warning by explicit style height on container */}
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        stroke="none"
                        isAnimationActive={false} // Disable animation for print accuracy
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-5xl font-black text-slate-800 tracking-tighter">{safeScore.percentage}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">Total Score</span>
                  </div>
                </div>
             </div>

             {/* Integrity Check */}
             <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm print:border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={18} className="text-slate-400" />
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Academic Integrity</h4>
                </div>
                
                {/* AI Score */}
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-bold text-slate-700">AI Detection</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                      ai_probability < 30 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                      ai_probability < 60 ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {ai_probability}% Likely
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        ai_probability < 30 ? 'bg-emerald-500' : 
                        ai_probability < 60 ? 'bg-amber-500' : 
                        'bg-rose-500'
                      }`} 
                      style={{ width: `${ai_probability}%` }} 
                    />
                  </div>
                </div>

                {/* Plagiarism Score */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-bold text-slate-700">Plagiarism Check</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${
                      plagiarism_score < 15 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                      plagiarism_score < 40 ? 'bg-amber-50 text-amber-700 border-amber-100' : 
                      'bg-rose-50 text-rose-700 border-rose-100'
                    }`}>
                      {plagiarism_score}% Match
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        plagiarism_score < 15 ? 'bg-emerald-500' : 
                        plagiarism_score < 40 ? 'bg-amber-500' : 
                        'bg-rose-500'
                      }`} 
                      style={{ width: `${plagiarism_score}%` }} 
                    />
                  </div>
                </div>
             </div>

             {/* Critical Gaps */}
             <div className="bg-rose-50/50 rounded-3xl border border-rose-100 p-8 break-inside-avoid print:border-rose-200">
               <div className="flex items-center gap-3 mb-5 text-rose-700">
                 <div className="p-2 bg-rose-100 rounded-lg">
                   <AlertTriangle size={20} />
                 </div>
                 <h3 className="font-bold text-lg">Areas for Improvement</h3>
               </div>
               <ul className="space-y-4">
                 {critical_gaps.map((gap, i) => (
                   <li key={i} className="flex gap-4 text-sm text-slate-700 bg-white p-4 rounded-2xl border border-rose-100 shadow-sm print:border-rose-200">
                     <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs">{i+1}</span>
                     <span className="font-medium leading-relaxed">{gap}</span>
                   </li>
                 ))}
                 {critical_gaps.length === 0 && <li className="text-slate-500 italic text-sm font-medium">No major gaps found. Excellent work!</li>}
               </ul>
             </div>
          </div>

          {/* Right Column: Rubric & Recommendations & Quiz Breakdown */}
          <div className="lg:col-span-8 space-y-8">
             
             {/* Recommendations */}
             <div className="bg-gradient-to-br from-indigo-50/80 to-white rounded-3xl border border-indigo-100 p-8 break-inside-avoid print:bg-none print:border-indigo-200">
                <div className="flex items-center gap-3 mb-6 text-indigo-700">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Lightbulb size={20} className="fill-indigo-600 text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-lg">Recommended Action Plan</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {personalized_recommendation.map((rec, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-indigo-50 hover:shadow-md transition-shadow print:border-slate-200">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg mb-4">
                        {i+1}
                      </div>
                      <p className="text-sm text-slate-700 font-semibold leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
             </div>

             {/* Rubric Table */}
             <div className="space-y-5 break-inside-avoid">
                <div className="flex items-center gap-2 px-2">
                   <FileText className="text-slate-400" size={20} />
                   <h3 className="font-bold text-slate-800 text-lg">Rubric Breakdown</h3>
                </div>
                <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm">
                  {rubric_breakdown.map((item, i) => (
                    <div key={i} className={`p-6 flex flex-col md:flex-row gap-6 items-start ${i !== rubric_breakdown.length - 1 ? 'border-b border-slate-100' : ''}`}>
                       <div className="md:w-1/4">
                          <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{item.criterion}</h4>
                       </div>
                       <div className="flex-1">
                          <p className="text-sm text-slate-600 leading-relaxed font-medium">{item.feedback}</p>
                       </div>
                       <div className="md:w-24 text-right flex-shrink-0">
                          <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-sm font-bold border ${item.score >= 8 ? 'bg-green-50 text-green-700 border-green-100' : item.score >= 5 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100'}`}>
                            {item.score} pts
                          </span>
                       </div>
                    </div>
                  ))}
                </div>
             </div>

             {/* Quiz Breakdown (Conditional) */}
             {quizData && studentAnswers && (
                 <div className="space-y-5 break-inside-avoid">
                    <div className="flex items-center gap-2 px-2">
                       <HelpCircle className="text-slate-400" size={20} />
                       <h3 className="font-bold text-slate-800 text-lg">Quiz Results</h3>
                    </div>
                    <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm p-6 space-y-4">
                        {quizData.map((q, i) => {
                            const studentAnswer = studentAnswers[i] ?? -1;
                            const isCorrect = studentAnswer === q.correctAnswer;
                            
                            return (
                                <div key={i} className={`p-4 rounded-2xl border-l-4 ${isCorrect ? 'border-l-emerald-500 bg-emerald-50/30' : 'border-l-rose-500 bg-rose-50/30'}`}>
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-xs font-bold text-slate-500 uppercase">Question {i + 1}</p>
                                        {isCorrect ? (
                                            <span className="text-xs font-bold text-emerald-600 bg-white px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1"><CheckCircle size={10} /> Correct</span>
                                        ) : (
                                            <span className="text-xs font-bold text-rose-600 bg-white px-2 py-0.5 rounded border border-rose-100 flex items-center gap-1"><AlertCircle size={10} /> Incorrect</span>
                                        )}
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 mb-3">{q.question}</p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                        <div className="bg-white p-2 rounded-lg border border-slate-100">
                                            <span className="block text-slate-400 font-bold mb-1">Student Answer</span>
                                            <span className={`font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {studentAnswer !== -1 ? q.options[studentAnswer] : 'No Answer'}
                                            </span>
                                        </div>
                                        {!isCorrect && (
                                            <div className="bg-white p-2 rounded-lg border border-slate-100">
                                                <span className="block text-slate-400 font-bold mb-1">Correct Answer</span>
                                                <span className="font-bold text-emerald-700">
                                                    {q.options[q.correctAnswer]}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 </div>
             )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentResult;
