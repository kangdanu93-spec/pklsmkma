import { useState, useEffect, useRef } from 'react';
import { 
  Database, Activity, ShieldAlert, GraduationCap, Users, 
  HelpCircle, Settings, RefreshCw, BarChart3, LayoutDashboard, LogOut, CheckCircle, Flame
} from 'lucide-react';

// Models & Types
import { PklUser, PklInstansi, PklJournal, PklAttendance, PklPlacement, PklEvaluation, Announcement, MenuAccess } from './types';

// DB Operations
import { 
  dbGetUsers, dbGetInstansi, dbGetPlacements, dbGetJournals, 
  dbGetAttendance, dbGetEvaluations, dbGetAnnouncements, dbGetMenuAccess, isSuperAdmin, localDb
} from './utils/localDb';
import { isSupabaseConnected, getSupabaseConfig, getSupabaseClient, syncSupabaseConfigFromServer } from './supabaseClient';

// Dashboards & Login
import { Login } from './components/Login';
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
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'stats'>('dashboard');
  const [currentUser, setCurrentUser] = useState<PklUser | null>(() => {
    try {
      const savedSession = localStorage.getItem('SIM_PKL_ACTIVE_SESSION');
      const lastActivity = Number(localStorage.getItem('SIM_PKL_LAST_ACTIVITY') || '0');
      const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 mins
      if (savedSession && lastActivity > 0 && (Date.now() - lastActivity < INACTIVITY_LIMIT)) {
        return JSON.parse(savedSession);
      }
    } catch {
      // Ignore parse error
    }
    return null;
  });
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [isDbConnected, setIsDbConnected] = useState(false);
  const [sbDetails, setSbDetails] = useState<{ url: string } | null>(null);
  const [isUsingLocalStorageFallback, setIsUsingLocalStorageFallback] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Inactivity auto-logout tracking (15 minutes threshold)
  const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

  // Track user activity (mousemove, keydown, click, scroll, touch) throttled to 5s
  useEffect(() => {
    let lastUpdate = 0;
    const updateActivity = () => {
      const now = Date.now();
      if (now - lastUpdate > 5000) {
        lastUpdate = now;
        localStorage.setItem('SIM_PKL_LAST_ACTIVITY', now.toString());
      }
    };

    // Initialize activity timestamp if missing
    if (!localStorage.getItem('SIM_PKL_LAST_ACTIVITY')) {
      localStorage.setItem('SIM_PKL_LAST_ACTIVITY', Date.now().toString());
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach(evt => window.addEventListener(evt, updateActivity, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, updateActivity));
    };
  }, []);

  // Interval check for inactivity timeout (runs every 5 seconds)
  useEffect(() => {
    const checkInactivity = () => {
      if (!currentUser) return;

      const lastActivityStr = localStorage.getItem('SIM_PKL_LAST_ACTIVITY');
      const lastActivity = lastActivityStr ? Number(lastActivityStr) : Date.now();
      const inactiveDuration = Date.now() - lastActivity;

      if (inactiveDuration >= INACTIVITY_TIMEOUT_MS) {
        console.warn('Auto logout triggered due to 15 minutes of inactivity.');
        handleLogout();
        setSessionExpiredNotice(true);
      }
    };

    const interval = setInterval(checkInactivity, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Load everything on start
  useEffect(() => {
    loadGlobalData();
  }, []);

  // Sync / update currentUser profile when the global users list is updated from other sessions
  useEffect(() => {
    if (currentUser) {
      const updated = users.find(u => u.id === currentUser.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(currentUser)) {
        setCurrentUser(updated);
      }
    }
  }, [users, currentUser]);

  // Robust Real-Time sync via Supabase Realtime Channel Postgres Changes subscription
  useEffect(() => {
    let subscription: any = null;

    const setupRealtime = async () => {
      const sb = getSupabaseClient();
      if (sb) {
        subscription = sb.channel('public-db-changes')
          .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
            console.log('SIM PKL Realtime DB change event detected:', payload);
            loadGlobalData(true);
          })
          .subscribe();
      }
    };

    setupRealtime();

    return () => {
      if (subscription) {
        const sb = getSupabaseClient();
        if (sb) {
          sb.removeChannel(subscription);
        }
      }
    };
  }, [isDbConnected]);

  // Robust fallback polling interval (runs every 20 seconds) for cross-browser synchronization
  const loadGlobalDataRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  useEffect(() => {
    loadGlobalDataRef.current = loadGlobalData;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      // Only poll when window is visible AND a user is actively logged in
      // This prevents continuous heavy DB queries on the login screen
      if (document.visibilityState === 'visible' && currentUser && loadGlobalDataRef.current) {
        loadGlobalDataRef.current(true);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [currentUser]);

  async function loadGlobalData(silent = false) {
    if (!silent) setGlobalLoading(true);

    // Safety fallback timer: guarantee setGlobalLoading(false) executes within 3 seconds
    const safetyTimer = setTimeout(() => {
      if (!silent) setGlobalLoading(false);
    }, 3000);

    try {
      // Sync Supabase credentials from full-stack server (with max 1.5s timeout)
      await Promise.race([
        syncSupabaseConfigFromServer(),
        new Promise(res => setTimeout(res, 1500))
      ]);

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

      // 2. Fetch all collections concurrently with 2.5s maximum timeout
      const fetchPromise = Promise.all([
        dbGetUsers().catch(() => ({ data: [], fromSupabase: false })),
        dbGetInstansi().catch(() => ({ data: [], fromSupabase: false })),
        dbGetPlacements().catch(() => ({ data: [], fromSupabase: false })),
        dbGetJournals().catch(() => ({ data: [], fromSupabase: false })),
        dbGetAttendance().catch(() => ({ data: [], fromSupabase: false })),
        dbGetEvaluations().catch(() => ({ data: [], fromSupabase: false })),
        dbGetAnnouncements().catch(() => ({ data: [], fromSupabase: false }))
      ]);

      const fetchTimeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 2500)
      );

      const fetchResult = await Promise.race([fetchPromise, fetchTimeoutPromise]);

      let resUsers = { data: localDb.get<PklUser>('SIM_PKL_USERS'), fromSupabase: false };
      let resInst = { data: localDb.get<PklInstansi>('SIM_PKL_INSTANSI'), fromSupabase: false };
      let resPlace = { data: localDb.get<PklPlacement>('SIM_PKL_PLACEMENTS'), fromSupabase: false };
      let resJour = { data: localDb.get<PklJournal>('SIM_PKL_JOURNALS'), fromSupabase: false };
      let resAtt = { data: localDb.get<PklAttendance>('SIM_PKL_ATTENDANCE'), fromSupabase: false };
      let resEvals = { data: localDb.get<PklEvaluation>('SIM_PKL_EVALUATIONS'), fromSupabase: false };
      let resAnns = { data: localDb.get<Announcement>('SIM_PKL_ANNOUNCEMENTS'), fromSupabase: false };

      if (Array.isArray(fetchResult)) {
        [resUsers, resInst, resPlace, resJour, resAtt, resEvals, resAnns] = fetchResult;
      }

      setUsers(resUsers.data || []);
      setInstansiList(resInst.data || []);
      setPlacements(resPlace.data || []);
      setJournals(resJour.data || []);
      setAttendanceLogs(resAtt.data || []);
      setEvaluations(resEvals.data || []);
      setAnnouncements(resAnns.data || []);

      // Keep current logged-in user profile updated with the latest DB records in real-time
      if (currentUser && resUsers.data) {
        const freshUser = resUsers.data.find(u => u.id === currentUser.id);
        if (freshUser && JSON.stringify(freshUser) !== JSON.stringify(currentUser)) {
          setCurrentUser(freshUser);
          localStorage.setItem('SIM_PKL_ACTIVE_SESSION', JSON.stringify(freshUser));
        }
      }

      if (connected && !resUsers.fromSupabase) {
        setIsUsingLocalStorageFallback(true);
      } else {
        setIsUsingLocalStorageFallback(false);
      }

      // 3. Restore session if stored in localStorage or Supabase Auth
      let sessionUserFound = false;

      if (connected) {
        const sb = getSupabaseClient();
        if (sb) {
          const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => 
            setTimeout(() => resolve({ data: { session: null } }), 1000)
          );
          const { data: { session } } = (await Promise.race([
            sb.auth.getSession(),
            timeoutPromise
          ])) as any;

          if (session?.user?.email) {
            const found = (resUsers.data || []).find(u => u && u.email && u.email.toLowerCase() === session.user.email!.toLowerCase());
            if (found) {
              setCurrentUser(found);
              localStorage.setItem('SIM_PKL_LOGGED_IN_USER_ID', found.id);
              localStorage.setItem('SIM_PKL_ACTIVE_SESSION', JSON.stringify(found));
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
            localStorage.setItem('SIM_PKL_ACTIVE_SESSION', JSON.stringify(found));
          }
        }
      }

      // Signal all dashboards to refetch their internal states
      setRefreshCounter(prev => prev + 1);
    } catch (error) {
      console.error('Gagal memuat data SIM PKL:', error);
    } finally {
      clearTimeout(safetyTimer);
      if (!silent) setGlobalLoading(false);
    }
  };

  const handleUserSessionSwitch = (userId: string) => {
    const selected = users.find(u => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
      localStorage.setItem('SIM_PKL_LOGGED_IN_USER_ID', selected.id);
      localStorage.setItem('SIM_PKL_ACTIVE_SESSION', JSON.stringify(selected));
      localStorage.setItem('SIM_PKL_LAST_ACTIVITY', Date.now().toString());
      setSessionExpiredNotice(false);
    } else {
      setCurrentUser(null);
      localStorage.removeItem('SIM_PKL_LOGGED_IN_USER_ID');
      localStorage.removeItem('SIM_PKL_ACTIVE_SESSION');
    }
  };

  const handleLogout = async () => {
    const sb = getSupabaseClient();
    if (sb) {
      await sb.auth.signOut().catch(() => {});
    }
    setCurrentUser(null);
    localStorage.removeItem('SIM_PKL_LOGGED_IN_USER_ID');
    localStorage.removeItem('SIM_PKL_ACTIVE_SESSION');
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
                {currentUser?.role === 'admin' && !isSuperAdmin(currentUser) && (
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200 uppercase tracking-wider">Panitia PKL (Monitoring Only)</span>
                )}
                {currentUser?.role !== 'admin' && !isSuperAdmin(currentUser) && (
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
              {currentUser && currentUser.role !== 'siswa' && currentUser.role !== 'guru' && isMenuAllowed('statistik_hasil') && (
                <button
                  onClick={() => setActiveMenu('stats')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeMenu === 'stats' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" /> Statistik & Hasil
                </button>
              )}
            </nav>

            {currentUser && (
              <>
                <div className="h-6 w-[1px] bg-slate-100 hidden md:block"></div>
                <div className="flex items-center gap-3">
                  <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold" title="Sesi terproteksi. Otomatis logout jika tidak ada aktivitas selama 15 menit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sesi Aktif (Auto Logout 15m)</span>
                  </div>
                  <div className="text-right leading-none">
                    <span className="text-xs font-bold text-slate-800 block">{currentUser.nama}</span>
                    <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block mt-0.5">
                      {isSuperAdmin(currentUser) ? 'Super Admin' : currentUser.email === 'panitia@simpkl.com' ? 'Panitia PKL' : currentUser.role}
                    </span>
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
        {!currentUser ? (
          <Login 
            users={users} 
            onLoginSuccess={(u) => handleUserSessionSwitch(u.id)}
            isDbConnected={isDbConnected}
            isUsingLocalStorageFallback={isUsingLocalStorageFallback}
            sbDetails={sbDetails}
            sessionExpiredNotice={sessionExpiredNotice}
            onDismissSessionNotice={() => setSessionExpiredNotice(false)}
          />
        ) : (activeMenu === 'stats' && currentUser?.role !== 'siswa' && currentUser?.role !== 'guru') ? (
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
                refreshCounter={refreshCounter}
              />
            )}
            {currentUser.role === 'guru' && (
              <TeacherDashboard 
                teacher={currentUser} 
                instansiList={instansiList} 
                refreshCounter={refreshCounter}
              />
            )}
            {currentUser.role === 'industri' && (
              <IndustryDashboard 
                industry={currentUser} 
                instansiList={instansiList} 
                refreshCounter={refreshCounter}
              />
            )}
            {currentUser.role === 'admin' && (
              <AdminDashboard 
                admin={currentUser} 
                onRefreshGlobalData={onRefreshGlobalData} 
                refreshCounter={refreshCounter}
              />
            )}

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-100 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-400">
            SIM PKL SMK MA &copy; 2026 &bull; by <a href="https://tutordigital.id" target="_blank" rel="noreferrer" className="text-indigo-500 font-bold hover:underline">tutordigital.id</a>
          </p>
          <p className="text-slate-500 font-medium text-xs">Sistem Manajemen Praktik Kerja Lapangan</p>
        </div>
      </footer>

    </div>
  );
}
