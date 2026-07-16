import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertTriangle, Copy, Check, RefreshCw, HelpCircle, Key, Link } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, isSupabaseConnected, getSupabaseClient } from '../supabaseClient';
import { SUPABASE_SQL_SCHEMA, syncLocalDataToSupabase } from '../utils/localDb';

interface SupabaseConfigProps {
  onConfigChanged: () => void;
}

export default function SupabaseConfig({ onConfigChanged }: SupabaseConfigProps) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });
  const [showSql, setShowSql] = useState(false);
  const [diagStatus, setDiagStatus] = useState<'idle' | 'testing' | 'done'>('idle');
  const [diagResults, setDiagResults] = useState<Array<{ table: string, status: 'ok' | 'rls_blocked' | 'missing' | 'error', details: string }>>([]);

  useEffect(() => {
    const config = getSupabaseConfig();
    if (config) {
      setUrl(config.url);
      setAnonKey(config.anonKey);
    }
    setIsConnected(isSupabaseConnected());
  }, []);

  const handleDiagnose = async () => {
    setDiagStatus('testing');
    const sb = getSupabaseClient();
    if (!sb) {
      alert('Koneksi Supabase belum aktif atau terkonfigurasi!');
      setDiagStatus('idle');
      return;
    }

    const tables = [
      { name: 'pkl_instansi', displayName: 'Daftar Instansi (pkl_instansi)' },
      { name: 'pkl_users', displayName: 'Data Pengguna (pkl_users)' },
      { name: 'pkl_placements', displayName: 'Penempatan PKL (pkl_placements)' },
      { name: 'pkl_journals', displayName: 'Jurnal Kegiatan (pkl_journals)' },
      { name: 'pkl_attendance', displayName: 'Presensi Kehadiran (pkl_attendance)' },
      { name: 'pkl_evaluations', displayName: 'Nilai & Evaluasi (pkl_evaluations)' },
      { name: 'pkl_announcements', displayName: 'Pengumuman (pkl_announcements)' },
      { name: 'pkl_classes', displayName: 'Master Kelas (pkl_classes)' },
      { name: 'pkl_teacher_monitoring', displayName: 'Monitoring Guru (pkl_teacher_monitoring)' }
    ];

    const results: Array<{ table: string, status: 'ok' | 'rls_blocked' | 'missing' | 'error', details: string }> = [];

    for (const t of tables) {
      try {
        const { data, error: selectError } = await sb.from(t.name).select('*').limit(1);
        
        if (selectError) {
          if (selectError.code === '42P01' || selectError.message?.includes('relation') || selectError.message?.includes('does not exist')) {
            results.push({
              table: t.displayName,
              status: 'missing',
              details: `Tabel belum dibuat di database Anda. Silakan jalankan SQL schema di sebelah kanan.`
            });
            continue;
          } else if (selectError.code === '42501') {
            results.push({
              table: t.displayName,
              status: 'rls_blocked',
              details: `Row Level Security (RLS) aktif dan memblokir akses baca (SELECT).`
            });
            continue;
          } else {
            results.push({
              table: t.displayName,
              status: 'error',
              details: `Gagal membaca tabel: ${selectError.message}`
            });
            continue;
          }
        }

        const fakeId = '00000000-0000-0000-0000-000000000000';
        let writeError: any = null;
        
        if (t.name === 'pkl_classes') {
          const { error } = await sb.from('pkl_classes').insert({ id: fakeId, nama_kelas: 'DIAG_TEMP_CLASS', jurusan: 'DIAG' });
          writeError = error;
          if (!error) {
            await sb.from('pkl_classes').delete().eq('id', fakeId);
          }
        } else if (t.name === 'pkl_instansi') {
          const { error } = await sb.from('pkl_instansi').insert({ id: fakeId, nama_instansi: 'DIAG_TEMP', alamat: 'DIAG', kuota: 1 });
          writeError = error;
          if (!error) {
            await sb.from('pkl_instansi').delete().eq('id', fakeId);
          }
        } else if (t.name === 'pkl_teacher_monitoring') {
          const { error } = await sb.from('pkl_teacher_monitoring').insert({ id: fakeId, id_guru: 'DIAG', nama_guru: 'DIAG', tanggal: '2026-07-16', jam_monitoring: '12:00:00', tipe_monitoring: 'Monitoring 1' });
          writeError = error;
          if (!error) {
            await sb.from('pkl_teacher_monitoring').delete().eq('id', fakeId);
          }
        } else {
          // General write test fallback
          const { error } = await sb.from(t.name).insert({ id: fakeId }).select();
          if (error) {
            writeError = error;
          } else {
            await sb.from(t.name).delete().eq('id', fakeId);
          }
        }

        if (writeError && (writeError.code === '42501' || writeError.message?.includes('policy') || writeError.message?.includes('row-level security'))) {
          results.push({
            table: t.displayName,
            status: 'rls_blocked',
            details: `Akses tulis (INSERT/UPSERT) diblokir oleh kebijakan Row Level Security (RLS).`
          });
        } else if (writeError && (writeError.code === '42P01' || writeError.message?.includes('relation') || writeError.message?.includes('does not exist'))) {
          results.push({
            table: t.displayName,
            status: 'missing',
            details: `Tabel belum dibuat di database Anda.`
          });
        } else {
          results.push({
            table: t.displayName,
            status: 'ok',
            details: `Tabel siap digunakan. Koneksi baca & tulis berjalan lancar.`
          });
        }
      } catch (err: any) {
        results.push({
          table: t.displayName,
          status: 'error',
          details: `Error: ${err?.message || String(err)}`
        });
      }
    }

    setDiagResults(results);
    setDiagStatus('done');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      alert('Silakan isi kedua bidang (URL dan Anon Key)');
      return;
    }
    saveSupabaseConfig(url, anonKey);
    setIsConnected(true);
    onConfigChanged();
    alert('Konfigurasi Supabase berhasil disimpan! Mencoba menghubungkan...');
  };

  const handleDisconnect = () => {
    if (confirm('Apakah Anda yakin ingin memutuskan koneksi Supabase? Aplikasi akan kembali menggunakan mode penyimpanan lokal.')) {
      saveSupabaseConfig('', '');
      setUrl('');
      setAnonKey('');
      setIsConnected(false);
      onConfigChanged();
    }
  };

  const handleSync = async () => {
    setSyncStatus({ type: 'loading', message: 'Sedang mensinkronisasikan data...' });
    const result = await syncLocalDataToSupabase();
    if (result.success) {
      setSyncStatus({ type: 'success', message: result.message });
      setTimeout(() => setSyncStatus({ type: 'idle', message: '' }), 5000);
    } else {
      setSyncStatus({ type: 'error', message: result.message });
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-4xl mx-auto" id="supabase-config-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-800">Koneksi Database Supabase</h2>
            <p className="text-sm text-slate-500">Integrasikan aplikasi SIM PKL dengan database cloud Anda sendiri.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start md:self-center">
          {isConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <CheckCircle2 className="w-3.5 h-3.5" /> Terhubung ke Supabase
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
              <AlertTriangle className="w-3.5 h-3.5" /> Mode Demo Offline
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
            {isConnected ? (
              <p>
                <strong>Koneksi Aktif!</strong> Aplikasi sedang mencoba membaca & menulis data langsung ke Supabase Anda. 
                Jika tabel belum dibuat, silakan jalankan SQL schema di panel sebelah kanan terlebih dahulu.
              </p>
            ) : (
              <p>
                Aplikasi saat ini berjalan dalam <strong>Mode Demo Offline (Local Storage)</strong>. 
                Anda bisa bebas menguji coba semua fitur (input jurnal, presensi, pengumuman, plotting guru, input nilai) 
                karena data disimpan di browser Anda secara lokal. Hubungkan ke Supabase Anda untuk menyimpan data ke cloud secara permanen.
              </p>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Link className="w-3 h-3 text-slate-400" /> SUPABASE_URL
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Key className="w-3 h-3 text-slate-400" /> SUPABASE_ANON_KEY
              </label>
              <input
                type="password"
                required
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsIn..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-all shadow-sm shadow-indigo-600/10"
              >
                Simpan & Hubungkan
              </button>
              
              {isConnected && (
                <>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-all"
                  >
                    Putuskan Koneksi
                  </button>

                  <button
                    type="button"
                    onClick={handleDiagnose}
                    disabled={diagStatus === 'testing'}
                    className="px-5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-medium transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-4 h-4 ${diagStatus === 'testing' ? 'animate-spin' : ''}`} />
                    Diagnosis RLS & Tabel
                  </button>

                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncStatus.type === 'loading'}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-600/10"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncStatus.type === 'loading' ? 'animate-spin' : ''}`} />
                    Sinkronisasi Data Lokal ke Supabase
                  </button>
                </>
              )}
            </div>
          </form>

          {diagStatus !== 'idle' && (
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 mt-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/50 pb-3">
                <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Laporan Diagnosis Database & RLS
                </h4>
                {diagStatus === 'testing' ? (
                  <span className="text-xs text-indigo-600 flex items-center gap-1.5 font-medium animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Sedang memeriksa tabel...
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleDiagnose}
                    className="text-xs text-indigo-600 hover:underline font-semibold"
                  >
                    Uji Ulang
                  </button>
                )}
              </div>

              {diagStatus === 'testing' ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  Sedang menjalankan kueri pengujian pada semua tabel Supabase Anda...
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {diagResults.map((r, idx) => (
                      <div key={idx} className="bg-white p-3.5 rounded-xl border border-slate-100 flex items-start gap-3">
                        <div className="mt-0.5">
                          {r.status === 'ok' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : r.status === 'rls_blocked' ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-xs truncate">{r.table}</p>
                          <p className={`text-[11px] mt-0.5 ${
                            r.status === 'ok' ? 'text-emerald-600' :
                            r.status === 'rls_blocked' ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {r.details}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {diagResults.some(r => r.status === 'rls_blocked') && (
                    <div className="bg-amber-50 border border-amber-200/50 p-4 rounded-xl space-y-2.5 text-xs text-amber-900 leading-relaxed mt-2">
                      <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                        <AlertTriangle className="w-4 h-4" /> Masalah Row Level Security (RLS) Terdeteksi!
                      </p>
                      <p>
                        Supabase mengaktifkan RLS secara default untuk melindungi data. Namun, untuk aplikasi demo ini agar dapat berjalan mandiri, RLS harus dinonaktifkan pada tabel-tabel di atas.
                      </p>
                      <p className="font-semibold text-amber-800">
                        Solusi Mudah: Salin dan jalankan perintah SQL berikut di SQL Editor Supabase Anda:
                      </p>
                      <div className="bg-slate-900 text-amber-200 font-mono p-3 rounded-lg text-[11px] overflow-x-auto border border-slate-800 relative">
                        <button
                          type="button"
                          onClick={() => {
                            const sql = `ALTER TABLE pkl_instansi DISABLE ROW LEVEL SECURITY;\nALTER TABLE pkl_users DISABLE ROW LEVEL SECURITY;\nALTER TABLE pkl_placements DISABLE ROW LEVEL SECURITY;\nALTER TABLE pkl_journals DISABLE ROW LEVEL SECURITY;\nALTER TABLE pkl_attendance DISABLE ROW LEVEL SECURITY;\nALTER TABLE pkl_evaluations DISABLE ROW LEVEL SECURITY;\nALTER TABLE pkl_announcements DISABLE ROW LEVEL SECURITY;\nALTER TABLE pkl_classes DISABLE ROW LEVEL SECURITY;`;
                            navigator.clipboard.writeText(sql);
                            alert('Perintah SQL penonaktifan RLS berhasil disalin!');
                          }}
                          className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[10px]"
                        >
                          Salin SQL RLS
                        </button>
                        <pre>{`ALTER TABLE pkl_instansi DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_placements DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_journals DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_classes DISABLE ROW LEVEL SECURITY;`}</pre>
                      </div>
                      <p className="text-[11px] text-amber-700">
                        * Setelah menjalankan SQL di atas, silakan klik tombol <strong>"Uji Ulang"</strong> untuk memverifikasi koneksi database Anda.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {syncStatus.type !== 'idle' && (
            <div className={`p-4 rounded-xl text-sm border flex items-start gap-2.5 ${
              syncStatus.type === 'loading' ? 'bg-blue-50 text-blue-800 border-blue-100' :
              syncStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
              'bg-rose-50 text-rose-800 border-rose-100'
            }`}>
              {syncStatus.type === 'loading' && <RefreshCw className="w-4 h-4 animate-spin mt-0.5" />}
              {syncStatus.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" />}
              {syncStatus.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5" />}
              <div>
                <p className="font-semibold">{syncStatus.type === 'loading' ? 'Sinkronisasi Berjalan' : syncStatus.type === 'success' ? 'Sinkronisasi Berhasil!' : 'Sinkronisasi Gagal'}</p>
                <p className="text-xs mt-0.5 leading-relaxed">{syncStatus.message}</p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-indigo-950 text-indigo-100 p-5 rounded-2xl border border-indigo-900 space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2 text-sm uppercase tracking-wider">
              <HelpCircle className="w-4 h-4 text-indigo-400" /> Cara Setup Supabase:
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-xs text-indigo-200 leading-relaxed">
              <li>Buat proyek baru di <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline font-semibold">supabase.com</a></li>
              <li>Buka menu <strong>SQL Editor</strong> di dashboard Supabase Anda.</li>
              <li>Klik <strong>New Query</strong>, tempelkan skema SQL yang ada di bawah ini.</li>
              <li>Klik <strong>Run</strong> untuk membuat tabel & relasi database.</li>
              <li>Buka menu <strong>Project Settings &gt; API</strong> untuk menyalin URL & Anon Key, lalu masukkan ke panel kiri ini.</li>
            </ol>
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSql(!showSql)}
              className="w-full px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-all flex items-center justify-between text-sm font-semibold text-slate-700"
            >
              <span>Skema SQL Database (DDL)</span>
              <span className="text-xs text-indigo-600 hover:underline">{showSql ? 'Sembunyikan' : 'Tampilkan'}</span>
            </button>

            {showSql && (
              <div className="p-4 bg-slate-900 text-slate-300 font-mono text-xs max-h-[250px] overflow-y-auto relative">
                <button
                  onClick={handleCopySql}
                  className="absolute top-3 right-3 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white transition-all flex items-center gap-1"
                  title="Salin SQL Schema"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Tersalin' : 'Salin'}</span>
                </button>
                <pre className="whitespace-pre-wrap">{SUPABASE_SQL_SCHEMA}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
