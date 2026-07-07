import React, { useState, useEffect } from 'react';
import { Calendar, Clock, BookOpen, Send, CheckCircle, AlertCircle, RefreshCw, Star, Info, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { PklUser, PklInstansi, PklJournal, PklAttendance, PklPlacement, PklEvaluation, Announcement, MenuAccess } from '../types';
import { dbGetJournals, dbSaveJournal, dbGetAttendance, dbSaveAttendance, dbGetPlacements, dbSavePlacement, dbGetInstansi, dbGetEvaluations, dbGetMenuAccess } from '../utils/localDb';

interface StudentDashboardProps {
  student: PklUser;
  instansiList: PklInstansi[];
  announcements: Announcement[];
}

export default function StudentDashboard({ student, instansiList, announcements }: StudentDashboardProps) {
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
  const [journals, setJournals] = useState<PklJournal[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<PklAttendance[]>([]);
  const [placement, setPlacement] = useState<PklPlacement | null>(null);
  const [evaluation, setEvaluation] = useState<PklEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  // Forms states
  const [journalDate, setJournalDate] = useState(new Date().toISOString().split('T')[0]);
  const [journalKegiatan, setJournalKegiatan] = useState('');
  const [journalRingkasan, setJournalRingkasan] = useState('');
  const [journalSuccess, setJournalSuccess] = useState('');

  const [attStatus, setAttStatus] = useState<'hadir' | 'sakit' | 'izin'>('hadir');
  const [attKeterangan, setAttKeterangan] = useState('');
  const [attSuccess, setAttSuccess] = useState('');

  const [applyInstansiId, setApplyInstansiId] = useState('');
  const [applyStart, setApplyStart] = useState('2026-07-01');
  const [applyEnd, setApplyEnd] = useState('2026-10-01');
  const [applySuccess, setApplySuccess] = useState('');

  useEffect(() => {
    fetchStudentData();
  }, [student.id]);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
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
    if (!placement || placement.status !== 'disetujui') {
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
    if (!placement || placement.status !== 'disetujui') {
      alert('Anda belum memiliki tempat PKL yang disetujui untuk melakukan presensi.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    
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
        jam_keluar: new Date().toTimeString().split(' ')[0].substring(0, 5),
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
        jam_masuk: new Date().toTimeString().split(' ')[0].substring(0, 5),
        status: attStatus,
        keterangan: attKeterangan,
        status_verifikasi: 'pending'
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

  const handleApplyPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyInstansiId) {
      alert('Silakan pilih instansi!');
      return;
    }

    const newPlacement: PklPlacement = {
      id: placement?.id || `place-${Date.now()}`,
      id_siswa: student.id,
      id_instansi: applyInstansiId,
      tanggal_mulai: applyStart,
      tanggal_selesai: applyEnd,
      status: 'pending',
      catatan: placement?.catatan || 'Mengajukan dari dashboard siswa.'
    };

    const res = await dbSavePlacement(newPlacement);
    if (res.success) {
      setApplySuccess('Pengajuan tempat PKL berhasil dikirim!');
      fetchStudentData();
      setTimeout(() => setApplySuccess(''), 4000);
    }
  };

  // Helper values
  const todayStr = new Date().toISOString().split('T')[0];
  const todayAttendance = attendanceLogs.find(a => a.tanggal === todayStr);
  const myCompany = instansiList.find(i => i.id === student.id_instansi);

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
            <h2 className="text-2xl font-bold mt-3 text-white">Selamat Datang, {student.nama}!</h2>
            <p className="text-sm text-indigo-200/80 mt-1">NISN: {student.nomor_induk} | Email: {student.email}</p>
          </div>
          
          <div className="mt-6 pt-5 border-t border-indigo-800 flex flex-wrap gap-x-8 gap-y-3 text-sm text-indigo-200/90">
            <div>
              <span className="text-indigo-400 text-xs block uppercase font-semibold">Tempat PKL saat ini:</span>
              <span className="font-medium text-white">{myCompany?.nama_instansi || 'Belum Terdaftar'}</span>
            </div>
            <div>
              <span className="text-indigo-400 text-xs block uppercase font-semibold">Guru Pembimbing:</span>
              <span className="font-medium text-white">
                {student.id_pembimbing ? 'Terplot' : 'Belum Terplotting'}
              </span>
            </div>
            <div>
              <span className="text-indigo-400 text-xs block uppercase font-semibold">Status Penempatan:</span>
              <span className={`inline-flex items-center gap-1 font-semibold text-xs rounded px-2 py-0.5 mt-0.5 ${
                placement?.status === 'disetujui' ? 'bg-emerald-500/20 text-emerald-300' :
                placement?.status === 'pending' ? 'bg-amber-500/20 text-amber-300' :
                'bg-rose-500/20 text-rose-300'
              }`}>
                {placement?.status === 'disetujui' ? 'AKTIF PKL' :
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
          {isFeatureAllowed('siswa_presensi') && placement?.status === 'disetujui' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="attendance-section">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-indigo-600" /> Presensi Harian (Hari Ini)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Status Kehadiran Hari Ini</span>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <p className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-300 inline-block"></span>
                      Tanggal: <strong className="text-slate-700">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full inline-block ${todayAttendance ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                      Jam Masuk: <strong className="text-slate-700">{todayAttendance?.jam_masuk || '--:--'}</strong>
                    </p>
                    <p className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full inline-block ${todayAttendance?.jam_keluar ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                      Jam Pulang: <strong className="text-slate-700">{todayAttendance?.jam_keluar || '--:--'}</strong>
                    </p>
                    {todayAttendance && (
                      <p className="text-xs text-slate-500 mt-2">
                        Status Verifikasi Industri:{' '}
                        <span className={`font-semibold ${
                          todayAttendance.status_verifikasi === 'disetujui' ? 'text-emerald-600' :
                          todayAttendance.status_verifikasi === 'ditolak' ? 'text-rose-600' : 'text-amber-600'
                        }`}>
                          {todayAttendance.status_verifikasi.toUpperCase()}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="md:col-span-7">
                  {todayAttendance && todayAttendance.jam_keluar ? (
                    <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 text-sm flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-semibold">Presensi Selesai!</p>
                        <p className="text-xs text-emerald-700/90 mt-0.5">Anda telah melakukan absen masuk pada {todayAttendance.jam_masuk} dan pulang pada {todayAttendance.jam_keluar}.</p>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleAttendance} className="space-y-3">
                      {!todayAttendance ? (
                        <>
                          <div className="flex gap-4">
                            {['hadir', 'sakit', 'izin'].map((st) => (
                              <label key={st} className="flex items-center gap-2 text-sm text-slate-700 font-medium capitalize cursor-pointer">
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
                          {attStatus !== 'hadir' && (
                            <input
                              type="text"
                              required
                              value={attKeterangan}
                              onChange={(e) => setAttKeterangan(e.target.value)}
                              placeholder="Alasan sakit atau izin..."
                              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white"
                            />
                          )}
                          <button
                            type="submit"
                            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm"
                          >
                            Absen Masuk (Clock-In)
                          </button>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-100">
                            Anda sudah absen masuk jam <strong>{todayAttendance.jam_masuk}</strong>. Jangan lupa absen pulang saat waktu PKL berakhir hari ini.
                          </p>
                          <button
                            type="submit"
                            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold transition-all shadow-sm"
                          >
                            Absen Pulang (Clock-Out)
                          </button>
                        </div>
                      )}

                      {attSuccess && <p className="text-xs text-emerald-600 font-semibold mt-1">{attSuccess}</p>}
                    </form>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. INPUT JURNAL HARIAN */}
          {/* 3. MENU PENGISIAN JURNAL */}
          {isFeatureAllowed('siswa_jurnal') && placement?.status === 'disetujui' && (
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

          {/* 4. PENGAJUAN TEMPAT PKL (JIKA BELUM DISETUJUI) */}
          {isFeatureAllowed('siswa_pengajuan') && (!placement || placement.status !== 'disetujui') && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="apply-placement-section">
              <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-indigo-600" /> Form Pengajuan Tempat PKL
              </h3>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed mb-6">
                <p className="flex gap-2 font-medium text-slate-700">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  {placement?.status === 'pending' ? (
                    <span>Pengajuan Anda sedang dikaji oleh Koordinator PKL. Anda belum bisa mengisi jurnal harian sebelum pengajuan disetujui.</span>
                  ) : placement?.status === 'ditolak' ? (
                    <span>Pengajuan Anda ditolak dengan catatan: <strong className="text-rose-600">{placement.catatan}</strong>. Silakan ajukan ulang ke tempat lain.</span>
                  ) : (
                    <span>Anda belum terdaftar di tempat PKL mana pun. Silakan lengkapi formulir di bawah untuk mengajukan penempatan PKL Anda.</span>
                  )}
                </p>
              </div>

              <form onSubmit={handleApplyPlacement} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Pilih Instansi / Perusahaan</label>
                  <select
                    value={applyInstansiId}
                    onChange={(e) => setApplyInstansiId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none bg-white"
                  >
                    {instansiList.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.nama_instansi} - (Kuota Sisa: {inst.kuota} Siswa)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tanggal Mulai PKL</label>
                    <input
                      type="date"
                      required
                      value={applyStart}
                      onChange={(e) => setApplyStart(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">Tanggal Selesai PKL</label>
                    <input
                      type="date"
                      required
                      value={applyEnd}
                      onChange={(e) => setApplyEnd(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  {applySuccess && <span className="text-xs text-emerald-600 font-semibold">{applySuccess}</span>}
                  <span />
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm"
                  >
                    Ajukan Tempat PKL
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 5. HISTORI JURNAL KEGIATAN */}
          {isFeatureAllowed('siswa_jurnal') && placement?.status === 'disetujui' && (
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
                  <div key={log.id} className="flex items-center justify-between p-2.5 bg-slate-50/50 rounded-lg border border-slate-100 text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 block">{new Date(log.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {log.status === 'hadir' ? `Jam: ${log.jam_masuk} - ${log.jam_keluar || 'Belum Pulang'}` : `Keterangan: ${log.keterangan || 'Sakit/Izin'}`}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === 'hadir' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {log.status}
                      </span>
                      <span className={`text-[9px] font-medium ${
                        log.status_verifikasi === 'disetujui' ? 'text-emerald-600' :
                        log.status_verifikasi === 'ditolak' ? 'text-rose-600' : 'text-amber-600'
                      }`}>
                        {log.status_verifikasi.toUpperCase()}
                      </span>
                    </div>
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
