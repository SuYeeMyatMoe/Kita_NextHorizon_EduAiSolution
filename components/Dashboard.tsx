
import React, { useMemo, useState } from 'react';
import { AlertCircle, TrendingUp, MoreVertical, Search, Filter, Download, BookOpen, Users, ChevronDown, Clock } from 'lucide-react';
import { Student } from '../types';

type FilterType = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface DashboardProps {
  students: Student[];
}

const Dashboard: React.FC<DashboardProps> = ({ students }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<FilterType>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');

  const DEFAULT_ATTENDANCE = 85;

  const sortedStudents = useMemo(() => {
    // Sort by Risk Score descending
    return [...students].sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
  }, [students]);

  const subjects = useMemo(() => Array.from(new Set(students.map(s => s.subject))), [students]);
  const classes = useMemo(() => Array.from(new Set(students.map(s => s.class))), [students]);

  const filteredStudents = useMemo(() => {
    return sortedStudents.filter(student => {
      const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSubject = subjectFilter === 'ALL' || student.subject === subjectFilter;
      const matchesClass = classFilter === 'ALL' || student.class === classFilter;
      
      let matchesRisk = true;
      const score = student.riskScore || 0;
      
      if (riskFilter === 'HIGH') matchesRisk = score >= 60;
      else if (riskFilter === 'MEDIUM') matchesRisk = score >= 30 && score < 60;
      else if (riskFilter === 'LOW') matchesRisk = score < 30;

      return matchesSearch && matchesRisk && matchesSubject && matchesClass;
    });
  }, [sortedStudents, searchQuery, riskFilter, subjectFilter, classFilter]);

  // Calculate unique students based on Name (normalized) to treat same-named entries as one person
  const uniqueStudentCount = useMemo(() => {
    const uniqueNames = new Set(filteredStudents.map(s => s.name.trim().toLowerCase()));
    return uniqueNames.size;
  }, [filteredStudents]);

  const handleGenerateReport = () => {
    const headers = ['Student Name', 'Class', 'Subject', 'Risk Score', 'Attendance (%)', 'Absences', 'Average Grade (%)', 'Primary Gap'];
    const rows = filteredStudents.map(s => {
      const avg = s.submissions.length > 0 
        ? Math.round(s.submissions.reduce((acc, curr) => acc + (curr.analysis?.score?.percentage || 0), 0) / s.submissions.length) 
        : 0;

      return [
        s.name,
        s.class,
        s.subject,
        s.riskScore?.toString() || '0',
        (typeof s.attendanceRate === 'number' ? s.attendanceRate : DEFAULT_ATTENDANCE).toString(),
        s.absences?.toString() || '0',
        avg.toString(),
        `"${s.lastSubmission?.critical_gaps[0] || 'None'}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filename = `Intervention_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in no-print pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Intervention Dashboard</h2>
          <p className="text-slate-500 mt-2 font-medium">Holistic risk assessment (Grades + Attendance).</p>
        </div>
        <button 
          onClick={handleGenerateReport}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-bold transition-all shadow-lg shadow-indigo-200 hover:-translate-y-0.5"
        >
          <Download size={18} />
          Export Data
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { 
            label: 'Avg. Attendance', 
            // Fix: Default to 0 instead of DEFAULT_ATTENDANCE when empty
            value: `${filteredStudents.length > 0 ? Math.round(filteredStudents.reduce((acc, curr) => acc + (typeof curr.attendanceRate === 'number' ? curr.attendanceRate : DEFAULT_ATTENDANCE), 0) / filteredStudents.length) : 0}%`, 
            icon: Clock, 
            color: 'text-indigo-600', 
            bg: 'bg-indigo-50' 
          },
          { label: 'High Risk Cases', value: filteredStudents.filter(s => (s.riskScore || 0) >= 60).length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Total Students', value: uniqueStudentCount, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-slate-200 transition-colors">
             <div>
               <p className="text-sm font-semibold text-slate-500 mb-1">{stat.label}</p>
               <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
             </div>
             <div className={`p-4 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}>
               <stat.icon size={28} />
             </div>
          </div>
        ))}
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Filter Bar */}
        <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row gap-4 justify-between items-center bg-slate-50/50">
           <div className="relative w-full xl:w-96">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Search by student name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
           </div>
           
           <div className="flex gap-3 w-full xl:w-auto overflow-x-auto pb-1 xl:pb-0">
               {[
                 { value: subjectFilter, onChange: setSubjectFilter, options: subjects, label: 'Subject', icon: BookOpen },
                 { value: classFilter, onChange: setClassFilter, options: classes, label: 'Class', icon: Users },
               ].map((filter, i) => (
                 <div key={i} className="relative min-w-[140px]">
                    <select 
                      value={filter.value}
                      onChange={(e) => filter.onChange(e.target.value)}
                      className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-10 pr-10 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                    >
                      <option value="ALL">All {filter.label}s</option>
                      {filter.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <filter.icon className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <ChevronDown className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                 </div>
               ))}

               <div className="relative min-w-[140px]">
                  <select 
                     value={riskFilter}
                     onChange={(e) => setRiskFilter(e.target.value as FilterType)}
                     className="w-full appearance-none bg-white border border-slate-200 text-slate-700 py-2.5 pl-10 pr-10 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-indigo-300 transition-colors"
                  >
                    <option value="ALL">All Risk Levels</option>
                    <option value="HIGH">High Risk</option>
                    <option value="MEDIUM">Medium Risk</option>
                    <option value="LOW">Low Risk</option>
                  </select>
                  <Filter className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                  <ChevronDown className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
               </div>
           </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Info</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Risk Index</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Attendance</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Average Grade</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => {
                  const risk = student.riskScore || 0;
                  const isHighRisk = risk >= 60;
                  const isMedRisk = risk >= 30 && risk < 60;
                  const attendRate = typeof student.attendanceRate === 'number' ? student.attendanceRate : DEFAULT_ATTENDANCE;
                  
                  const avgGrade = student.submissions.length > 0 
                    ? Math.round(student.submissions.reduce((acc, curr) => acc + (curr.analysis?.score?.percentage || 0), 0) / student.submissions.length) 
                    : 0;

                  return (
                    <tr key={student.id} className="hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold mr-4 shadow-sm ${isHighRisk ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                            {student.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-slate-800">{student.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex flex-col">
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md w-fit mb-1">{student.subject}</span>
                            <span className="text-xs text-slate-500 font-medium">{student.class}</span>
                         </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${isHighRisk ? 'bg-rose-500' : isMedRisk ? 'bg-amber-400' : 'bg-emerald-500'}`} 
                              style={{ width: `${Math.min(risk, 100)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-bold ${isHighRisk ? 'text-rose-600' : isMedRisk ? 'text-amber-600' : 'text-emerald-600'}`}>{risk}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-sm font-bold ${attendRate < 80 ? 'text-rose-600' : 'text-slate-700'}`}>{attendRate}%</span>
                          {student.absences ? (
                             <span className="text-[10px] text-slate-400 font-medium">{student.absences} Absences</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {avgGrade}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button className="text-slate-400 hover:text-indigo-600 p-2 hover:bg-slate-100 rounded-full transition-colors">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Search size={48} className="mb-4 opacity-20" />
                      <p className="text-lg font-medium text-slate-500">No students found.</p>
                      <p className="text-sm">Try adjusting your filters.</p>
                    </div>
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

export default Dashboard;
