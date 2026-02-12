
import React, { useState, useMemo } from 'react';
import { Download, Filter, Search, ChevronDown, BookOpen, Users, ClipboardList, TrendingUp, ChevronRight, ChevronUp, FileText, Calendar } from 'lucide-react';
import { Student } from '../types';

interface ReportCardProps {
  students: Student[];
  classes: string[];
  subjects: string[];
}

const ReportCard: React.FC<ReportCardProps> = ({ students, classes, subjects }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Grouped Logic: We filter the STUDENTS first, not the submissions.
  // This ensures we show one row per student.
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = subjectFilter === 'ALL' || student.subject === subjectFilter;
      const matchesClass = classFilter === 'ALL' || student.class === classFilter;
      return matchesSearch && matchesSubject && matchesClass;
    });
  }, [students, searchQuery, subjectFilter, classFilter]);

  // Helper to calculate average for a specific student's currently loaded submissions
  const getStudentAverage = (student: Student) => {
      if (student.submissions.length === 0) return 0;
      const total = student.submissions.reduce((acc, curr) => acc + (curr.analysis?.score?.percentage || 0), 0);
      return Math.round(total / student.submissions.length);
  };

  const handleDownloadCSV = () => {
    const headers = [
      'Student Name', 
      'Class', 
      'Subject', 
      'Overall Average (%)', 
      'Attendance Rate (%)', 
      'Risk Score',
      'Total Assignments',
      'Last Submission Date'
    ];

    const rows = filteredStudents.map(s => {
      const average = getStudentAverage(s);
      const lastSubDate = s.submissions.length > 0 
        ? new Date(Math.max(...s.submissions.map(sub => new Date(sub.timestamp).getTime()))).toLocaleDateString()
        : 'N/A';

      return [
        s.name,
        s.class,
        s.subject,
        average.toString(),
        (s.attendanceRate ?? 'N/A').toString(),
        (s.riskScore ?? 'N/A').toString(),
        s.submissions.length.toString(),
        lastSubDate
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `Report_Card_Summary_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExpand = (id: string) => {
    if (expandedStudentId === id) {
        setExpandedStudentId(null);
    } else {
        setExpandedStudentId(id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in no-print pb-20">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
             <ClipboardList className="text-indigo-600" size={32} />
             Report Cards
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Consolidated gradebook grouped by student.</p>
        </div>
        <button 
          onClick={handleDownloadCSV}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm font-bold transition-all shadow-lg shadow-emerald-200 hover:-translate-y-0.5"
        >
          <Download size={18} />
          Export Gradebook (CSV)
        </button>
      </header>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Filters */}
        <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row gap-4 justify-between items-center bg-slate-50/50">
           <div className="relative w-full xl:w-96">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search students..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
           </div>
           
           <div className="flex gap-3 w-full xl:w-auto overflow-x-auto">
               <div className="relative min-w-[140px]">
                  <select 
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-10 pr-10 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                  >
                    <option value="ALL">All Classes</option>
                    {classes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Users className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <ChevronDown className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
               </div>

               <div className="relative min-w-[140px]">
                  <select 
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-10 pr-10 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                  >
                    <option value="ALL">All Subjects</option>
                    {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <BookOpen className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <ChevronDown className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
               </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-10"></th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Class Info</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Overall Avg</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Submissions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const avg = getStudentAverage(student);
                  const isExpanded = expandedStudentId === student.id;
                  const defaultAttendance = 85;

                  return (
                    <React.Fragment key={student.id}>
                      {/* Parent Row - Summary */}
                      <tr 
                        onClick={() => toggleExpand(student.id)} 
                        className={`cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-6 py-4 text-slate-400">
                             {isExpanded ? <ChevronUp size={18} className="text-indigo-600" /> : <ChevronRight size={18} />}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                              <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold mr-3 shadow-sm ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                {student.name.charAt(0)}
                              </div>
                              <span className={`text-sm font-bold ${isExpanded ? 'text-indigo-900' : 'text-slate-800'}`}>{student.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <div className="flex flex-col">
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded w-fit">{student.subject}</span>
                              <span className="text-xs text-slate-500 mt-1 font-medium">{student.class}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                           <div className="flex items-center justify-center gap-1">
                               <TrendingUp size={16} className={avg >= 80 ? 'text-emerald-500' : avg >= 50 ? 'text-amber-500' : 'text-rose-500'} />
                               <span className="text-sm font-bold text-slate-700">{avg}%</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                           <span className="text-sm font-bold text-slate-700">{student.attendanceRate ?? defaultAttendance}%</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                           <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full">{student.submissions.length} Tasks</span>
                        </td>
                      </tr>

                      {/* Child Row - Detailed Submissions */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50 animate-fade-in">
                           <td colSpan={6} className="p-4 md:p-6">
                              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                 <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                                     <FileText size={16} className="text-slate-400" />
                                     <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Submission History</h4>
                                 </div>
                                 {student.submissions.length > 0 ? (
                                    <table className="w-full">
                                       <thead>
                                          <tr className="border-b border-slate-100">
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Date</th>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Assignment Type</th>
                                            <th className="px-6 py-3 text-center text-[10px] font-bold text-slate-400 uppercase">Score</th>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Sentiment</th>
                                          </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-50">
                                          {student.submissions.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map(sub => (
                                              <tr key={sub.id} className="hover:bg-indigo-50/30">
                                                 <td className="px-6 py-3 text-sm text-slate-600 font-medium">
                                                    <div className="flex items-center gap-2">
                                                       <Calendar size={14} className="text-slate-300" />
                                                       {new Date(sub.timestamp).toLocaleDateString()}
                                                    </div>
                                                 </td>
                                                 <td className="px-6 py-3">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                       sub.type === 'QUIZ' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                       {sub.type || 'ASSIGNMENT'}
                                                    </span>
                                                 </td>
                                                 <td className="px-6 py-3 text-center">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded border ${
                                                       (sub.analysis?.score?.percentage || 0) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                       (sub.analysis?.score?.percentage || 0) >= 50 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                       'bg-rose-50 text-rose-700 border-rose-100'
                                                    }`}>
                                                       {sub.analysis?.score?.percentage || 0}%
                                                    </span>
                                                 </td>
                                                 <td className="px-6 py-3 text-sm text-slate-600">
                                                    {sub.analysis?.sentiment || '-'}
                                                 </td>
                                              </tr>
                                          ))}
                                       </tbody>
                                    </table>
                                 ) : (
                                    <div className="p-8 text-center text-slate-400 italic text-sm">No submissions recorded yet.</div>
                                 )}
                              </div>
                           </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                   <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <p className="font-medium">No records found.</p>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ReportCard;
