import React, { useState } from 'react';
import { generateRubric } from '../services/geminiService';
import { Loader2, Sparkles, Copy, Check, Printer } from 'lucide-react';

const RubricGenerator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [generatedRubric, setGeneratedRubric] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!topic) return;
    setLoading(true);
    setGeneratedRubric('');
    const result = await generateRubric(topic);
    setGeneratedRubric(result);
    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedRubric);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto print-area pb-20">
      <div className="text-center mb-10 no-print">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Instant Rubric Generator</h2>
        <p className="text-slate-500 mt-2 font-medium">Generate professional grading standards for any Malaysian curriculum topic.</p>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
        <div className="no-print">
          <label className="block text-sm font-bold text-slate-800 mb-2">Topic or Learning Objective</label>
          <div className="flex flex-col md:flex-row gap-3">
            <input 
              type="text" 
              className="flex-1 p-4 border border-slate-200 bg-slate-50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-lg font-medium transition-all"
              placeholder="e.g., Hukum Newton Kedua, Sejarah Kemerdekaan..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
            <button 
              onClick={handleGenerate}
              disabled={loading || !topic}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles size={20} />}
              Generate
            </button>
          </div>
        </div>

        {generatedRubric && (
          <div className="mt-8 animate-fade-in border-t border-slate-100 pt-8">
             <div className="flex justify-between items-center mb-4 no-print">
                <h3 className="font-bold text-lg text-slate-800">Generated Rubric</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={copyToClipboard}
                    className="text-sm flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold px-4 py-2 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="text-sm flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-semibold px-4 py-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Printer size={16} />
                    PDF
                  </button>
                </div>
             </div>
             <div className="bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-200 font-mono text-sm text-slate-700 whitespace-pre-wrap leading-relaxed h-[500px] overflow-y-auto print-area-content shadow-inner">
                {generatedRubric}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RubricGenerator;