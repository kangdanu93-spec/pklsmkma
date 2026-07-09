import React, { useState, useEffect } from 'react';
import { Briefcase, FileText, CheckCircle2, XCircle, Users, Star, RefreshCw, Send, Bookmark, Info, Check, MapPin } from 'lucide-react';
import { PklUser, PklJournal, PklAttendance, PklEvaluation, PklInstansi, MenuAccess } from '../types';
import { dbGetUsers, dbGetJournals, dbSaveJournal, dbGetAttendance, dbSaveAttendance, dbGetEvaluations, dbSaveEvaluation, dbGetMenuAccess } from '../utils/localDb';

interface IndustryDashboardProps {
  industry: PklUser;
  instansiList: PklInstansi[];
  refreshCounter?: number;
}

export default function IndustryDashboard({ industry, instansiList, refreshCounter }: IndustryDashboardProps) {
  // Menu permissions
  const [menuAccessList, setMenuAccessList] = useState<MenuAccess[]>([]);

  useEffect(() => {
    setMenuAccessList(dbGetMenuAccess());
  }, []);

  const isFeatureAllowed = (id: string): boolean => {
    const menu = menuAccessList.find(m => m.id === id);
    if (!menu) return true;
    return menu.allowed_roles.includes('industri');
  };

  const [students, setStudents] = useState<PklUser[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<PklUser | null>(null);
  const [journals, setJournals] = useState<PklJournal[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<PklAttendance[]>([]);
  const [evaluations, setEvaluations] = useState<PklEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  // Industry Grading State
  const [gradeTeknis, setGradeTeknis] = useState(0);
  const [gradeNonTeknis, setGradeNonTeknis] = useState(0);
  const [gradeDisiplin, setGradeDisiplin] = useState(0);
  const [gradeCatatan, setGradeCatatan] = useState('');
  const [gradeSuccess, setGradeSuccess] = useState('');

  // Local state for instansi
  const myInstansi = instansiList.find(i => i.id === industry.id_instansi);

  useEffect(() => {
    fetchIndustryData(refreshCounter !== undefined && refreshCounter > 0);
  }, [industry.id_instansi, refreshCounter]);

  const fetchIndustryData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!industry.id_instansi) {
        setStudents([]);
        setLoading(false);
        return;
      }

      // Fetch users and find students in this specific company
      const allUsers = await dbGetUsers();
      const myStudents = allUsers.data.filter(
        u => u.role === 'siswa' && u.id_instansi === industry.id_instansi
      );
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

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStudent = (student: PklUser) => {
    setSelectedStudent(student);
    const evaluation = evaluations.find(e => e.id_siswa === student.id);
    if (evaluation) {
      setGradeTeknis(evaluation.nilai_industri_teknis);
      setGradeNonTeknis(evaluation.nilai_industri_nonteknis);
      setGradeDisiplin(evaluation.nilai_industri_disiplin);
      setGradeCatatan(evaluation.catatan_industri || '');
    } else {
      setGradeTeknis(0);
      setGradeNonTeknis(0);
      setGradeDisiplin(0);
      setGradeCatatan('');
    }
  };

  // Verify journal (diverifikasi / revisi)
  const handleVerifyJournal = async (journal: PklJournal, action: 'diverifikasi' | 'revisi') => {
    const updatedJournal: PklJournal = {
      ...journal,
      status: action,
    };

    const res = await dbSaveJournal(updatedJournal);
    if (res.success) {
      setJournals(prev => prev.map(j => j.id === journal.id ? updatedJournal : j));
    }
  };

  // Verify attendance (disetujui / ditolak)
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

  // Save evaluations
  const handleSaveEvaluations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const existingEval = evaluations.find(e => e.id_siswa === selectedStudent.id);
    const updatedEvaluation: PklEvaluation = {
      id: existingEval?.id || `eval-${Date.now()}`,
      id_siswa: selectedStudent.id,
      nilai_industri_teknis: Number(gradeTeknis),
      nilai_industri_nonteknis: Number(gradeNonTeknis),
      nilai_industri_disiplin: Number(gradeDisiplin),
      nilai_sekolah_laporan: existingEval?.nilai_sekolah_laporan || 0,
      nilai_sekolah_presentasi: existingEval?.nilai_sekolah_presentasi || 0,
      catatan_industri: gradeCatatan,
      catatan_sekolah: existingEval?.catatan_sekolah || ''
    };

    const res = await dbSaveEvaluation(updatedEvaluation);
    if (res.success) {
      setGradeSuccess('Penilaian industri berhasil disimpan!');
      const resEvals = await dbGetEvaluations();
      setEvaluations(resEvals.data);
      setTimeout(() => setGradeSuccess(''), 4000);
    }
  };

  const activeStudentJournals = selectedStudent ? journals.filter(j => j.id_siswa === selectedStudent.id) : [];
  const activeStudentAttendance = selectedStudent ? attendanceLogs.filter(a => a.id_siswa === selectedStudent.id) : [];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm">Memuat Dashboard Mitra Industri...</p>
      </div>
    );
  }

  if (!industry.id_instansi) {
    return (
      <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-rose-800 text-sm flex gap-3 max-w-2xl mx-auto">
        <Info className="w-5 h-5 shrink-0" />
        <div>
          <h4 className="font-bold">Akun Pembimbing Industri Belum Terdaftar ke Instansi!</h4>
          <p className="mt-1">Akun Anda belum dikaitkan dengan instansi/perusahaan PKL oleh Admin Koordinator. Harap hubungi Admin untuk melakukan plotting instansi Anda.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="industry-dashboard">
      
      {/* 1. INDUSTRY PANEL HEADER */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-950 p-6 rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
            Pembimbing Lapangan / Mitra Industri
          </span>
          <h2 className="text-2xl font-bold mt-2 text-white">{industry.nama}</h2>
          <p className="text-sm text-emerald-100/90 mt-1">
            Instansi: <strong>{myInstansi?.nama_instansi || 'Mitra PKL'}</strong> | Alamat: {myInstansi?.alamat}
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-emerald-800/40 px-4 py-3 rounded-xl border border-emerald-700/50 text-center">
            <span className="text-[10px] text-emerald-200 block font-semibold uppercase">Siswa Magang</span>
            <strong className="text-2xl text-white block mt-0.5">{students.length}</strong>
          </div>
          <div className="bg-amber-900/30 px-4 py-3 rounded-xl border border-amber-800/30 text-center">
            <span className="text-[10px] text-amber-200 block font-semibold uppercase font-bold">Absen Pending</span>
            <strong className="text-2xl text-amber-300 block mt-0.5">
              {attendanceLogs.filter(a => a.status_verifikasi === 'pending' && students.some(s => s.id === a.id_siswa)).length}
            </strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: LIST OF STUDENTS IN THIS COMPANY */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" /> Daftar Siswa Magang
            </h3>

            {students.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-6 text-center">Belum ada siswa yang ditempatkan di perusahaan Anda.</p>
            ) : (
              <div className="space-y-1">
                {students.map((stud) => {
                  const isSelected = selectedStudent?.id === stud.id;
                  const hasPendingJour = journals.some(j => j.id_siswa === stud.id && j.status === 'pending');
                  const hasPendingAtt = attendanceLogs.some(a => a.id_siswa === stud.id && a.status_verifikasi === 'pending');
                  return (
                    <button
                      key={stud.id}
                      onClick={() => handleSelectStudent(stud)}
                      className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between text-xs ${
                        isSelected 
                          ? 'bg-emerald-600 text-white font-medium shadow-md shadow-emerald-600/10' 
                          : 'bg-slate-50/60 hover:bg-slate-100/80 text-slate-700'
                      }`}
                    >
                      <div>
                        <p className={`font-semibold ${isSelected ? 'text-white' : 'text-slate-800'}`}>{stud.nama}</p>
                        <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>NISN: {stud.nomor_induk}</p>
                      </div>
                      <div className="flex gap-1">
                        {hasPendingJour && <span className="w-2 h-2 rounded-full bg-amber-500" title="Jurnal baru" />}
                        {hasPendingAtt && <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" title="Absen pending" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: WORK MONITORING PANEL */}
        <div className="lg:col-span-9 space-y-8">
          {selectedStudent ? (
            <div className="space-y-8">
              
              {/* CURRENT ACTIVE STUDENT STATS */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <span className="text-slate-400 text-xs block uppercase font-bold">Memantau Kinerja:</span>
                  <h3 className="text-lg font-bold text-slate-800 mt-0.5">{selectedStudent.nama}</h3>
                  <p className="text-xs text-slate-500">NISN: {selectedStudent.nomor_induk} | Email: {selectedStudent.email}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-center">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase block">Hadir</span>
                    <strong className="text-sm text-slate-700 block">
                      {activeStudentAttendance.filter(a => a.status === 'hadir' && a.status_verifikasi === 'disetujui').length} hari
                    </strong>
                  </div>
                  <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 text-center">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase block">Sakit/Izin</span>
                    <strong className="text-sm text-slate-700 block">
                      {activeStudentAttendance.filter(a => (a.status === 'sakit' || a.status === 'izin') && a.status_verifikasi === 'disetujui').length} hari
                    </strong>
                  </div>
                </div>
              </div>

              {/* THREE MAIN MODULES: JURNAL, PRESENSI, DAN NILAI */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                
                {/* JURNAL & PRESENSI (7 cols) */}
                <div className="md:col-span-8 space-y-8">
                  
                  {/* DAILY JURNALS APPROVAL */}
                  {isFeatureAllowed('industri_jurnal') && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                      <span>Verifikasi Jurnal Harian</span>
                      <span className="text-xs text-slate-400 font-normal">Verifikasi aktivitas harian siswa</span>
                    </h4>

                    {activeStudentJournals.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-6 text-center">Siswa ini belum memposting jurnal kegiatan.</p>
                    ) : (
                      <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                        {activeStudentJournals.map((j) => (
                          <div key={j.id} className="p-4 rounded-xl bg-slate-50/50 border border-slate-100 text-xs space-y-2.5">
                            <div className="flex justify-between items-start gap-4">
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
                              <span className="text-[9px] uppercase font-semibold text-slate-400 block mb-0.5">Ringkasan Kegiatan:</span>
                              {j.ringkasan_belajar}
                            </div>

                            {j.status === 'pending' && (
                              <div className="flex gap-2 justify-end pt-1 border-t border-slate-100">
                                <button
                                  onClick={() => handleVerifyJournal(j, 'revisi')}
                                  className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold"
                                >
                                  Minta Revisi
                                </button>
                                <button
                                  onClick={() => handleVerifyJournal(j, 'diverifikasi')}
                                  className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Verifikasi
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* ATTENDANCE APPROVAL */}
                  {isFeatureAllowed('industri_presensi') && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h4 className="text-sm font-bold text-slate-800 mb-4">Verifikasi Absensi Harian</h4>

                    {activeStudentAttendance.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-6 text-center">Siswa belum memiliki log absensi.</p>
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
                                  {log.status === 'hadir' ? `Jam Masuk: ${log.jam_masuk} | Jam Pulang: ${log.jam_keluar || 'Belum Pulang'}` : `Keterangan: ${log.keterangan || '-'}`}
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
                                      title="Tolak Presensi"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleVerifyAttendance(log, 'disetujui')}
                                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100"
                                      title="Setujui Presensi"
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

                            {/* GPS Mapping Coordinates Display for Industry Representative */}
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
                                    <span className="truncate font-mono text-[9px]">GPS Masuk: {log.latitude.toFixed(5)}, {log.longitude.toFixed(5)}</span>
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
                                    <span className="truncate font-mono text-[9px]">GPS Pulang: {log.latitude_keluar.toFixed(5)}, {log.longitude_keluar.toFixed(5)}</span>
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

                {/* GRADE INPUT (5 cols) */}
                <div className="md:col-span-4 space-y-6">
                  
                  {isFeatureAllowed('industri_nilai') && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1">
                      <Star className="w-4 h-4 text-emerald-600" /> Penilaian Magang Industri
                    </h4>

                    <form onSubmit={handleSaveEvaluations} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-500 mb-1">Nilai Aspek Kerja/Teknis (0-100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          required
                          value={gradeTeknis}
                          onChange={(e) => setGradeTeknis(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-500 mb-1">Nilai Soft Skill/Kerja Sama (0-100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          required
                          value={gradeNonTeknis}
                          onChange={(e) => setGradeNonTeknis(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-500 mb-1">Nilai Sikap/Kedisiplinan (0-100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          required
                          value={gradeDisiplin}
                          onChange={(e) => setGradeDisiplin(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-500 mb-1">Testimoni / Catatan Industri</label>
                        <textarea
                          rows={3}
                          value={gradeCatatan}
                          onChange={(e) => setGradeCatatan(e.target.value)}
                          placeholder="Beri komentar bimbingan, keahlian utama, atau rekomendasi kerja..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:outline-none bg-white text-slate-800"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-all"
                      >
                        Simpan Nilai Industri
                      </button>

                      {gradeSuccess && <p className="text-[10px] text-emerald-600 font-semibold">{gradeSuccess}</p>}
                    </form>
                  </div>
                  )}

                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
              <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="font-semibold text-slate-600 text-sm">Pilih Siswa Magang Anda</p>
              <p className="text-xs text-slate-400 mt-1">Gunakan panel di sebelah kiri untuk memonitor jurnal harian, memverifikasi absen masuk/pulang, dan menginput nilai akhir.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
