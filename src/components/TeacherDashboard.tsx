import React, { useState, useEffect } from 'react';
import { Users, FileText, CheckCircle2, XCircle, AlertCircle, Edit, Star, RefreshCw, Send, Trash, Bookmark, Calendar, Check, MessageSquare } from 'lucide-react';
import { PklUser, PklJournal, PklAttendance, PklEvaluation, Announcement, PklInstansi, PklPlacement } from '../types';
import { dbGetUsers, dbGetJournals, dbSaveJournal, dbGetAttendance, dbSaveAttendance, dbGetEvaluations, dbSaveEvaluation, dbGetAnnouncements, dbSaveAnnouncement, dbDeleteAnnouncement, dbGetPlacements } from '../utils/localDb';

interface TeacherDashboardProps {
  teacher: PklUser;
  instansiList: PklInstansi[];
}

export default function TeacherDashboard({ teacher, instansiList }: TeacherDashboardProps) {
  const [students, setStudents] = useState<PklUser[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<PklUser | null>(null);
  const [journals, setJournals] = useState<PklJournal[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<PklAttendance[]>([]);
  const [placements, setPlacements] = useState<PklPlacement[]>([]);
  const [evaluations, setEvaluations] = useState<PklEvaluation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

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
    fetchTeacherData();
  }, [teacher.id]);

  const fetchTeacherData = async () => {
    setLoading(true);
    try {
      const allUsers = await dbGetUsers();
      // Filter students assigned to this teacher
      const myStudents = allUsers.data.filter(u => u.role === 'siswa' && u.id_pembimbing === teacher.id);
      setStudents(myStudents);

      if (myStudents.length > 0 && !selectedStudent) {
        setSelectedStudent(myStudents[0]);
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

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white"
              />
              <textarea
                rows={3}
                required
                value={newAnnContent}
                onChange={(e) => setNewAnnContent(e.target.value)}
                placeholder="Isi pengumuman lengkap..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white"
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

                  {/* ATTENDANCE APPROVAL PANEL */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                      <span>Presensi & Kehadiran Siswa</span>
                    </h4>

                    {activeStudentAttendance.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-6 text-center">Siswa ini belum memiliki log kehadiran.</p>
                    ) : (
                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                        {activeStudentAttendance.map((log) => (
                          <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
                            <div>
                              <strong className="text-slate-700">{new Date(log.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {log.status === 'hadir' ? `Jam Masuk: ${log.jam_masuk} | Jam Pulang: ${log.jam_keluar || '--:--'}` : `Keterangan: ${log.keterangan || '-'}`}
                              </p>
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                log.status === 'hadir' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                              }`}>
                                {log.status}
                              </span>

                              {log.status_verifikasi === 'pending' ? (
                                <div className="flex gap-1.5">
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
                                <span className={`text-[10px] font-semibold ${
                                  log.status_verifikasi === 'disetujui' ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                  {log.status_verifikasi.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* SUB-SECTION: INPUT GRADE & PENILAIAN (5 cols) */}
                <div className="md:col-span-4 space-y-6">
                  
                  {/* PENILAIAN SEKOLAH FORM */}
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

    </div>
  );
}
