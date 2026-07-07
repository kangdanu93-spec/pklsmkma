import { useState, useEffect } from 'react';
import { 
  Database, Activity, ShieldAlert, GraduationCap, Users, 
  HelpCircle, Settings, RefreshCw, BarChart3, LayoutDashboard, LogOut, CheckCircle, Flame
} from 'lucide-react';

// Models & Types
import { PklUser, PklInstansi, PklJournal, PklAttendance, PklPlacement, PklEvaluation, Announcement, MenuAccess } from './types';

// DB Operations
import { 
  dbGetUsers, dbGetInstansi, dbGetPlacements, dbGetJournals, 
  dbGetAttendance, dbGetEvaluations, dbGetAnnouncements, dbGetMenuAccess, isSuperAdmin
} from './utils/localDb';
import { isSupabaseConnected, getSupabaseConfig, getSupabaseClient, syncSupabaseConfigFromServer } from './supabaseClient';

// Dashboards & Login
import { Login } from './components/Login';
import SupabaseConfig from './components/SupabaseConfig';
import StudentDashboard from './components/StudentDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import IndustryDashboard from './components/IndustryDashboard';
import AdminDashboard from './components/AdminDashboard';
import StatsDashboard from './components/StatsDashboard';

export default function App() {
  // Global lists
  const [users, setUsers] = useState<PklUser[]>([]);
  const [instansiList, setInstansiList] = useState<PklInstansi[]>([]);
  const [placements, setPlacements] = useState<PklPlacement[]>([]);
  const [journals, setJournals] = useState<PklJournal[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<PklAttendance[]>([]);
  const [evaluations, setEvaluations] = useState<PklEvaluation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [menuAccessList, setMenuAccessList] = useState<MenuAccess[]>([]);
  
  // Loading & UI control
  const [globalLoading, setGlobalLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'stats' | 'supabase'>('dashboard');
  const [currentUser, setCurrentUser] = useState<PklUser | null>(null);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [sbDetails, setSbDetails] = useState<{ url: string } | null>(null);
  const [isUsingLocalStorageFallback, setIsUsingLocalStorageFallback] = useState(false);

  // Load everything on start
  useEffect(() => {
    loadGlobalData();
  }, []);

  const loadGlobalData = async (silent = false) => {
    if (!silent) setGlobalLoading(true);
    try {
      // Sync Supabase credentials from full-stack server
      await syncSupabaseConfigFromServer();

      // Load menu permissions
      const menuPerms = dbGetMenuAccess();
      setMenuAccessList(menuPerms);

      // 1. Check database connection status
      const connected = isSupabaseConnected();
      setIsDbConnected(connected);
      if (connected) {
        const conf = getSupabaseConfig();
        if (conf) setSbDetails({ url: conf.url });
      } else {
        setSbDetails(null);
      }

      // 2. Fetch all collections
      const resUsers = await dbGetUsers();
      setUsers(resUsers.data);

      if (connected && !resUsers.fromSupabase) {
        setIsUsingLocalStorageFallback(true);
      } else {
        setIsUsingLocalStorageFallback(false);
      }

      const resInst = await dbGetInstansi();
      setInstansiList(resInst.data);

      const resPlace = await dbGetPlacements();
      setPlacements(resPlace.data);

      const resJour = await dbGetJournals();
      setJournals(resJour.data);

      const resAtt = await dbGetAttendance();
      setAttendanceLogs(resAtt.data);

      const resEvals = await dbGetEvaluations();
      setEvaluations(resEvals.data);

      const resAnns = await dbGetAnnouncements();
      setAnnouncements(resAnns.data);

      // 3. Restore session if stored in localStorage or Supabase Auth
      let sessionUserFound = false;

      if (connected) {
        const sb = getSupabaseClient();
        if (sb) {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.user?.email) {
            const found = resUsers.data.find(u => u.email.toLowerCase() === session.user.email!.toLowerCase());
            if (found) {
              setCurrentUser(found);
              localStorage.setItem('SIM_PKL_LOGGED_IN_USER_ID', found.id);
              sessionUserFound = true;
            }
          }
        }
      }

      if (!sessionUserFound) {
        const savedUserId = localStorage.getItem('SIM_PKL_LOGGED_IN_USER_ID');
        if (savedUserId && resUsers.data.length > 0) {
          const found = resUsers.data.find(u => u.id === savedUserId);
          if (found) {
            setCurrentUser(found);
          }
        }
      }
    } catch (error) {
      console.error('Gagal memuat data SIM PKL:', error);
    } finally {
      if (!silent) setGlobalLoading(false);
    }
  };

  const handleUserSessionSwitch = (userId: string) => {
    const selected = users.find(u => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
      localStorage.setItem('SIM_PKL_LOGGED_IN_USER_ID', selected.id);
    } else {
      setCurrentUser(null);
      localStorage.removeItem('SIM_PKL_LOGGED_IN_USER_ID');
    }
  };

  const handleLogout = async () => {
    const sb = getSupabaseClient();
    if (sb) {
      await sb.auth.signOut();
    }
    setCurrentUser(null);
    localStorage.removeItem('SIM_PKL_LOGGED_IN_USER_ID');
    setActiveMenu('dashboard');
  };

  const handleConfigChanged = () => {
    loadGlobalData();
  };

  const onRefreshGlobalData = () => {
    loadGlobalData(true);
  };

  const isMenuAllowed = (menuId: string): boolean => {
    if (!currentUser) return true; // Default true if no user (login screen or basic flow)
    if (isSuperAdmin(currentUser)) return true; // Super admin can access anything
    
    const menu = menuAccessList.find(m => m.id === menuId);
    if (!menu) return true;
    return menu.allowed_roles.includes(currentUser.role);
  };

  if (globalLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-lg font-bold text-slate-800">Menyiapkan SIM PKL</h2>
        <p className="text-sm text-slate-500 mt-1">Menginisialisasi modul database dan otentikasi...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/65 flex flex-col font-sans antialiased text-slate-800" id="main-applet">
      

      {/* TOP HEADER */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Logo & Info */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-600/10">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>SIM PKL SMK MA</span> 
                {isSuperAdmin(currentUser) && (
                  <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider animate-pulse">Super Admin</span>
                )}
                {!isSuperAdmin(currentUser) && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-100">v1.2</span>
                )}
              </h1>
              <p className="text-xs text-slate-400 font-medium">Sistem Informasi Manajemen Praktik Kerja Lapangan</p>
            </div>
          </div>

          {/* User Nav and Profile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <nav className="flex items-center gap-1">
              {(!currentUser || isMenuAllowed('dashboard_pkl')) && (
                <button
                  onClick={() => setActiveMenu('dashboard')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeMenu === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" /> Dashboard PKL
                </button>
              )}
              {currentUser && isMenuAllowed('statistik_hasil') && (
                <button
                  onClick={() => setActiveMenu('stats')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeMenu === 'stats' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" /> Statistik & Hasil
                </button>
              )}
              {isSuperAdmin(currentUser) && (
                <button
                  onClick={() => setActiveMenu('supabase')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeMenu === 'supabase' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Database className="w-4 h-4" /> Setup Supabase
                </button>
              )}
            </nav>

            {currentUser && (
              <>
                <div className="h-6 w-[1px] bg-slate-100 hidden md:block"></div>
                <div className="flex items-center gap-3">
                  <div className="text-right leading-none">
                    <span className="text-xs font-bold text-slate-800 block">{currentUser.nama}</span>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block mt-0.5">{currentUser.role}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all border-none cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Keluar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT FRAME */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* TAB SWITCHER */}
        {activeMenu === 'supabase' ? (
          <SupabaseConfig onConfigChanged={handleConfigChanged} />
        ) : !currentUser ? (
          <Login users={users} onLoginSuccess={(u) => handleUserSessionSwitch(u.id)} />
        ) : activeMenu === 'stats' ? (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
              <h2 className="text-base font-bold text-slate-800">Laporan Visual & Analitik SIM PKL</h2>
              <p className="text-xs text-slate-500 mt-0.5">Grafik real-time distribusi siswa, tingkat kehadiran, dan capaian kompetensi bimbingan.</p>
            </div>
            <StatsDashboard 
              users={users} 
              instansiList={instansiList} 
              evaluations={evaluations} 
              attendanceLogs={attendanceLogs} 
            />
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* RENDER ACTIVE USER MODULE DASHBOARD */}
            {currentUser.role === 'siswa' && (
              <StudentDashboard 
                student={currentUser} 
                instansiList={instansiList} 
                announcements={announcements} 
              />
            )}
            {currentUser.role === 'guru' && (
              <TeacherDashboard 
                teacher={currentUser} 
                instansiList={instansiList} 
              />
            )}
            {currentUser.role === 'industri' && (
              <IndustryDashboard 
                industry={currentUser} 
                instansiList={instansiList} 
              />
            )}
            {currentUser.role === 'admin' && (
              <AdminDashboard 
                admin={currentUser} 
                onRefreshGlobalData={onRefreshGlobalData} 
              />
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-medium text-slate-500">SIM PKL SMK MA &copy; {new Date().getFullYear()} &bull; Sistem Manajemen Praktik Kerja Lapangan</p>
          <p className="text-[10px] mt-1 text-slate-400">Dioptimalkan untuk Siswa, Guru Pembimbing Sekolah, dan Mitra Industri Lapangan.</p>
        </div>
      </footer>

    </div>
  );
}
