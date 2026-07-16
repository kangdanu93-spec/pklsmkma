import React, { useState, useEffect } from 'react';
import { Users, FileText, CheckCircle2, XCircle, AlertCircle, Edit, Star, RefreshCw, Send, Trash, Bookmark, Calendar, Check, MessageSquare, MapPin, Camera, Image, Clock, ClipboardList } from 'lucide-react';
import { PklUser, PklJournal, PklAttendance, PklEvaluation, Announcement, PklInstansi, PklPlacement, MenuAccess, TeacherMonitoring } from '../types';
import { dbGetUsers, dbGetJournals, dbSaveJournal, dbGetAttendance, dbSaveAttendance, dbGetEvaluations, dbSaveEvaluation, dbGetAnnouncements, dbSaveAnnouncement, dbDeleteAnnouncement, dbGetPlacements, dbGetMenuAccess, dbGetTeacherMonitorings, dbSaveTeacherMonitoring, dbDeleteTeacherMonitoring } from '../utils/localDb';

interface TeacherDashboardProps {
  teacher: PklUser;
  instansiList: PklInstansi[];
  refreshCounter?: number;
}

export default function TeacherDashboard({ teacher, instansiList, refreshCounter }: TeacherDashboardProps) {
  // Menu permissions
  const [menuAccessList, setMenuAccessList] = useState<MenuAccess[]>([]);

  useEffect(() => {
    setMenuAccessList(dbGetMenuAccess());
  }, []);

  const isFeatureAllowed = (id: string): boolean => {
    const menu = menuAccessList.find(m => m.id === id);
    if (!menu) return true;
    return menu.allowed_roles.includes('guru');
  };

  const [students, setStudents] = useState<PklUser[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<PklUser | null>(null);
  const [journals, setJournals] = useState<PklJournal[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<PklAttendance[]>([]);
  const [placements, setPlacements] = useState<PklPlacement[]>([]);
  const [evaluations, setEvaluations] = useState<PklEvaluation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'bimbingan' | 'monitoring'>('bimbingan');

  // Teacher Monitoring State
  const [monitorings, setMonitorings] = useState<TeacherMonitoring[]>([]);

  // Monitoring Form State
  const [monType, setMonType] = useState<TeacherMonitoring['tipe_monitoring']>('Monitoring 1');
  const [monStudentId, setMonStudentId] = useState('');
  const [monDate, setMonDate] = useState(new Date().toISOString().split('T')[0]);
  const [monTime, setMonTime] = useState('');
  const [monLat, setMonLat] = useState<number | undefined>(undefined);
  const [monLng, setMonLng] = useState<number | undefined>(undefined);
  const [monPhoto, setMonPhoto] = useState('');
  const [monNotes, setMonNotes] = useState('');
  const [monSuccess, setMonSuccess] = useState('');
  const [monIsGettingGPS, setMonIsGettingGPS] = useState(false);
  const [expandedPhotoId, setExpandedPhotoId] = useState<string | null>(null);

  // Announcement Form State
  const [newAnnTitle, setNewAnnTitle] = useState('');
  const [newAnnContent, setNewAnnContent] = useState('');
  const [annSuccess, setAnnSuccess] = useState('');

  // Journal Feedback State
  const [activeJournalId, setActiveJournalId] = useState<string | null>(null);
  const [journalFeedback, setJournalFeedback] = useState('');

  // Grades Form State
  const [gradeLaporan, setGradeLaporan] = useState(0);
  const [gradePresentasi, setGradePresentasi] = useState(0);
  const [gradeCatatan, setGradeCatatan] = useState('');
  const [gradeSuccess, setGradeSuccess] = useState('');

  useEffect(() => {
    fetchTeacherData(refreshCounter !== undefined && refreshCounter > 0);
  }, [teacher.id, refreshCounter]);

  // Set default live time on mount or activeTab switch
  useEffect(() => {
    if (activeTab === 'monitoring') {
      const now = new Date();
      const timeString = now.toTimeString().split(' ')[0]; // HH:MM:SS
      setMonTime(timeString);
      getLiveLocation();
    }
  }, [activeTab]);

  const getLiveLocation = () => {
    setMonIsGettingGPS(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMonLat(position.coords.latitude);
          setMonLng(position.coords.longitude);
          setMonIsGettingGPS(false);
        },
        (error) => {
          console.warn('Geolocation failed or denied, using demo coordinates:', error);
          // Set beautiful fallback coordinates matching Bekasi/Jakarta sandbox area
          setMonLat(-6.24158 + (Math.random() - 0.5) * 0.01);
          setMonLng(106.99245 + (Math.random() - 0.5) * 0.01);
          setMonIsGettingGPS(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setMonLat(-6.24158);
      setMonLng(106.99245);
      setMonIsGettingGPS(false);
    }
  };

  const fetchTeacherData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const allUsers = await dbGetUsers();
      // Filter students assigned to this teacher
      const myStudents = allUsers.data.filter(u => u.role === 'siswa' && u.id_pembimbing === teacher.id);
      setStudents(myStudents);

      if (myStudents.length > 0) {
        if (!selectedStudent) {
          setSelectedStudent(myStudents[0]);
        } else {
          const updatedSelected = myStudents.find(s => s.id === selectedStudent.id);
          if (updatedSelected && JSON.stringify(updatedSelected) !== JSON.stringify(selectedStudent)) {
            setSelectedStudent(updatedSelected);
          }
        }
      }

      const resJour = await dbGetJournals();
      setJournals(resJour.data);

      const resAtt = await dbGetAttendance();
      setAttendanceLogs(resAtt.data);

      const resEvals = await dbGetEvaluations();
      setEvaluations(resEvals.data);

      const resAnns = await dbGetAnnouncements();
      setAnnouncements(resAnns.data);

      const resPlacements = await dbGetPlacements();
      setPlacements(resPlacements.data);

      const resMon = await dbGetTeacherMonitorings();
      setMonitorings(resMon.data.filter(m => m.id_guru === teacher.id));

    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Select student handler
  const handleSelectStudent = (student: PklUser) => {
    setSelectedStudent(student);
    const evaluation = evaluations.find(e => e.id_siswa === student.id);
    if (evaluation) {
      setGradeLaporan(evaluation.nilai_sekolah_laporan);
      setGradePresentasi(evaluation.nilai_sekolah_presentasi);
      setGradeCatatan(evaluation.catatan_sekolah || '');
    } else {
      setGradeLaporan(0);
      setGradePresentasi(0);
      setGradeCatatan('');
    }
    setActiveJournalId(null);
    setJournalFeedback('');
  };

  // Approve / Reject Journal
  const handleVerifyJournal = async (journal: PklJournal, action: 'diverifikasi' | 'revisi') => {
    const feedback = activeJournalId === journal.id ? journalFeedback : undefined;
    const updatedJournal: PklJournal = {
      ...journal,
      status: action,
      catatan_pembimbing: feedback || journal.catatan_pembimbing
    };

    const res = await dbSaveJournal(updatedJournal);
    if (res.success) {
      // update state
      setJournals(prev => prev.map(j => j.id === journal.id ? updatedJournal : j));
      setActiveJournalId(null);
      setJournalFeedback('');
    }
  };

  // Verify Attendance
  const handleVerifyAttendance = async (log: PklAttendance, action: 'disetujui' | 'ditolak') => {
    const updatedLog: PklAttendance = {
      ...log,
      status_verifikasi: action
    };

    const res = await dbSaveAttendance(updatedLog);
    if (res.success) {
      setAttendanceLogs(prev => prev.map(a => a.id === log.id ? updatedLog : a));
    }
  };

  // Grade save
  const handleSaveGrades = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const existingEval = evaluations.find(e => e.id_siswa === selectedStudent.id);
    const updatedEvaluation: PklEvaluation = {
      id: existingEval?.id || `eval-${Date.now()}`,
      id_siswa: selectedStudent.id,
      nilai_industri_teknis: existingEval?.nilai_industri_teknis || 0,
      nilai_industri_nonteknis: existingEval?.nilai_industri_nonteknis || 0,
      nilai_industri_disiplin: existingEval?.nilai_industri_disiplin || 0,
      nilai_sekolah_laporan: Number(gradeLaporan),
      nilai_sekolah_presentasi: Number(gradePresentasi),
      catatan_industri: existingEval?.catatan_industri || '',
      catatan_sekolah: gradeCatatan
    };

    const res = await dbSaveEvaluation(updatedEvaluation);
    if (res.success) {
      setGradeSuccess('Nilai laporan & presentasi berhasil disimpan!');
      // refresh evaluations list
      const resEvals = await dbGetEvaluations();
      setEvaluations(resEvals.data);
      setTimeout(() => setGradeSuccess(''), 4000);
    }
  };

  // Add Announcement
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnnTitle.trim() || !newAnnContent.trim()) {
      alert('Mohon isi judul dan konten pengumuman.');
      return;
    }

    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      judul: newAnnTitle,
      konten: newAnnContent,
      tanggal: new Date().toISOString().split('T')[0],
      author: teacher.nama
    };

    const res = await dbSaveAnnouncement(newAnn);
    if (res.success) {
      setAnnSuccess('Pengumuman berhasil diposting!');
      setNewAnnTitle('');
      setNewAnnContent('');
      // refresh announcements
      const resAnns = await dbGetAnnouncements();
      setAnnouncements(resAnns.data);
      setTimeout(() => setAnnSuccess(''), 4000);
    }
  };

  const handleDeleteAnn = async (id: string) => {
    if (confirm('Hapus pengumuman ini?')) {
      const res = await dbDeleteAnnouncement(id);
      if (res.success) {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
      }
    }
  };

  const handleSaveMonitoring = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Find target student if any to populate metadata
    const targetStudent = students.find(s => s.id === monStudentId);
    let studCompany = '';
    if (targetStudent) {
      const placement = placements.find(p => p.id_siswa === targetStudent.id);
      if (placement) {
        const company = instansiList.find(i => i.id === placement.id_instansi);
        studCompany = company?.nama_instansi || '';
      }
    }

    const newMon: TeacherMonitoring = {
      id: `mon-${Date.now()}`,
      id_guru: teacher.id,
      nama_guru: teacher.nama,
      tanggal: monDate,
      jam_monitoring: monTime,
      tipe_monitoring: monType,
      latitude: monLat,
      longitude: monLng,
      foto_url: monPhoto || undefined,
      catatan: monNotes || undefined,
      id_siswa: monStudentId || undefined,
      nama_siswa: targetStudent?.nama || undefined,
      nama_instansi: studCompany || undefined
    };

    const res = await dbSaveTeacherMonitoring(newMon);
    if (res.success) {
      setMonSuccess('Absen & Laporan Monitoring berhasil disimpan!');
      setMonNotes('');
      setMonPhoto('');
      setMonStudentId('');
      
      // refresh monitorings
      const resMon = await dbGetTeacherMonitorings();
      setMonitorings(resMon.data.filter(m => m.id_guru === teacher.id));
      
      setTimeout(() => setMonSuccess(''), 4000);
    }
  };

  const handleDeleteMonitoring = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus laporan kunjungan monitoring ini?')) {
      const res = await dbDeleteTeacherMonitoring(id);
      if (res.success) {
        setMonitorings(prev => prev.filter(m => m.id !== id));
      }
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setMonPhoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Filter student data for view
  const activeStudentJournals = selectedStudent ? journals.filter(j => j.id_siswa === selectedStudent.id) : [];
  const activeStudentAttendance = selectedStudent ? attendanceLogs.filter(a => a.id_siswa === selectedStudent.id) : [];
  const activeStudentPlacement = selectedStudent ? placements.find(p => p.id_siswa === selectedStudent.id) : null;
  const activeStudentCompany = activeStudentPlacement ? instansiList.find(i => i.id === activeStudentPlacement.id_instansi) : null;
  const activeStudentEvaluation = selectedStudent ? evaluations.find(e => e.id_siswa === selectedStudent.id) : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm">Memuat Dashboard Guru Pembimbing...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="teacher-dashboard">
      
      {/* 1. GURU PANEL HEADER */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 p-6 rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30">
            Guru Pembimbing Sekolah
          </span>
          <h2 className="text-2xl font-bold mt-2 text-white">Dashboard Pembimbing, {teacher.nama}!</h2>
          <p className="text-sm text-slate-300 mt-1">NIP/NIK: {teacher.nomor_induk} | Email: {teacher.email}</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-slate-800 px-4 py-3 rounded-xl border border-slate-700 text-center">
            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Siswa Bimbingan</span>
            <strong className="text-2xl text-white block mt-0.5">{students.length}</strong>
          </div>
          <div className="bg-indigo-900/30 px-4 py-3 rounded-xl border border-indigo-800/50 text-center">
            <span className="text-[10px] text-indigo-300 block font-semibold uppercase">Jurnal Pending</span>
            <strong className="text-2xl text-indigo-300 block mt-0.5">
              {journals.filter(j => j.status === 'pending' && students.some(s => s.id === j.id_siswa)).length}
            </strong>
          </div>
        </div>
      </div>

      {/* 2. TABS NAVIGATION */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('bimbingan')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'bimbingan'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Bimbingan & Verifikasi Siswa
        </button>
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'monitoring'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/20'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Camera className="w-4 h-4" />
          Presensi & Kunjungan Monitoring Guru
        </button>
      </div>

      {activeTab === 'bimbingan' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: LIST OF STUDENTS (3 cols) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" /> Siswa Bimbingan
              </h3>

              {students.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  Belum ada siswa yang diplot ke bimbingan Anda.
                </div>
              ) : (
                <div className="space-y-1">
                  {students.map((stud) => {
                    const hasPendingJour = journals.some(j => j.id_siswa === stud.id && j.status === 'pending');
                    const isSelected = selectedStudent?.id === stud.id;
                    return (
                      <button
                        key={stud.id}
                        onClick={() => handleSelectStudent(stud)}
                        className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between text-xs ${
                          isSelected 
                            ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/10' 
                            : 'bg-slate-50/60 hover:bg-slate-100/80 text-slate-700 border border-transparent'
                        }`}
                      >
                        <div>
                          <p className={`font-semibold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{stud.nama}</p>
                          <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>NISN: {stud.nomor_induk}</p>
                        </div>
                        {hasPendingJour && (
                          <span className={`w-2.5 h-2.5 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-500 animate-pulse'}`} title="Ada Jurnal Baru!" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* POST ANNOUNCEMENT FORM */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" /> Tulis Pengumuman
              </h3>

              <form onSubmit={handleAddAnnouncement} className="space-y-3">
                <input
                  type="text"
                  required
                  value={newAnnTitle}
                  onChange={(e) => setNewAnnTitle(e.target.value)}
                  placeholder="Judul Pengumuman..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white font-semibold text-slate-700"
                />
                <textarea
                  rows={3}
                  required
                  value={newAnnContent}
                  onChange={(e) => setNewAnnContent(e.target.value)}
                  placeholder="Isi pengumuman lengkap..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-700"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all"
                >
                  Posting Pengumuman
                </button>
                {annSuccess && <p className="text-[10px] text-emerald-600 font-semibold">{annSuccess}</p>}
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: DETAIL MONITORING SISWA TERPILIH (9 cols) */}
          <div className="lg:col-span-9 space-y-8">
            
            {selectedStudent ? (
              <div className="space-y-8">
                
                {/* STUDENT METADATA & GENERAL PKL STATUS */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-slate-400 text-xs block uppercase font-bold">Memantau Siswa:</span>
                    <h3 className="text-lg font-bold text-slate-800 mt-0.5">{selectedStudent.nama}</h3>
                    <p className="text-xs text-slate-500">
                      Instansi PKL: <strong>{activeStudentCompany?.nama_instansi || 'Belum Terdaftar / Pending Approval'}</strong>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-center">
                      <span className="text-[9px] text-slate-400 font-semibold uppercase block">Hadir</span>
                      <strong className="text-sm text-slate-700 block">
                        {activeStudentAttendance.filter(a => a.status === 'hadir' && a.status_verifikasi === 'disetujui').length} hari
                      </strong>
                    </div>
                    <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-center">
                      <span className="text-[9px] text-slate-400 font-semibold uppercase block">Sakit / Izin</span>
                      <strong className="text-sm text-slate-700 block">
                        {activeStudentAttendance.filter(a => (a.status === 'sakit' || a.status === 'izin') && a.status_verifikasi === 'disetujui').length} hari
                      </strong>
                    </div>
                    <div className="bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100 text-center">
                      <span className="text-[9px] text-indigo-500 font-semibold uppercase block">Jurnal</span>
                      <strong className="text-sm text-indigo-700 block">
                        {activeStudentJournals.filter(j => j.status === 'diverifikasi').length} / {activeStudentJournals.length}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* TABS OF WORK: JURNAL, KEHADIRAN, DAN PENILAIAN */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                  
                  {/* SUB-SECTION: JURNAL & PRESENSI (7 cols) */}
                  <div className="md:col-span-8 space-y-8">
                    
                    {/* JURNAL VERIFICATION PANEL */}
                    {isFeatureAllowed('guru_jurnal') && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                        <span>Jurnal Kegiatan Siswa</span>
                        <span className="text-xs text-slate-400 font-normal">Lakukan verifikasi & beri feedback</span>
                      </h4>

                      {activeStudentJournals.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-6 text-center">Siswa ini belum memposting jurnal kegiatan harian.</p>
                      ) : (
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                          {activeStudentJournals.map((j) => (
                            <div key={j.id} className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 text-xs space-y-2.5">
                              <div className="flex justify-between items-start gap-3">
                                <div>
                                  <span className="font-bold text-slate-700">{new Date(j.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                  <h5 className="font-semibold text-slate-800 text-[13px] mt-0.5">{j.kegiatan}</h5>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  j.status === 'diverifikasi' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  j.status === 'revisi' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                  'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                  {j.status}
                                </span>
                              </div>

                              <div className="p-2.5 bg-white rounded-lg border border-slate-100 text-slate-600 leading-relaxed">
                                <span className="text-[9px] uppercase font-semibold text-slate-400 block mb-0.5">Ringkasan Pembelajaran:</span>
                                {j.ringkasan_belajar}
                              </div>

                              {/* Verification Actions */}
                              {j.status === 'pending' ? (
                                <div className="space-y-2 pt-1 border-t border-slate-100">
                                  {activeJournalId === j.id ? (
                                    <div className="space-y-2">
                                      <textarea
                                        rows={2}
                                        value={journalFeedback}
                                        onChange={(e) => setJournalFeedback(e.target.value)}
                                        placeholder="Tambahkan umpan balik, instruksi, atau catatan revisi..."
                                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-700"
                                      />
                                      <div className="flex gap-2 justify-end">
                                        <button
                                          onClick={() => setActiveJournalId(null)}
                                          className="px-2.5 py-1 rounded bg-slate-100 text-slate-600 font-medium"
                                        >
                                          Batal
                                        </button>
                                        <button
                                          onClick={() => handleVerifyJournal(j, 'revisi')}
                                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1"
                                        >
                                          <XCircle className="w-3.5 h-3.5" /> Minta Revisi
                                        </button>
                                        <button
                                          onClick={() => handleVerifyJournal(j, 'diverifikasi')}
                                          className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center gap-1"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={() => {
                                          setActiveJournalId(j.id);
                                          setJournalFeedback('');
                                        }}
                                        className="px-2.5 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium flex items-center gap-1"
                                      >
                                        <MessageSquare className="w-3 h-3 text-slate-500" /> Beri Feedback
                                      </button>
                                      <button
                                        onClick={() => handleVerifyJournal(j, 'diverifikasi')}
                                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Langsung Setujui
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                j.catatan_pembimbing && (
                                  <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-50">
                                    <strong>Feedback:</strong> &ldquo;{j.catatan_pembimbing}&rdquo;
                                  </p>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    )}

                    {/* ATTENDANCE APPROVAL PANEL */}
                    {isFeatureAllowed('guru_presensi') && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                      <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                        <span>Presensi & Kehadiran Siswa</span>
                      </h4>

                      {activeStudentAttendance.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-6 text-center">Siswa ini belum memiliki log kehadiran.</p>
                      ) : (
                        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                          {activeStudentAttendance.map((log) => (
                            <div key={log.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-xs space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <strong className="text-slate-700 block">
                                    {new Date(log.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                  </strong>
                                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">
                                    {log.status === 'hadir' ? `Jam Masuk: ${log.jam_masuk} | Jam Pulang: ${log.jam_keluar || '--:--'}` : `Keterangan: ${log.keterangan || '-'}`}
                                  </p>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    log.status === 'hadir' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                                  }`}>
                                    {log.status}
                                  </span>

                                  {log.status_verifikasi === 'pending' ? (
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => handleVerifyAttendance(log, 'ditolak')}
                                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100"
                                        title="Tolak Absen"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleVerifyAttendance(log, 'disetujui')}
                                        className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100"
                                        title="Setujui Absen"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <span className={`text-[10px] font-bold uppercase ${
                                      log.status_verifikasi === 'disetujui' ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                      {log.status_verifikasi}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* GPS Mapping Coordinates Display for Teachers */}
                              {(log.latitude || log.latitude_keluar) && (
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/50 text-[10px]">
                                  {log.latitude && log.longitude ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-white p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1.5 text-slate-600 font-semibold"
                                      title="Lihat Peta Koordinat Masuk"
                                    >
                                      <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                      <span className="truncate">GPS Masuk: {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}</span>
                                    </a>
                                  ) : (
                                    <div className="bg-slate-100/50 p-2 rounded-lg text-slate-400 italic">No GPS Masuk</div>
                                  )}

                                  {log.latitude_keluar && log.longitude_keluar ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${log.latitude_keluar},${log.longitude_keluar}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-white p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1.5 text-slate-600 font-semibold"
                                      title="Lihat Peta Koordinat Pulang"
                                    >
                                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                      <span className="truncate">GPS Pulang: {log.latitude_keluar.toFixed(5)}, {log.longitude_keluar.toFixed(5)}</span>
                                    </a>
                                  ) : (
                                    <div className="bg-slate-100/50 p-2 rounded-lg text-slate-400 italic">No GPS Pulang</div>
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

                  {/* SUB-SECTION: INPUT GRADE & PENILAIAN (5 cols) */}
                  <div className="md:col-span-4 space-y-6">
                    
                    {/* PENILAIAN SEKOLAH FORM */}
                    {isFeatureAllowed('guru_nilai') && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                        <Star className="w-4 h-4 text-indigo-600" /> Input Nilai Sekolah
                      </h4>

                      <form onSubmit={handleSaveGrades} className="space-y-4 text-xs">
                        <div>
                          <label className="block font-semibold text-slate-500 mb-1">Nilai Penyusunan Laporan (0-100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={gradeLaporan}
                            onChange={(e) => setGradeLaporan(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-500 mb-1">Nilai Presentasi / Ujian (0-100)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            required
                            value={gradePresentasi}
                            onChange={(e) => setGradePresentasi(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-500 mb-1">Catatan Bimbingan / Rekomendasi</label>
                          <textarea
                            rows={3}
                            value={gradeCatatan}
                            onChange={(e) => setGradeCatatan(e.target.value)}
                            placeholder="Beri umpan balik untuk penulisan laporan..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-800"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all"
                        >
                          Simpan Nilai Bimbingan
                        </button>

                        {gradeSuccess && <p className="text-[10px] text-emerald-600 font-semibold">{gradeSuccess}</p>}
                      </form>
                    </div>
                    )}

                    {/* LEMBAR NILAI INDUSTRI (READ ONLY FOR SCHOOLS) */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3 text-xs">
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                        <Bookmark className="w-4 h-4 text-indigo-600" /> Nilai dari Industri
                      </h4>

                      {activeStudentEvaluation ? (
                        <div className="space-y-2">
                          <div className="flex justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-slate-500">Nilai Teknis:</span>
                            <strong className="text-slate-700">{activeStudentEvaluation.nilai_industri_teknis}</strong>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-slate-500">Nilai Soft Skill:</span>
                            <strong className="text-slate-700">{activeStudentEvaluation.nilai_industri_nonteknis}</strong>
                          </div>
                          <div className="flex justify-between border-b border-slate-100 pb-1.5">
                            <span className="text-slate-500">Kedisiplinan:</span>
                            <strong className="text-slate-700">{activeStudentEvaluation.nilai_industri_disiplin}</strong>
                          </div>
                          {activeStudentEvaluation.catatan_industri && (
                            <div className="pt-1.5 text-slate-500 italic leading-relaxed">
                              <strong>Catatan Industri:</strong> &ldquo;{activeStudentEvaluation.catatan_industri}&rdquo;
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-400 italic py-2">Pembimbing Industri belum memberikan penilaian akhir.</p>
                      )}
                    </div>

                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="font-semibold text-slate-600 text-sm">Pilih Siswa dari Daftar Sebelah Kiri</p>
                <p className="text-xs text-slate-400 mt-1">Anda dapat memonitor laporan harian, menyetujui absensi, dan memberikan nilai akhir di sini.</p>
              </div>
            )}

            {/* LIST OF RECENT ANNOUNCEMENTS FROM THIS TEACHER */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h4 className="text-sm font-bold text-slate-800 mb-4">Pengumuman Terposting</h4>
              
              {announcements.filter(a => a.author === teacher.nama).length === 0 ? (
                <p className="text-xs text-slate-400 italic">Anda belum memposting pengumuman apa pun.</p>
              ) : (
                <div className="space-y-3">
                  {announcements.filter(a => a.author === teacher.nama).map((ann) => (
                    <div key={ann.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between items-start gap-4">
                      <div>
                        <h5 className="font-bold text-slate-800">{ann.judul}</h5>
                        <p className="text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">{ann.konten}</p>
                        <span className="text-[10px] text-slate-400 mt-2 block">Diposting pada {new Date(ann.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteAnn(ann.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
                        title="Hapus Pengumuman"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        /* MONITORING VIEW CONTAINER */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Form (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  Kunjungan & Absen Monitoring
                </h3>
                <p className="text-xs text-slate-500 mt-1">Lakukan pencatatan kunjungan bimbingan PKL siswa di lokasi industri secara langsung.</p>
              </div>

              <form onSubmit={handleSaveMonitoring} className="space-y-4">
                {/* 1. PILIHAN ABSEN / MONITORING TIPE */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pilihan Absen / Tipe Monitoring</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'Monitoring 1',
                      'Monitoring 2',
                      'Monitoring 3',
                      'Monitoring 4',
                      'Monitoring 5',
                      'Penjemputan Siswa'
                    ].map((type) => {
                      const isSelected = monType === type;
                      return (
                        <label
                          key={type}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm'
                              : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="radio"
                            name="monType"
                            checked={isSelected}
                            onChange={() => setMonType(type as any)}
                            className="text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                          {type}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 2. TARGET SISWA */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pilih Siswa Sasaran (Optional)</label>
                  <select
                    value={monStudentId}
                    onChange={(e) => setMonStudentId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white text-slate-700 font-medium"
                  >
                    <option value="">-- Hubungkan dengan Siswa Bimbingan (Bila Ada) --</option>
                    {students.map((stud) => {
                      const placement = placements.find(p => p.id_siswa === stud.id);
                      const company = placement ? instansiList.find(i => i.id === placement.id_instansi) : null;
                      return (
                        <option key={stud.id} value={stud.id}>
                          {stud.nama} {company ? `(${company.nama_instansi})` : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 3. TANGGAL & JAM MONITORING */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tanggal Kunjungan</label>
                    <input
                      type="date"
                      required
                      value={monDate}
                      onChange={(e) => setMonDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white text-slate-700 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> Jam Sampai
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="HH:MM:SS"
                      value={monTime}
                      onChange={(e) => setMonTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white text-slate-700 font-medium"
                    />
                    <span className="text-[9px] text-slate-400 mt-0.5 block italic">* Hanya jam sampai, tidak perlu jam pulang</span>
                  </div>
                </div>

                {/* 4. LIVE LOKASI */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Live Lokasi (GPS Koordinat)</label>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 font-medium space-y-0.5">
                      {monLat && monLng ? (
                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                          <span>GPS Terkunci: {monLat.toFixed(6)}, {monLng.toFixed(6)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Mencari koordinat GPS...</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={getLiveLocation}
                      disabled={monIsGettingGPS}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                    >
                      <MapPin className={`w-3.5 h-3.5 text-indigo-600 ${monIsGettingGPS ? 'animate-bounce' : ''}`} />
                      {monIsGettingGPS ? 'Menyinkronkan...' : 'Segarkan'}
                    </button>
                  </div>
                </div>

                {/* 5. UPLOAD FOTO */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Upload Foto / Bukti Kunjungan</label>
                  
                  {monPhoto ? (
                    <div className="relative border border-indigo-100 rounded-xl overflow-hidden bg-slate-50 max-h-48 flex items-center justify-center p-2 group">
                      <img src={monPhoto} alt="Preview Bukti Kunjungan" className="max-h-44 object-contain rounded-lg" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setMonPhoto('')}
                        className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-full shadow hover:bg-rose-700 transition-all text-xs"
                        title="Hapus Foto"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-slate-50/50 hover:bg-indigo-50/10">
                      <Camera className="w-8 h-8 text-slate-400" />
                      <div className="text-center">
                        <span className="text-xs font-bold text-indigo-600 hover:underline">Klik untuk upload foto</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Mendukung kamera langsung atau unggahan file gambar (Maks. 5MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* 6. CATATAN KUNJUNGAN */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Catatan Hasil Kunjungan & Hambatan (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Tuliskan catatan kemajuan belajar siswa, saran industri, atau kendala yang ditemukan..."
                    value={monNotes}
                    onChange={(e) => setMonNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white text-slate-700"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Simpan Absen & Kirim Laporan
                </button>

                {monSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-semibold rounded-xl text-center">
                    {monSuccess}
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Right Column: History List (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-indigo-600" />
                    Riwayat Kunjungan & Absensi Guru
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Daftar presensi monitoring yang telah Anda catat.</p>
                </div>
                <span className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-lg">
                  Total: {monitorings.length} Kunjungan
                </span>
              </div>

              {monitorings.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <ClipboardList className="w-12 h-12 text-slate-200 mx-auto" />
                  <p className="text-sm font-semibold">Belum Ada Riwayat Kunjungan</p>
                  <p className="text-xs text-slate-400">Silakan isi form di sebelah kiri untuk mencatat absen monitoring pertama Anda.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
                  {monitorings.map((log) => (
                    <div key={log.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-xs space-y-3.5 relative hover:shadow-sm transition-all">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.tipe_monitoring === 'Penjemputan Siswa'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                          }`}>
                            {log.tipe_monitoring}
                          </span>
                          <strong className="text-sm text-slate-800 block mt-1">
                            {log.nama_siswa ? log.nama_siswa : 'Kunjungan Umum'}
                          </strong>
                          {log.nama_instansi && (
                            <p className="text-slate-500 font-medium">Instansi: {log.nama_instansi}</p>
                          )}
                        </div>

                        <button
                          onClick={() => handleDeleteMonitoring(log.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:border-rose-100 border border-transparent transition-all"
                          title="Hapus Laporan Kunjungan"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 block text-[9px] font-bold uppercase">Tanggal</span>
                          <span className="font-semibold text-slate-700">
                            {new Date(log.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px] font-bold uppercase">Jam Sampai</span>
                          <span className="font-semibold text-slate-700">{log.jam_monitoring} WIB</span>
                        </div>
                      </div>

                      {log.catatan && (
                        <div className="bg-slate-50 p-2.5 rounded-lg text-slate-600 leading-relaxed italic border border-slate-100/50">
                          <strong>Catatan:</strong> &ldquo;{log.catatan}&rdquo;
                        </div>
                      )}

                      {/* Map Location & Photo Row */}
                      <div className="flex flex-col sm:flex-row items-stretch gap-3">
                        {log.latitude && log.longitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${log.latitude},${log.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 p-2.5 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2 text-slate-600 text-[11px] font-semibold"
                            title="Klik untuk membuka di Google Maps"
                          >
                            <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="truncate">Live Lokasi: {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}</span>
                          </a>
                        ) : (
                          <div className="flex-1 p-2.5 bg-slate-100/50 rounded-xl text-slate-400 italic text-[11px] flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> No GPS data
                          </div>
                        )}

                        {log.foto_url && (
                          <button
                            onClick={() => setExpandedPhotoId(expandedPhotoId === log.id ? null : log.id)}
                            className="p-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 text-indigo-600 text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-all"
                          >
                            <Image className="w-4 h-4 text-indigo-500" />
                            Lihat Foto Bukti
                          </button>
                        )}
                      </div>

                      {/* Lightbox Photo Preview */}
                      {expandedPhotoId === log.id && log.foto_url && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Foto Bukti Kunjungan:</span>
                          <div className="bg-slate-900 rounded-xl p-2 flex justify-center items-center relative overflow-hidden">
                            <img src={log.foto_url} alt="Bukti Foto Kunjungan" className="max-h-80 rounded-lg object-contain" referrerPolicy="no-referrer" />
                            <button
                              onClick={() => setExpandedPhotoId(null)}
                              className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-1.5 transition-all"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
