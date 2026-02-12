
import React from 'react';
import { LayoutDashboard, GraduationCap, Settings, X, Hexagon, BookOpen, ClipboardList, QrCode, Library, LogOut } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isOpen: boolean;
  closeSidebar: () => void;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen, closeSidebar, onLogout }) => {
  const menuItems = [
    { id: ViewState.DASHBOARD, label: 'Intervention', icon: LayoutDashboard },
    { id: ViewState.CLASSROOM, label: 'Classroom', icon: Library },
    { id: ViewState.GRADER, label: 'AI Grader', icon: GraduationCap },
    { id: ViewState.REPORT_CARD, label: 'Report Cards', icon: ClipboardList },
    { id: ViewState.CONTENT_GEN, label: 'Content Studio', icon: BookOpen },
    { id: ViewState.ATTENDANCE, label: 'Attendance', icon: QrCode },
  ];

  // Helper to ensure 100% consistent styling across all nav items
  const getNavItemClass = (isActive: boolean, isDanger = false) => `
    w-full flex items-center space-x-3.5 px-5 py-4 lg:py-4 rounded-2xl transition-all duration-200 group relative overflow-hidden
    ${isActive 
      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
      : isDanger 
        ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-700' 
        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }
  `;

  const getIconClass = (isActive: boolean, isDanger = false) => `
    shrink-0 transition-colors
    ${isActive 
      ? 'text-white' 
      : isDanger
        ? 'text-rose-400 group-hover:text-rose-600'
        : 'text-slate-400 group-hover:text-slate-900'
    }
  `;

  return (
    <>
      {/* Mobile Overlay (Only visible on small screens when open) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed top-0 left-0 z-40 h-full bg-white border-r border-slate-200 shadow-xl md:shadow-none transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 md:sticky md:top-0 md:h-screen md:block
        w-64 md:w-72 lg:w-80
        flex flex-col shrink-0
        no-print
      `}>
        <div className="p-6 lg:p-8 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/20">
              <Hexagon className="w-6 h-6 lg:w-7 lg:h-7 text-white fill-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 leading-none">
                NextHorizon
              </h1>
              <p className="text-[10px] lg:text-xs uppercase tracking-wider text-indigo-600 font-bold mt-1">AI Core Engine</p>
            </div>
          </div>
          <button onClick={closeSidebar} className="md:hidden text-slate-400 hover:text-slate-900 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 lg:p-6 space-y-2 lg:space-y-3 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  closeSidebar(); // Close on mobile selection
                }}
                className={getNavItemClass(isActive)}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/20 rounded-r-full" />
                )}
                <Icon size={22} className={getIconClass(isActive)} />
                <span className={`font-bold text-sm lg:text-base ${isActive ? 'text-white' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 lg:p-6 border-t border-slate-100 bg-white space-y-2 mt-auto">
          <button 
            onClick={() => {
              setView(ViewState.SETTINGS);
              closeSidebar();
            }}
            className={getNavItemClass(currentView === ViewState.SETTINGS)}
          >
            {currentView === ViewState.SETTINGS && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/20 rounded-r-full" />
            )}
            <Settings size={22} className={getIconClass(currentView === ViewState.SETTINGS)} />
            <span className={`text-sm lg:text-base font-bold ${currentView === ViewState.SETTINGS ? 'text-white' : ''}`}>Settings</span>
          </button>
          
          {onLogout && (
             <button 
               onClick={onLogout}
               className={getNavItemClass(false, true)}
             >
               <LogOut size={22} className={getIconClass(false, true)} />
               <span className="text-sm lg:text-base font-bold">Sign Out</span>
             </button>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
