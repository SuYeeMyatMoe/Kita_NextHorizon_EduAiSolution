import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';
import { Loader2, Image as ImageIcon, Download, Sparkles, AlertCircle } from 'lucide-react';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt) return;
    setLoading(true);
    setError('');
    setImageUrl(null);
    try {
      const url = await generateImage(prompt, resolution);
      setImageUrl(url);
    } catch (err) {
      setError('Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `generated-image-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-20">
      <header className="mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-xl text-indigo-600">
            <ImageIcon size={28} />
          </div>
          Visual Learning Engine
        </h2>
        <p className="text-slate-500 mt-2 font-medium ml-14">Generate high-fidelity educational diagrams, scenes, and visual aids using Gemini 3.1 Flash.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Controls Section */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">Image Prompt</label>
              <textarea 
                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-none text-sm font-medium text-slate-700"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the image in detail... e.g., A detailed cross-section of a plant cell with labeled organelles, 3D realistic style."
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-3">Resolution Quality</label>
              <div className="grid grid-cols-3 gap-2">
                {['1K', '2K', '4K'].map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res as any)}
                    className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                      resolution === res 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2 font-medium">Higher resolutions may take slightly longer to generate.</p>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Sparkles className="fill-indigo-400 text-indigo-400" />}
              {loading ? 'Generating...' : 'Generate Visual'}
            </button>

            {error && (
              <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-sm font-bold flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Display Section */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 h-full min-h-[500px] flex flex-col overflow-hidden relative group">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm z-10">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <p className="text-slate-500 font-bold animate-pulse">Creating masterpiece...</p>
              </div>
            ) : imageUrl ? (
              <>
                 <div className="flex-1 bg-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
                    <img src={imageUrl} alt="Generated" className="max-w-full max-h-[600px] rounded-lg shadow-lg object-contain" />
                 </div>
                 <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-white">
                    <div>
                      <h4 className="font-bold text-slate-800">Generated Result</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1">{resolution} • 1:1 Aspect Ratio</p>
                    </div>
                    <button 
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-colors"
                    >
                      <Download size={18} />
                      Download
                    </button>
                 </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10">
                <ImageIcon size={64} className="mb-4 opacity-50" />
                <p className="text-lg font-bold text-slate-400">Ready to visualize.</p>
                <p className="text-sm text-slate-400 text-center max-w-xs mt-2">Enter a prompt and select a resolution to generate educational imagery.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGenerator;