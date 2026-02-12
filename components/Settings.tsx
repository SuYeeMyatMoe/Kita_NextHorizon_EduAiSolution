
import React, { useState, useEffect } from 'react';
import { Save, User, Loader2, School, Edit2 } from 'lucide-react';
import { auth, db, doc, getDoc, updateProfile } from '../services/firebase';

const Settings: React.FC = () => {
  const [displayName, setDisplayName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          // Fetch from Firestore to get School Name
          const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as any;
            setDisplayName(data.displayName || auth.currentUser.displayName || "");
            setSchoolName(data.school || "");
          } else {
             setDisplayName(auth.currentUser.displayName || "");
          }
        } catch (error) {
          console.error("Error fetching user settings:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchUserData();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await updateProfile(auth.currentUser, {
        displayName: displayName,
        school: schoolName
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <header>
        <h2 className="text-3xl font-bold text-slate-900">Settings</h2>
        <p className="text-slate-500 mt-2">Manage your teaching profile and application preferences.</p>
      </header>

      <div className="grid grid-cols-1 gap-8">
        {/* Profile Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <User size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Profile Information</h3>
          </div>
          <div className="p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Display Name</label>
                <div className="relative group">
                    <User className="absolute left-4 top-3.5 text-slate-400 w-5 h-5 group-hover:text-indigo-500 transition-colors" />
                    <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                    placeholder="Your Name"
                    />
                    <Edit2 className="absolute right-4 top-3.5 text-slate-300 w-4 h-4 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">School / Institution</label>
                 <div className="relative group">
                    <School className="absolute left-4 top-3.5 text-slate-400 w-5 h-5 group-hover:text-indigo-500 transition-colors" />
                    <input 
                    type="text" 
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-medium"
                    placeholder="Your School"
                    />
                    <Edit2 className="absolute right-4 top-3.5 text-slate-300 w-4 h-4 pointer-events-none" />
                </div>
              </div>
            </div>
            
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
               <div className="w-5 h-5 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs mt-0.5">i</div>
               <p className="text-sm text-indigo-800 leading-relaxed">
                 <strong>Note:</strong> These details will appear on student reports and classroom headers. Updating here reflects across the entire platform immediately.
               </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white transition-all shadow-lg hover:-translate-y-0.5 disabled:opacity-50 ${saved ? 'bg-emerald-500 shadow-emerald-200' : 'bg-slate-900 hover:bg-slate-800 shadow-slate-200'}`}
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : saved ? 'Changes Saved!' : 'Save Changes'}
            {!saved && !saving && <Save size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
