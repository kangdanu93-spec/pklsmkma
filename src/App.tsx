import { useState, useEffect } from 'react';
import { 
  Database, Activity, ShieldAlert, GraduationCap, Users, 
  HelpCircle, Settings, RefreshCw, BarChart3, LayoutDashboard, LogOut, CheckCircle, Flame
} from 'lucide-react';

// Models & Types
import { PklUser, PklInstansi, PklJournal, PklAttendance, PklPlacement, PklEvaluation, Announcement } from './types';

// DB Operations
import { 
  dbGetUsers, dbGetInstansi, dbGetPlacements, dbGetJournals, 
  dbGetAttendance, dbGetEvaluations, dbGetAnnouncements 
} from './utils/localDb';
import { isSupabaseConnected, getSupabaseConfig, getSupabaseClient } from './supabaseClient';

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

  const loadGlobalData = async () => {
    setGlobalLoading(true);
    try {
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
      setGlobalLoading(false);
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
    loadGlobalData();
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
      
      {/* GLOBAL BANNER INTEGRATION STATUS */}
      <div className="bg-slate-900 text-white text-xs px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isDbConnected ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isDbConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
          <p className="font-medium text-slate-300">
            {isDbConnected ? (
              <span>Database Cloud aktif: <strong className="text-white font-semibold">{sbDetails?.url}</strong></span>
            ) : (
              <span>Status: <strong className="text-amber-400 font-bold">Simulasi Offline (Local Storage)</strong>. Data disimpan aman di browser.</span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setActiveMenu('supabase')}
            className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 hover:underline transition-all flex items-center gap-1 bg-transparent border-none cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" /> {isDbConnected ? 'Atur Supabase' : 'Hubungkan ke Supabase'}
          </button>
        </div>
      </div>

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
                <span>SIM PKL</span> 
                <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-100">v1.2</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">Sistem Informasi Manajemen Praktik Kerja Lapangan</p>
            </div>
          </div>

          {/* User Nav and Profile */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveMenu('dashboard')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeMenu === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard PKL
              </button>
              <button
                onClick={() => setActiveMenu('stats')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeMenu === 'stats' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <BarChart3 className="w-4 h-4" /> Statistik & Hasil
              </button>
              <button
                onClick={() => setActiveMenu('supabase')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  activeMenu === 'supabase' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Database className="w-4 h-4" /> Setup Supabase
              </button>
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

      {/* QUICK LOGIN SIMULATOR ONCE LOGGED IN */}
      {currentUser && (
        <section className="bg-indigo-50 border-y border-indigo-100 px-4 sm:px-6 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-indigo-950">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-bold uppercase text-[9px] tracking-wider animate-pulse flex items-center gap-1">
                <Flame className="w-3 h-3" /> Sandbox Mode
              </span>
              <p className="font-semibold text-slate-700">
                Uji Coba Alur PKL dengan mengganti peran akun di bawah ini secara instan:
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="font-medium text-slate-500">Pilih Akun:</span>
              <select
                value={currentUser.id}
                onChange={(e) => handleUserSessionSwitch(e.target.value)}
                className="px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <optgroup label="Siswa (Dapat Isi Jurnal & Absensi)">
                  {users.filter(u => u.role === 'siswa').map(u => (
                    <option key={u.id} value={u.id}>Siswa: {u.nama} ({u.id_instansi ? 'Aktif PKL' : 'Draft Penempatan'})</option>
                  ))}
                </optgroup>
                <optgroup label="Guru Pembimbing (Dapat Menilai & Verifikasi)">
                  {users.filter(u => u.role === 'guru').map(u => (
                    <option key={u.id} value={u.id}>Guru: {u.nama}</option>
                  ))}
                </optgroup>
                <optgroup label="Mitra Industri (Dapat Menyetujui Absen & Beri Nilai)">
                  {users.filter(u => u.role === 'industri').map(u => (
                    <option key={u.id} value={u.id}>Industri: {u.nama}</option>
                  ))}
                </optgroup>
                <optgroup label="Admin (Plotting Guru, Kelola Instansi, Rekap Nilai)">
                  {users.filter(u => u.role === 'admin').map(u => (
                    <option key={u.id} value={u.id}>Admin: {u.nama}</option>
                  ))}
                </optgroup>
              </select>
              
              <button
                onClick={loadGlobalData}
                title="Refresh Data dari Database"
                className="p-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-100 text-indigo-700 transition-all flex items-center justify-center shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* MAIN LAYOUT FRAME */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* FALLBACK WARNING NOTIFICATION */}
        {isDbConnected && isUsingLocalStorageFallback && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm animate-fade-in">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-xl mt-0.5 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 leading-none flex items-center gap-1.5">
                  Mode Cadangan Aktif: Menggunakan Local Storage
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                  Aplikasi terhubung ke Supabase, namun gagal melakukan sinkronisasi data karena tabel database belum dibuat atau RLS (Row Level Security) aktif tanpa Policy. Seluruh perubahan akan disimpan secara lokal di browser Anda.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveMenu('supabase')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0 whitespace-nowrap self-start md:self-center"
            >
              Lihat Panduan SQL & Setup
            </button>
          </div>
        )}

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
          <p className="font-medium text-slate-500">SIM PKL &copy; {new Date().getFullYear()} &bull; Sistem Manajemen Praktik Kerja Lapangan Terintegrasi Supabase</p>
          <p className="text-[10px] mt-1 text-slate-400">Dioptimalkan untuk Siswa, Guru Pembimbing Sekolah, dan Mitra Industri Lapangan.</p>
        </div>
      </footer>

    </div>
  );
}
