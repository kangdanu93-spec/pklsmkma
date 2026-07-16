import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PklUser, PklInstansi, PklEvaluation, PklAttendance } from '../types';
import { BarChart2, PieChart as PieIcon, Award, Activity } from 'lucide-react';

interface StatsDashboardProps {
  users: PklUser[];
  instansiList: PklInstansi[];
  evaluations: PklEvaluation[];
  attendanceLogs: PklAttendance[];
}

export default function StatsDashboard({ users, instansiList, evaluations, attendanceLogs }: StatsDashboardProps) {
  const students = users.filter(u => u.role === 'siswa');

  // 1. Chart: Siswa per Instansi
  const studentsPerCompanyData = instansiList.map(inst => {
    const count = students.filter(s => s.id_instansi === inst.id).length;
    return {
      name: inst.nama_instansi.length > 15 ? `${inst.nama_instansi.substring(0, 15)}...` : inst.nama_instansi,
      'Jumlah Siswa': count,
      'Kuota Maksimal': inst.kuota
    };
  });

  // 2. Chart: Distribusi Absensi
  const attendanceVerified = attendanceLogs.filter(a => a.status_verifikasi === 'disetujui' || a.status_verifikasi === 'pending');
  const hadirCount = attendanceVerified.filter(a => a.status === 'hadir').length;
  const sakitCount = attendanceVerified.filter(a => a.status === 'sakit').length;
  const izinCount = attendanceVerified.filter(a => a.status === 'izin').length;
  const alfaCount = attendanceVerified.filter(a => a.status === 'alfa').length;

  const attendanceDistributionData = [
    { name: 'Hadir', value: hadirCount || 1, color: '#10B981' }, // emerald-500
    { name: 'Sakit', value: sakitCount, color: '#F59E0B' }, // amber-500
    { name: 'Izin', value: izinCount, color: '#3B82F6' }, // blue-500
    { name: 'Alfa', value: alfaCount, color: '#EF4444' }  // red-500
  ].filter(item => item.value > 0);

  // 3. Chart: Perbandingan Nilai Akhir Siswa
  const gradeComparisonData = evaluations.map(e => {
    const student = students.find(s => s.id === e.id_siswa);
    const avgIndustry = (e.nilai_industri_teknis + e.nilai_industri_nonteknis + e.nilai_industri_disiplin) / 3;
    const avgSchool = (e.nilai_sekolah_laporan + e.nilai_sekolah_presentasi) / 2;
    return {
      name: student ? student.nama.split(' ')[0] : 'Siswa',
      'Nilai Mitra Industri': Number(avgIndustry.toFixed(1)),
      'Nilai Guru Sekolah': Number(avgSchool.toFixed(1)),
    };
  });

  // Stats Counters
  const totalStudents = students.length;
  const studentsPlacedCount = students.filter(s => s.id_instansi).length;
  const placementRate = totalStudents > 0 ? ((studentsPlacedCount / totalStudents) * 100).toFixed(0) : 0;
  
  const averageTotalGrade = evaluations.length > 0 ? (
    evaluations.reduce((sum, e) => {
      const avg = (e.nilai_industri_teknis + e.nilai_industri_nonteknis + e.nilai_industri_disiplin + e.nilai_sekolah_laporan + e.nilai_sekolah_presentasi) / 5;
      return sum + avg;
    }, 0) / evaluations.length
  ).toFixed(1) : '0';

  return (
    <div className="space-y-6" id="stats-dashboard">
      
      {/* STATS STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-600 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Tingkat Penempatan</span>
            <strong className="text-xl text-slate-800">{placementRate}%</strong>
            <span className="text-[9px] text-slate-500 block mt-0.5">{studentsPlacedCount} dari {totalStudents} terplot</span>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Rata-rata Nilai</span>
            <strong className="text-xl text-slate-800">{averageTotalGrade}</strong>
            <span className="text-[9px] text-slate-500 block mt-0.5">Skala 100 dari {evaluations.length} dinilai</span>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-lg">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Total Hari Kehadiran</span>
            <strong className="text-xl text-slate-800">{hadirCount}</strong>
            <span className="text-[9px] text-slate-500 block mt-0.5">Total presensi terverifikasi</span>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-lg">
            <PieIcon className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Jumlah Sakit / Izin</span>
            <strong className="text-xl text-slate-800">{sakitCount + izinCount}</strong>
            <span className="text-[9px] text-slate-500 block mt-0.5">Kehadiran bersurat resmi</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART: SISWA PER PERUSAHAAN (8 cols) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <BarChart2 className="w-4 h-4 text-indigo-600" /> Distribusi Siswa PKL & Kuota per Instansi
          </h4>
          <div className="h-[250px] text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentsPerCompanyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                <YAxis stroke="#94A3B8" fontSize={10} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, borderColor: '#F1F5F9' }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="Jumlah Siswa" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Kuota Maksimal" fill="#CBD5E1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART: DISTRIBUSI ABSENSI (4 cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <PieIcon className="w-4 h-4 text-emerald-600" /> Proporsi Kehadiran
          </h4>
          <div className="h-[180px] relative text-xs flex justify-center items-center">
            {attendanceDistributionData.length === 0 ? (
              <p className="text-slate-400 italic">Belum ada data presensi.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={attendanceDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {attendanceDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} hari`, 'Frekuensi']} contentStyle={{ fontSize: 10, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] border-t border-slate-50 pt-3">
            {attendanceDistributionData.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 font-medium truncate">{item.name}: <strong>{item.value}d</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* CHART: PERBANDINGAN NILAI (12 cols) */}
        {gradeComparisonData.length > 0 && (
          <div className="lg:col-span-12 bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Award className="w-4 h-4 text-indigo-600" /> Perbandingan Penilaian: Mitra Industri vs. Guru Sekolah
            </h4>
            <div className="h-[250px] text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeComparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                  <YAxis stroke="#94A3B8" fontSize={10} domain={[0, 100]} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="Nilai Mitra Industri" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Nilai Guru Sekolah" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
