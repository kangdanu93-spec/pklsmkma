import React, { useState, useEffect } from 'react';
import { Calendar, Clock, BookOpen, Send, CheckCircle, AlertCircle, RefreshCw, Star, Info, FileText, CheckCircle2, XCircle, MapPin, Navigation, Compass, Globe } from 'lucide-react';
import { PklUser, PklInstansi, PklJournal, PklAttendance, PklPlacement, PklEvaluation, Announcement, MenuAccess } from '../types';
import { dbGetJournals, dbSaveJournal, dbGetAttendance, dbSaveAttendance, dbGetPlacements, dbSavePlacement, dbGetInstansi, dbGetEvaluations, dbGetMenuAccess, dbGetUsers } from '../utils/localDb';

interface StudentDashboardProps {
  student: PklUser;
  instansiList: PklInstansi[];
  announcements: Announcement[];
  refreshCounter?: number;
}

export default function StudentDashboard({ student, instansiList, announcements, refreshCounter }: StudentDashboardProps) {
  // Menu permissions
  const [menuAccessList, setMenuAccessList] = useState<MenuAccess[]>([]);

  useEffect(() => {
    setMenuAccessList(dbGetMenuAccess());
  }, []);

  const isFeatureAllowed = (id: string): boolean => {
    const menu = menuAccessList.find(m => m.id === id);
    if (!menu) return true;
    return menu.allowed_roles.includes('siswa');
  };

  // Data states
  const [users, setUsers] = useState<PklUser[]>([]);
  const [journals, setJournals] = useState<PklJournal[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<PklAttendance[]>([]);
  const [placement, setPlacement] = useState<PklPlacement | null>(null);
  const [evaluation, setEvaluation] = useState<PklEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  const activeStudent = users.find(u => u.id === student.id) || student;
  const isApproved = (placement?.status === 'disetujui') || !!activeStudent.id_instansi;

  // Forms states
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [journalKegiatan, setJournalKegiatan] = useState('');
  const [journalRingkasan, setJournalRingkasan] = useState('');
  const [journalSuccess, setJournalSuccess] = useState('');

  const [attStatus, setAttStatus] = useState<'hadir' | 'sakit' | 'izin'>('hadir');
  const [attKeterangan, setAttKeterangan] = useState('');
  const [attSuccess, setAttSuccess] = useState('');

  // Live Clock & GPS Geolocation States
  const [liveDateTime, setLiveDateTime] = useState<Date>(new Date());
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [applyInstansiId, setApplyInstansiId] = useState('');
  const [applyStart, setApplyStart] = useState('2026-07-01');
  const [applyEnd, setApplyEnd] = useState('2026-10-01');
  const [applySuccess, setApplySuccess] = useState('');

  useEffect(() => {
    fetchStudentData(refreshCounter !== undefined && refreshCounter > 0);
  }, [student.id, student.id_instansi, student.id_pembimbing, refreshCounter]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getCoordinates = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation tidak didukung oleh browser Anda.');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        let errorMsg = 'Gagal mendapatkan lokasi GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Akses lokasi ditolak. Silakan aktifkan izin GPS pada browser.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Informasi lokasi tidak tersedia.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Waktu permintaan lokasi habis.';
        }
        setLocationError(errorMsg);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    getCoordinates();
  }, []);

  const fetchStudentData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Users
      const resUsers = await dbGetUsers();
      setUsers(resUsers.data || []);

      // Journals
      const resJour = await dbGetJournals();
      setJournals(resJour.data.filter(j => j.id_siswa === student.id));

      // Attendance
      const resAtt = await dbGetAttendance();
      setAttendanceLogs(resAtt.data.filter(a => a.id_siswa === student.id));

      // Placement
      const resPlace = await dbGetPlacements();
      const myPlace = resPlace.data.find(p => p.id_siswa === student.id);
      setPlacement(myPlace || null);
      if (myPlace) {
        setApplyInstansiId(myPlace.id_instansi);
        setApplyStart(myPlace.tanggal_mulai);
        setApplyEnd(myPlace.tanggal_selesai);
      } else if (instansiList.length > 0) {
        setApplyInstansiId(instansiList[0].id);
      }

      // Evaluation
      const resEval = await dbGetEvaluations();
      const myEval = resEval.data.find(e => e.id_siswa === student.id);
      setEvaluation(myEval || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApproved) {
      alert('Anda belum memiliki tempat PKL yang disetujui untuk menulis jurnal.');
      return;
    }
    if (!journalKegiatan.trim() || !journalRingkasan.trim()) {
      alert('Silakan isi seluruh bidang jurnal!');
      return;
    }

    const newJournal: PklJournal = {
      id: `jour-${Date.now()}`,
      id_siswa: student.id,
      tanggal: journalDate,
      kegiatan: journalKegiatan,
      ringkasan_belajar: journalRingkasan,
      status: 'pending'
    };

    const res = await dbSaveJournal(newJournal);
    if (res.success) {
      setJournalSuccess('Jurnal harian berhasil diajukan!');
      setJournalKegiatan('');
      setJournalRingkasan('');
      fetchStudentData();
      setTimeout(() => setJournalSuccess(''), 4000);
    }
  };

  const handleAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApproved) {
      alert('Anda belum memiliki tempat PKL yang disetujui untuk melakukan presensi.');
      return;
    }

    // Capture precise current submission time and date
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentTimeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    
    // Check if clocked in today
    const existingLog = attendanceLogs.find(a => a.tanggal === todayStr);

    if (existingLog) {
      if (existingLog.jam_keluar) {
        alert('Anda sudah melakukan absen masuk dan pulang hari ini.');
        return;
      }
      
      // Clock out
      const updatedLog: PklAttendance = {
        ...existingLog,
        jam_keluar: currentTimeStr,
        latitude_keluar: latitude || undefined,
        longitude_keluar: longitude || undefined,
      };

      const res = await dbSaveAttendance(updatedLog);
      if (res.success) {
        setAttSuccess('Absen pulang berhasil dicatat!');
        fetchStudentData();
        setTimeout(() => setAttSuccess(''), 4000);
      }
    } else {
      // Clock in
      const newLog: PklAttendance = {
        id: `att-${Date.now()}`,
        id_siswa: student.id,
        tanggal: todayStr,
        jam_masuk: currentTimeStr,
        status: attStatus,
        keterangan: attKeterangan,
        status_verifikasi: 'pending',
        latitude: latitude || undefined,
        longitude: longitude || undefined,
      };

      const res = await dbSaveAttendance(newLog);
      if (res.success) {
        setAttSuccess('Absen masuk berhasil dicatat!');
        setAttKeterangan('');
        fetchStudentData();
        setTimeout(() => setAttSuccess(''), 4000);
      }
    }
  };

  // Helper values
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendanceLogs.find(a => a.tanggal === todayStr);
  const myCompany = instansiList.find(i => i.id === activeStudent.id_instansi);

  // Stats calculation
  const totalHadir = attendanceLogs.filter(a => a.status === 'hadir' && a.status_verifikasi === 'disetujui').length;
  const totalSakit = attendanceLogs.filter(a => a.status === 'sakit' && a.status_verifikasi === 'disetujui').length;
  const totalIzin = attendanceLogs.filter(a => a.status === 'izin' && a.status_verifikasi === 'disetujui').length;
  const totalPendingAtt = attendanceLogs.filter(a => a.status_verifikasi === 'pending').length;
  const totalJurnalVerified = journals.filter(j => j.status === 'diverifikasi').length;

  // Grade summary
  const averageGrade = evaluation ? (
    (evaluation.nilai_industri_teknis + 
     evaluation.nilai_industri_nonteknis + 
     evaluation.nilai_industri_disiplin + 
     evaluation.nilai_sekolah_laporan + 
     evaluation.nilai_sekolah_presentasi) / 5
  ).toFixed(1) : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm">Memuat data PKL Siswa...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="student-dashboard">
      {/* 1. HEADER RINGKASAN SISWA & STATUS PENEMPATAN */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 bg-gradient-to-r from-indigo-900 to-indigo-950 rounded-2xl p-6 text-white flex flex-col justify-between shadow-sm">
          <div>
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
              Siswa PKL
            </span>
            <h2 className="text-2xl font-bold mt-3 text-white">Selamat Datang, {activeStudent.nama}!</h2>
            <p className="text-sm text-indigo-200/80 mt-1">NISN: {activeStudent.nomor_induk} | Email: {activeStudent.email}</p>
          </div>
          
          <div className="mt-6 pt-5 border-t border-indigo-800 flex flex-wrap gap-x-8 gap-y-3 text-sm text-indigo-200/90">
            <div>
              <span className="text-indigo-400 text-xs block uppercase font-semibold">Tempat PKL saat ini:</span>
              <span className="font-medium text-white">{myCompany?.nama_instansi || 'Belum Terdaftar'}</span>
            </div>
            <div>
              <span className="text-indigo-400 text-xs block uppercase font-semibold">Guru Pembimbing:</span>
              <span className="font-medium text-white">
                {activeStudent.id_pembimbing ? (users.find(u => u.id === activeStudent.id_pembimbing)?.nama || 'Terplot') : 'Belum Terplotting'}
              </span>
            </div>
            <div>
              <span className="text-indigo-400 text-xs block uppercase font-semibold">Status Penempatan:</span>
              <span className={`inline-flex items-center gap-1 font-semibold text-xs rounded px-2 py-0.5 mt-0.5 ${
                isApproved ? 'bg-emerald-500/20 text-emerald-300' :
                placement?.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                'bg-rose-500/20 text-rose-300'
              }`}>
                {isApproved ? 'AKTIF PKL' :
                 placement?.status === 'pending' ? 'MENUNGGU ACC' : 'TIDAK AKTIF / BELUM MENGAJUKAN'}
              </span>
            </div>
          </div>
        </div>

        {/* STATS MINI CARD */}
        <div className="md:col-span-4 grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col justify-between shadow-sm">
            <span className="text-slate-400 text-xs font-semibold uppercase">Presensi (Hadir)</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-slate-800">{totalHadir}</span>
              <span className="text-xs text-slate-500">hari</span>
            </div>
            {totalPendingAtt > 0 && <span className="text-[10px] text-amber-600 mt-1">{totalPendingAtt} absensi pending</span>}
          </div>
          
          <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col justify-between shadow-sm">
            <span className="text-slate-400 text-xs font-semibold uppercase">Jurnal Disetujui</span>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold text-slate-800">{totalJurnalVerified}</span>
              <span className="text-xs text-slate-500">/ {journals.length}</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">total jurnal diajukan</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col justify-between shadow-sm col-span-2">
            <span className="text-slate-400 text-xs font-semibold uppercase">Rata-rata Nilai</span>
            <div className="flex items-center justify-between mt-2">
              {averageGrade ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-indigo-600">{averageGrade}</span>
                    <span className="text-xs text-slate-500">/ 100</span>
                  </div>
                  <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    <Star className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" /> Selesai PKL
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-500 italic mt-1">Nilai akhir belum diinput</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: PRESENSI, JURNAL, DAN PENGAJUAN */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* 2. MENU PRESENSI HARIAN */}
          {isFeatureAllowed('siswa_presensi') && isApproved && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="attendance-section">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600 animate-pulse" /> Presensi PKL Real-Time & GPS Map
                </h3>
                
                {/* LIVE TICKING DIGITAL CLOCK */}
                <div className="flex items-center gap-2 bg-indigo-50/60 px-3.5 py-1.5 rounded-xl border border-indigo-100/40 text-xs font-bold text-indigo-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>LIVE CLOCK:</span>
                  <span className="font-mono text-sm tracking-wide">
                    {liveDateTime.toLocaleTimeString('id-ID', { hour12: false })} WIB
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* LEFT INNER PANEL: LIVE DATE, TIME & DETAILS (UN-EDITABLE) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Validasi Waktu Presensi</span>
                    
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">Tanggal Hari Ini (Live)</label>
                        <div className="w-full px-3 py-2.5 rounded-lg border border-slate-200/60 bg-slate-100/80 text-slate-700 font-bold select-none">
                          {liveDateTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                      </div>

                      <div>
                        <label className="text-slate-400 font-semibold block mb-1">Jam Live (Tidak Bisa Diedit)</label>
                        <div className="w-full px-3 py-2.5 rounded-lg border border-slate-200/60 bg-slate-100/80 text-slate-700 font-mono font-bold tracking-wide select-none">
                          {liveDateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/50 space-y-1.5 text-xs">
                      <p className="flex items-center justify-between text-slate-500">
                        <span>Status Hari Ini:</span>
                        <strong className={`font-semibold ${todayAttendance ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {todayAttendance ? 'Sudah Absen Masuk' : 'Belum Absen'}
                        </strong>
                      </p>
                      <p className="flex items-center justify-between text-slate-500">
                        <span>Jam Masuk Tercatat:</span>
                        <strong className="text-slate-700">{todayAttendance?.jam_masuk || '--:--'}</strong>
                      </p>
                      <p className="flex items-center justify-between text-slate-500">
                        <span>Jam Pulang Tercatat:</span>
                        <strong className="text-slate-700">{todayAttendance?.jam_keluar || '--:--'}</strong>
                      </p>
                      
                      {todayAttendance && (
                        <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center">
                          <span className="text-slate-400">Verifikasi Industri:</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            todayAttendance.status_verifikasi === 'disetujui' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            todayAttendance.status_verifikasi === 'ditolak' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {todayAttendance.status_verifikasi}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COORD INFORMATION CARD */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Deteksi Titik Geolocation GPS</span>
                      <button 
                        type="button"
                        onClick={getCoordinates}
                        disabled={isLocating}
                        className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 hover:underline disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} /> Refresh GPS
                      </button>
                    </div>

                    {latitude && longitude ? (
                      <div className="space-y-2 text-xs">
                        <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-100 flex items-center gap-2">
                          <Compass className="w-4 h-4 text-emerald-600 animate-spin-slow shrink-0" />
                          <div>
                            <p className="font-bold">GPS Terkunci Aktif</p>
                            <p className="text-[10px] text-emerald-700/80">Lokasi Anda aman & terlacak di satelit.</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-white p-2 rounded-lg border border-slate-150">
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans">LATITUDE</span>
                            <span className="font-bold text-slate-700">{latitude.toFixed(6)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 block font-sans">LONGITUDE</span>
                            <span className="font-bold text-slate-700">{longitude.toFixed(6)}</span>
                          </div>
                        </div>
                        <a 
                          href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 flex items-center justify-center gap-1 transition-all"
                        >
                          <Globe className="w-3.5 h-3.5 text-indigo-600" /> Buka di Google Maps
                        </a>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {locationError ? (
                          <div className="bg-rose-50 text-rose-800 p-2.5 rounded-lg border border-rose-100 text-xs">
                            <p className="font-semibold">GPS Error:</p>
                            <p className="text-[10px] text-rose-700/90 leading-tight mt-0.5">{locationError}</p>
                          </div>
                        ) : (
                          <div className="bg-amber-50 text-amber-800 p-2.5 rounded-lg border border-amber-100 text-xs flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                            <div>
                              <p className="font-bold">Mendeteksi Lokasi GPS...</p>
                              <p className="text-[9px] text-amber-700/80">Izinkan akses lokasi di browser.</p>
                            </div>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={getCoordinates}
                          className="w-full py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-semibold hover:bg-indigo-700 transition-all flex items-center justify-center gap-1"
                        >
                          <MapPin className="w-3.5 h-3.5" /> Dapatkan Titik Lokasi GPS
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT INNER PANEL: INTERACTIVE GOOGLE MAPS & ATTENDANCE ACTION */}
                <div className="lg:col-span-7 space-y-4">
                  {/* GOOGLE MAPS REAL-TIME EMBED PREVIEW */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Visualisasi Peta Presensi</span>
                    
                    {latitude && longitude ? (
                      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-200">
                        <iframe 
                          src={`https://maps.google.com/maps?q=${latitude},${longitude}&z=16&output=embed`} 
                          className="w-full h-48 sm:h-52" 
                          allowFullScreen={false} 
                          loading="lazy"
                          title="Presensi Geolocation Map"
                        ></iframe>
                        <div className="absolute top-2 left-2 bg-slate-900/90 text-white font-mono text-[9px] py-1 px-2 rounded backdrop-blur shadow">
                          LAT: {latitude.toFixed(5)} | LNG: {longitude.toFixed(5)}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-48 sm:h-52 bg-slate-100 border border-slate-200 border-dashed rounded-lg flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                        <MapPin className="w-8 h-8 text-slate-300 mb-2 animate-bounce" />
                        <p className="text-xs font-semibold">Peta tidak dapat ditampilkan</p>
                        <p className="text-[10px] text-slate-400/80 mt-0.5">Silakan aktifkan dan izinkan koordinat GPS Anda untuk melacak posisi presensi secara valid.</p>
                      </div>
                    )}
                  </div>

                  {/* FORM ACTION FOR IN/OUT CLOCK */}
                  <div className="p-1 bg-white rounded-xl">
                    {todayAttendance && todayAttendance.jam_keluar ? (
                      <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 text-xs flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-sm">Presensi Selesai!</p>
                          <p className="leading-relaxed mt-0.5">Anda sudah menuntaskan kewajiban presensi masuk dan pulang hari ini dengan valid.</p>
                          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-emerald-200/50 font-mono text-[10px]">
                            <div>
                              <span className="text-emerald-600 font-sans block uppercase font-semibold text-[9px]">JAM MASUK</span>
                              <span className="font-bold">{todayAttendance.jam_masuk}</span>
                              {todayAttendance.latitude && (
                                <span className="block text-[8px] text-emerald-600/80">LAT: {todayAttendance.latitude.toFixed(4)}</span>
                              )}
                            </div>
                            <div>
                              <span className="text-emerald-600 font-sans block uppercase font-semibold text-[9px]">JAM PULANG</span>
                              <span className="font-bold">{todayAttendance.jam_keluar}</span>
                              {todayAttendance.latitude_keluar && (
                                <span className="block text-[8px] text-emerald-600/80">LAT: {todayAttendance.latitude_keluar.toFixed(4)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleAttendance} className="space-y-3.5">
                        {!todayAttendance ? (
                          <>
                            <div>
                              <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pilih Status Kehadiran</span>
                              <div className="flex gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                {['hadir', 'sakit', 'izin'].map((st) => (
                                  <label key={st} className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs text-slate-700 font-bold capitalize cursor-pointer border border-transparent hover:bg-white hover:shadow-sm transition-all">
                                    <input
                                      type="radio"
                                      name="attStatus"
                                      checked={attStatus === st}
                                      onChange={() => setAttStatus(st as any)}
                                      className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                    />
                                    {st}
                                  </label>
                                ))}
                              </div>
                            </div>

                            {attStatus !== 'hadir' && (
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Alasan Sakit / Izin</label>
                                <input
                                  type="text"
                                  required
                                  value={attKeterangan}
                                  onChange={(e) => setAttKeterangan(e.target.value)}
                                  placeholder="Tulis alasan sakit/izin secara jelas..."
                                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white"
                                />
                              </div>
                            )}

                            {locationError && (
                              <div className="p-2.5 bg-amber-50 text-amber-800 rounded-lg border border-amber-200 text-[10px] leading-relaxed">
                                <strong>Pemberitahuan Geolocation:</strong> Anda akan melakukan presensi tanpa koordinat GPS terdeteksi. Disarankan untuk membagikan lokasi agar presensi Anda valid.
                              </div>
                            )}

                            <button
                              type="submit"
                              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
                            >
                              <Navigation className="w-4 h-4 shrink-0" /> Kirim Absen Masuk (Clock-In)
                            </button>
                          </>
                        ) : (
                          <div className="space-y-3">
                            <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-100/80 text-xs">
                              <p className="font-bold text-amber-800 flex items-center gap-1"><Info className="w-4 h-4 text-amber-600" /> Presensi Masuk Berhasil!</p>
                              <p className="text-slate-600 leading-relaxed mt-1">Anda tercatat melakukan absen masuk pada jam <strong>{todayAttendance.jam_masuk}</strong> hari ini. Jangan lupa untuk melakukan absen pulang saat jam kerja berakhir.</p>
                            </div>

                            <button
                              type="submit"
                              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
                            >
                              <Navigation className="w-4 h-4 shrink-0 rotate-180" /> Kirim Absen Pulang (Clock-Out)
                            </button>
                          </div>
                        )}

                        {attSuccess && (
                          <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100 text-center font-bold text-xs animate-pulse">
                            {attSuccess}
                          </div>
                        )}
                      </form>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 3. INPUT JURNAL HARIAN */}
          {/* 3. MENU PENGISIAN JURNAL */}
          {isFeatureAllowed('siswa_jurnal') && isApproved && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="journal-input-section">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-indigo-600" /> Tulis Jurnal Kegiatan PKL
              </h3>
              
              <form onSubmit={handleAddJournal} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tanggal Kegiatan</label>
                    <input
                      type="date"
                      required
                      value={journalDate}
                      onChange={(e) => setJournalDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none bg-white"
                    />
                  </div>
                  <div className="flex items-end text-xs text-slate-500 pb-2">
                    <p className="flex items-center gap-1"><Info className="w-3.5 h-3.5 text-indigo-500" /> Isi kegiatan Anda secara spesifik dan rangkum pembelajarannya.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Kegiatan / Aktivitas Utama</label>
                  <input
                    type="text"
                    required
                    value={journalKegiatan}
                    onChange={(e) => setJournalKegiatan(e.target.value)}
                    placeholder="Contoh: Memperbaiki jaringan fiber optic, Slicing UI dashboard..."
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Ringkasan Belajar / Capaian Kompetensi</label>
                  <textarea
                    rows={3}
                    required
                    value={journalRingkasan}
                    onChange={(e) => setJournalRingkasan(e.target.value)}
                    placeholder="Rangkum apa yang Anda pelajari hari ini atau kompetensi apa saja yang dicapai..."
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none bg-white"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  {journalSuccess && <span className="text-xs text-emerald-600 font-semibold">{journalSuccess}</span>}
                  <span />
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" /> Kirim Jurnal Harian
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 4. STATUS PENEMPATAN & PLOTTING ADMIN */}
          {!isApproved && (
            <div className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 rounded-2xl border border-amber-500/20 shadow-lg p-6 space-y-4" id="apply-placement-section">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-500">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-amber-500 font-sans tracking-wide">Informasi Pemetaan (Plotting) PKL</h3>
                  <p className="text-xs text-slate-400">Prosedur penempatan industri & pembimbing siswa.</p>
                </div>
              </div>
              
              <div className="text-sm text-slate-300 leading-relaxed space-y-4">
                <p>
                  Sesuai kebijakan sekolah, seluruh proses <strong>Plotting Instansi PKL</strong> dan <strong>Guru Pembimbing</strong> dilakukan sepenuhnya secara sepihak oleh <strong>Admin / Koordinator PKL</strong> sekolah. Siswa tidak perlu mengajukan secara mandiri.
                </p>
                
                <div className="p-4 bg-slate-900/60 rounded-xl border border-amber-500/15 space-y-2.5">
                  <p className="font-bold text-xs text-amber-400 uppercase tracking-wider">Status Pemetaan Anda Saat Ini:</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                    <li className="flex flex-col gap-1 bg-[#151520] p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Instansi PKL</span>
                      <span className="font-semibold text-white">
                        {myCompany?.nama_instansi || 'Menunggu Plotting Admin'}
                      </span>
                    </li>
                    <li className="flex flex-col gap-1 bg-[#151520] p-2.5 rounded-lg border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Guru Pembimbing</span>
                      <span className="font-semibold text-white">
                        {activeStudent.id_pembimbing ? (users.find(u => u.id === activeStudent.id_pembimbing)?.nama || 'Terplot') : 'Menunggu Plotting Admin'}
                      </span>
                    </li>
                  </ul>
                </div>
                
                <p className="text-xs text-slate-400 italic">
                  *Silakan hubungi Koordinator PKL di Ruang Hubungan Industri jika memiliki pertanyaan atau kendala terkait penempatan.
                </p>
              </div>
            </div>
          )}

          {/* 5. HISTORI JURNAL KEGIATAN */}
          {isFeatureAllowed('siswa_jurnal') && isApproved && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="journals-list-section">
              <h3 className="text-base font-semibold text-slate-800 mb-4 flex items-center justify-between">
                <span>Histori Jurnal Kegiatan ({journals.length})</span>
                <span className="text-xs text-slate-400 font-normal">Diurutkan berdasarkan tanggal terbaru</span>
              </h3>

              {journals.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  Belum ada jurnal yang ditulis.
                </div>
              ) : (
                <div className="space-y-4">
                  {journals.map((j) => (
                    <div key={j.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all text-sm space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <strong className="text-slate-700">{new Date(j.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                          <h4 className="font-semibold text-slate-800 mt-0.5">{j.kegiatan}</h4>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          j.status === 'diverifikasi' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          j.status === 'revisi' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {j.status === 'diverifikasi' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : j.status === 'revisi' ? <XCircle className="w-3.5 h-3.5 text-rose-500" /> : <Clock className="w-3.5 h-3.5 text-amber-500" />}
                          {j.status === 'diverifikasi' ? 'Diverifikasi' : j.status === 'revisi' ? 'Revisi' : 'Pending'}
                        </span>
                      </div>
                      
                      <div className="text-slate-600 bg-slate-50/60 p-3 rounded-lg border border-slate-50 leading-relaxed">
                        <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Ringkasan Pembelajaran:</span>
                        {j.ringkasan_belajar}
                      </div>

                      {j.catatan_pembimbing && (
                        <div className={`p-3 rounded-lg text-xs flex gap-2 border ${
                          j.status === 'revisi' ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-indigo-50 border-indigo-100 text-indigo-800'
                        }`}>
                          <Info className="w-4 h-4 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block">{j.status === 'revisi' ? 'Catatan Revisi Pembimbing:' : 'Feedback Pembimbing:'}</span>
                            <p className="mt-0.5">{j.catatan_pembimbing}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: PENGUMUMAN DAN DETAIL NILAI AKHIR */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* 6. DETAIL NILAI PKL */}
          {isFeatureAllowed('siswa_nilai') && evaluation && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="student-evaluation-panel">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-1.5 mb-4">
                <Star className="w-5 h-5 text-indigo-600" /> Lembar Nilai Akhir PKL
              </h3>

              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                  <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Nilai Rata-rata</span>
                  <span className="text-4xl font-extrabold text-indigo-600 block mt-1">{averageGrade}</span>
                  <span className="text-[10px] text-slate-500 block mt-1.5">Skala nilai 0 - 100</span>
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Penilaian Industri ({myCompany?.pembimbing_nama})</span>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-slate-600">1. Aspek Teknis / Kerja</span>
                      <strong className="text-slate-800">{evaluation.nilai_industri_teknis}</strong>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-600">2. Soft Skill / Kerja Sama</span>
                      <strong className="text-slate-800">{evaluation.nilai_industri_nonteknis}</strong>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-600">3. Kedisiplinan & Sikap</span>
                      <strong className="text-slate-800">{evaluation.nilai_industri_disiplin}</strong>
                    </div>
                    {evaluation.catatan_industri && (
                      <p className="text-xs text-slate-500 italic mt-2 bg-slate-50 p-2 rounded">
                        &ldquo;{evaluation.catatan_industri}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="pt-1">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Penilaian Sekolah (Guru Pembimbing)</span>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-slate-600">1. Penyusunan Laporan</span>
                      <strong className="text-slate-800">{evaluation.nilai_sekolah_laporan}</strong>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-slate-600">2. Presentasi & Ujian PKL</span>
                      <strong className="text-slate-800">{evaluation.nilai_sekolah_presentasi}</strong>
                    </div>
                    {evaluation.catatan_sekolah && (
                      <p className="text-xs text-slate-500 italic mt-2 bg-slate-50 p-2 rounded">
                        &ldquo;{evaluation.catatan_sekolah}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. PENGUMUMAN PKL */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="announcements-panel">
            <h3 className="text-base font-semibold text-slate-800 flex items-center gap-1.5 mb-4">
              <Calendar className="w-5 h-5 text-indigo-600" /> Pengumuman PKL Terbaru
            </h3>

            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada pengumuman.</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div key={ann.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1.5">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-slate-800 text-[13px]">{ann.judul}</h4>
                    </div>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{ann.konten}</p>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                      <span>Oleh: {ann.author}</span>
                      <span>{new Date(ann.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 8. HISTORI PRESENSI */}
          {isFeatureAllowed('siswa_presensi') && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="attendance-history-panel">
            <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center justify-between">
              <span>Log Presensi ({attendanceLogs.length})</span>
            </h3>

            {attendanceLogs.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada catatan presensi.</p>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {attendanceLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-700 block">
                          {new Date(log.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                          {log.status === 'hadir' ? `Jam Masuk: ${log.jam_masuk} | Jam Pulang: ${log.jam_keluar || '--:--'}` : `Keterangan: ${log.keterangan || 'Sakit/Izin'}`}
                        </span>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'hadir' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-amber-50 text-amber-700 border border-amber-150'
                        }`}>
                          {log.status}
                        </span>
                        <span className={`text-[9px] font-bold uppercase ${
                          log.status_verifikasi === 'disetujui' ? 'text-emerald-600' :
                          log.status_verifikasi === 'ditolak' ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {log.status_verifikasi}
                        </span>
                      </div>
                    </div>

                    {/* Geolocation Coordinate Displays for Student Logs */}
                    {(log.latitude || log.latitude_keluar) && (
                      <div className="pt-2 border-t border-slate-200/40 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                        {log.latitude && log.longitude ? (
                          <a 
                            href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white p-1.5 rounded border border-slate-150 hover:bg-slate-50 transition-colors flex items-center gap-1 text-slate-600 font-medium"
                            title="Buka Map Koordinat Masuk"
                          >
                            <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="truncate">GPS Masuk: {log.latitude.toFixed(4)}, {log.longitude.toFixed(4)}</span>
                          </a>
                        ) : (
                          <div className="bg-slate-100/50 p-1.5 rounded text-slate-400 italic">No GPS Masuk</div>
                        )}

                        {log.latitude_keluar && log.longitude_keluar ? (
                          <a 
                            href={`https://www.google.com/maps?q=${log.latitude_keluar},${log.longitude_keluar}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white p-1.5 rounded border border-slate-150 hover:bg-slate-50 transition-colors flex items-center gap-1 text-slate-600 font-medium"
                            title="Buka Map Koordinat Pulang"
                          >
                            <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="truncate">GPS Pulang: {log.latitude_keluar.toFixed(4)}, {log.longitude_keluar.toFixed(4)}</span>
                          </a>
                        ) : (
                          <div className="bg-slate-100/50 p-1.5 rounded text-slate-400 italic">No GPS Pulang</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

        </div>
      </div>
    </div>
  );
}
