import { getSupabaseClient, getSupabaseNoSessionClient } from '../supabaseClient';
import { 
  PklUser, PklInstansi, PklPlacement, PklJournal, PklAttendance, PklEvaluation, Announcement, PklClass 
} from '../types';

// SQL migration schema to show in the UI for users to copy/paste into Supabase
export const SUPABASE_SQL_SCHEMA = `-- SIM PKL (Sistem Informasi Manajemen Praktik Kerja Lapangan) DDL Schema
-- Salin dan jalankan script ini di SQL Editor Supabase Anda untuk membuat tabel.

-- 1. TABEL INSTANSI/TEMPAT PKL
CREATE TABLE IF NOT EXISTS pkl_instansi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_instansi TEXT NOT NULL,
  alamat TEXT NOT NULL,
  kuota INTEGER NOT NULL DEFAULT 1,
  pembimbing_nama TEXT,
  pembimbing_telp TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABEL PENGGUNA (USERS)
CREATE TABLE IF NOT EXISTS pkl_users (
  id TEXT PRIMARY KEY, -- Menggunakan email atau id auth Supabase
  email TEXT UNIQUE NOT NULL,
  password TEXT DEFAULT 'password123', -- Sandi login pengguna
  nama TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('siswa', 'guru', 'industri', 'admin')),
  nomor_induk TEXT NOT NULL, -- NISN untuk siswa, NIP/NIK untuk guru/industri
  telepon TEXT NOT NULL,
  kelas TEXT, -- Kelas untuk siswa (contoh: XII RPL 1)
  jurusan TEXT, -- Jurusan untuk siswa (contoh: Rekayasa Perangkat Lunak)
  id_instansi UUID REFERENCES pkl_instansi(id) ON DELETE SET NULL,
  id_pembimbing TEXT REFERENCES pkl_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan kolom password ada jika tabel sudah pernah dibuat sebelumnya tanpa kolom tersebut
ALTER TABLE pkl_users ADD COLUMN IF NOT EXISTS password TEXT DEFAULT 'password123';
ALTER TABLE pkl_users ADD COLUMN IF NOT EXISTS kelas TEXT;
ALTER TABLE pkl_users ADD COLUMN IF NOT EXISTS jurusan TEXT;

-- 3. TABEL PENGAJUAN / PLACEMENT PKL
CREATE TABLE IF NOT EXISTS pkl_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_siswa TEXT NOT NULL REFERENCES pkl_users(id) ON DELETE CASCADE,
  id_instansi UUID NOT NULL REFERENCES pkl_instansi(id) ON DELETE CASCADE,
  tanggal_mulai DATE NOT NULL,
  tanggal_selesai DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'disetujui', 'ditolak')),
  catatan TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABEL JURNAL KEGIATAN HARIAN
CREATE TABLE IF NOT EXISTS pkl_journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_siswa TEXT NOT NULL REFERENCES pkl_users(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  kegiatan TEXT NOT NULL,
  ringkasan_belajar TEXT NOT NULL,
  foto_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'diverifikasi', 'revisi')),
  catatan_pembimbing TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABEL PRESENSI / KEHADIRAN HARIAN
CREATE TABLE IF NOT EXISTS pkl_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_siswa TEXT NOT NULL REFERENCES pkl_users(id) ON DELETE CASCADE,
  tanggal DATE NOT NULL,
  jam_masuk TIME NOT NULL,
  jam_keluar TIME,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'sakit', 'izin', 'alfa')),
  keterangan TEXT,
  status_verifikasi TEXT NOT NULL DEFAULT 'pending' CHECK (status_verifikasi IN ('pending', 'disetujui', 'ditolak')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABEL EVALUASI / NILAI AKHIR
CREATE TABLE IF NOT EXISTS pkl_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_siswa TEXT NOT NULL UNIQUE REFERENCES pkl_users(id) ON DELETE CASCADE,
  nilai_industri_teknis NUMERIC NOT NULL DEFAULT 0,
  nilai_industri_nonteknis NUMERIC NOT NULL DEFAULT 0,
  nilai_industri_disiplin NUMERIC NOT NULL DEFAULT 0,
  nilai_sekolah_laporan NUMERIC NOT NULL DEFAULT 0,
  nilai_sekolah_presentasi NUMERIC NOT NULL DEFAULT 0,
  catatan_industri TEXT,
  catatan_sekolah TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. TABEL PENGUMUMAN
CREATE TABLE IF NOT EXISTS pkl_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judul TEXT NOT NULL,
  konten TEXT NOT NULL,
  tanggal DATE NOT NULL,
  author TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABEL MASTER KELAS
CREATE TABLE IF NOT EXISTS pkl_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_kelas TEXT UNIQUE NOT NULL,
  jurusan TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Nonaktifkan RLS agar aplikasi dapat membaca dan menulis data tanpa kendala Policy (untuk mode demo/sandbox)
ALTER TABLE pkl_instansi DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_placements DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_journals DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_evaluations DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_classes DISABLE ROW LEVEL SECURITY;

-- Tambahkan master kelas awal
INSERT INTO pkl_classes (id, nama_kelas, jurusan) VALUES
('c1123bc4-56de-78fa-90bc-123456789abc', 'XII RPL 1', 'Rekayasa Perangkat Lunak'),
('c2123bc4-56de-78fa-90bc-123456789abc', 'XII RPL 2', 'Rekayasa Perangkat Lunak'),
('c3123bc4-56de-78fa-90bc-123456789abc', 'XII TKJ 1', 'Teknik Komputer & Jaringan'),
('c4123bc4-56de-78fa-90bc-123456789abc', 'XII TKJ 2', 'Teknik Komputer & Jaringan'),
('c5123bc4-56de-78fa-90bc-123456789abc', 'XII TKR', 'Teknik Kendaraan Ringan'),
('c6123bc4-56de-78fa-90bc-123456789abc', 'XII DKV', 'Desain Komunikasi Visual')
ON CONFLICT (nama_kelas) DO NOTHING;

-- Tambahkan beberapa data instansi awal
INSERT INTO pkl_instansi (id, nama_instansi, alamat, kuota, pembimbing_nama, pembimbing_telp) VALUES
('8a123bc4-56de-78fa-90bc-123456789abc', 'PT. Solusi Digital', 'Jl. Tekno No. 10, Jakarta', 5, 'Joko Prasetyo', '081234567800'),
('9b123bc4-56de-78fa-90bc-123456789abc', 'Bank Mandiri Cabang Utama', 'Jl. Sudirman No. 50, Jakarta', 3, 'Lisa Amalia', '081234567801'),
('a3123bc4-56de-78fa-90bc-123456789abc', 'PT. Telkom Indonesia', 'Jl. Pemuda No. 1, Bandung', 4, 'Budi Santoso', '081234567802')
ON CONFLICT (id) DO NOTHING;

-- Tambahkan data pengguna awal
INSERT INTO pkl_users (id, email, password, nama, role, nomor_induk, telepon, kelas, jurusan, id_instansi, id_pembimbing) VALUES
('admin@simpkl.com', 'admin@simpkl.com', 'password123', 'Danu Prasetyo (Koordinator)', 'admin', 'NIP990022', '081122334455', NULL, NULL, NULL, NULL),
('budi@simpkl.com', 'budi@simpkl.com', 'password123', 'Drs. Budi Santoso', 'guru', 'NIP19750821', '081211223344', NULL, NULL, NULL, NULL),
('sri@simpkl.com', 'sri@simpkl.com', 'password123', 'Sri Wahyuni M.Kom', 'guru', 'NIP19820412', '081299887766', NULL, NULL, NULL, NULL),
('joko@solusidigital.com', 'joko@solusidigital.com', 'password123', 'Joko Prasetyo (PT. Solusi Digital)', 'industri', 'NIKSD098', '081234567800', NULL, NULL, '8a123bc4-56de-78fa-90bc-123456789abc', NULL),
('lisa@bankmandiri.com', 'lisa@bankmandiri.com', 'password123', 'Lisa Amalia (Bank Mandiri)', 'industri', 'NIKBM743', '081234567801', NULL, NULL, '9b123bc4-56de-78fa-90bc-123456789abc', NULL),
('ahmad@simpkl.com', 'ahmad@simpkl.com', 'password123', 'Ahmad Fauzi', 'siswa', 'NISN0062345', '085711223344', 'XII RPL 1', 'Rekayasa Perangkat Lunak', '8a123bc4-56de-78fa-90bc-123456789abc', 'budi@simpkl.com'),
('rina@simpkl.com', 'rina@simpkl.com', 'password123', 'Rina Wijaya', 'siswa', 'NISN0063456', '085755667788', 'XII TKJ 2', 'Teknik Komputer & Jaringan', '9b123bc4-56de-78fa-90bc-123456789abc', 'sri@simpkl.com'),
('dani@simpkl.com', 'dani@simpkl.com', 'password123', 'Dani Setiawan', 'siswa', 'NISN0064567', '085799001122', 'XII RPL 2', 'Rekayasa Perangkat Lunak', NULL, 'budi@simpkl.com')
ON CONFLICT (id) DO NOTHING;
`;

// Initial seed data for local storage
const INITIAL_INSTANSI: PklInstansi[] = [
  { id: 'inst-1', nama_instansi: 'PT. Solusi Digital', alamat: 'Jl. Tekno Raya No. 10, Jakarta Selatan', kuota: 5, pembimbing_nama: 'Joko Prasetyo', pembimbing_telp: '081234567800' },
  { id: 'inst-2', nama_instansi: 'Bank Mandiri Tbk', alamat: 'Jl. Jenderal Sudirman Kav 52-53, Jakarta Pusat', kuota: 3, pembimbing_nama: 'Lisa Amalia', pembimbing_telp: '081234567801' },
  { id: 'inst-3', nama_instansi: 'PT. Telkom Indonesia', alamat: 'Jl. Japati No. 1, Bandung, Jawa Barat', kuota: 4, pembimbing_nama: 'Rendra Siregar', pembimbing_telp: '081234567802' },
];

const INITIAL_USERS: PklUser[] = [
  // Admin
  { id: 'admin@simpkl.com', email: 'admin@simpkl.com', password: 'password123', nama: 'Danu Prasetyo (Koordinator)', role: 'admin', nomor_induk: 'NIP990022', telepon: '081122334455' },
  // Guru
  { id: 'budi@simpkl.com', email: 'budi@simpkl.com', password: 'password123', nama: 'Drs. Budi Santoso', role: 'guru', nomor_induk: 'NIP19750821', telepon: '081211223344' },
  { id: 'sri@simpkl.com', email: 'sri@simpkl.com', password: 'password123', nama: 'Sri Wahyuni M.Kom', role: 'guru', nomor_induk: 'NIP19820412', telepon: '081299887766' },
  // Industri
  { id: 'joko@solusidigital.com', email: 'joko@solusidigital.com', password: 'password123', nama: 'Joko Prasetyo (PT. Solusi Digital)', role: 'industri', nomor_induk: 'NIKSD098', telepon: '081234567800', id_instansi: 'inst-1' },
  { id: 'lisa@bankmandiri.com', email: 'lisa@bankmandiri.com', password: 'password123', nama: 'Lisa Amalia (Bank Mandiri)', role: 'industri', nomor_induk: 'NIKBM743', telepon: '081234567801', id_instansi: 'inst-2' },
  // Siswa
  { id: 'ahmad@simpkl.com', email: 'ahmad@simpkl.com', password: 'password123', nama: 'Ahmad Fauzi', role: 'siswa', nomor_induk: 'NISN0062345', telepon: '085711223344', kelas: 'XII RPL 1', jurusan: 'Rekayasa Perangkat Lunak', id_instansi: 'inst-1', id_pembimbing: 'budi@simpkl.com' },
  { id: 'rina@simpkl.com', email: 'rina@simpkl.com', password: 'password123', nama: 'Rina Wijaya', role: 'siswa', nomor_induk: 'NISN0063456', telepon: '085755667788', kelas: 'XII TKJ 2', jurusan: 'Teknik Komputer & Jaringan', id_instansi: 'inst-2', id_pembimbing: 'sri@simpkl.com' },
  { id: 'dani@simpkl.com', email: 'dani@simpkl.com', password: 'password123', nama: 'Dani Setiawan', role: 'siswa', nomor_induk: 'NISN0064567', telepon: '085799001122', kelas: 'XII RPL 2', jurusan: 'Rekayasa Perangkat Lunak', id_pembimbing: 'budi@simpkl.com' }, // belum PKL
];

const INITIAL_PLACEMENTS: PklPlacement[] = [
  { id: 'place-1', id_siswa: 'ahmad@simpkl.com', id_instansi: 'inst-1', tanggal_mulai: '2026-07-01', tanggal_selesai: '2026-10-01', status: 'disetujui', catatan: 'Penempatan di divisi Mobile Developer.' },
  { id: 'place-2', id_siswa: 'rina@simpkl.com', id_instansi: 'inst-2', tanggal_mulai: '2026-07-01', tanggal_selesai: '2026-10-01', status: 'disetujui', catatan: 'Penempatan di divisi IT Support.' },
  { id: 'place-3', id_siswa: 'dani@simpkl.com', id_instansi: 'inst-3', tanggal_mulai: '2026-08-01', tanggal_selesai: '2026-11-01', status: 'pending', catatan: 'Mengajukan magang di Web Developer.' },
];

const INITIAL_JOURNALS: PklJournal[] = [
  { id: 'jour-1', id_siswa: 'ahmad@simpkl.com', tanggal: '2026-07-01', kegiatan: 'Pengenalan tim dan pembagian tugas proyek', ringkasan_belajar: 'Mempelajari arsitektur aplikasi dan Git Workflow perusahaan.', status: 'diverifikasi', catatan_pembimbing: 'Bagus, terus tingkatkan koordinasi tim.' },
  { id: 'jour-2', id_siswa: 'ahmad@simpkl.com', tanggal: '2026-07-02', kegiatan: 'Slicing UI Dashboard siswa menggunakan Tailwind', ringkasan_belajar: 'Mendalami flexbox, grid, dan komponen responsif Tailwind.', status: 'diverifikasi', catatan_pembimbing: 'Slicing cukup rapi.' },
  { id: 'jour-3', id_siswa: 'ahmad@simpkl.com', tanggal: '2026-07-03', kegiatan: 'Integrasi API auth dan mock state data', ringkasan_belajar: 'Belajar me-manage state lokal React dan integrasi client-side.', status: 'pending' },
  { id: 'jour-4', id_siswa: 'rina@simpkl.com', tanggal: '2026-07-01', kegiatan: 'Membantu instalasi OS dan software kerja baru', ringkasan_belajar: 'Belajar konfigurasi Windows Enterprise dan penanganan masalah driver.', status: 'diverifikasi' },
  { id: 'jour-5', id_siswa: 'rina@simpkl.com', tanggal: '2026-07-02', kegiatan: ' Troubleshooting koneksi jaringan divisi keuangan', ringkasan_belajar: 'Mempelajari crimping RJ45, pengujian ping, dan reset modem.', status: 'pending' },
];

const INITIAL_ATTENDANCE: PklAttendance[] = [
  { id: 'att-1', id_siswa: 'ahmad@simpkl.com', tanggal: '2026-07-01', jam_masuk: '07:55', jam_keluar: '17:00', status: 'hadir', status_verifikasi: 'disetujui' },
  { id: 'att-2', id_siswa: 'ahmad@simpkl.com', tanggal: '2026-07-02', jam_masuk: '07:45', jam_keluar: '17:05', status: 'hadir', status_verifikasi: 'disetujui' },
  { id: 'att-3', id_siswa: 'ahmad@simpkl.com', tanggal: '2026-07-03', jam_masuk: '08:00', jam_keluar: '17:00', status: 'hadir', status_verifikasi: 'pending' },
  { id: 'att-4', id_siswa: 'rina@simpkl.com', tanggal: '2026-07-01', jam_masuk: '07:30', jam_keluar: '16:30', status: 'hadir', status_verifikasi: 'disetujui' },
  { id: 'att-5', id_siswa: 'rina@simpkl.com', tanggal: '2026-07-02', jam_masuk: '07:40', status: 'hadir', status_verifikasi: 'pending' },
];

const INITIAL_EVALUATIONS: PklEvaluation[] = [
  { id: 'eval-1', id_siswa: 'ahmad@simpkl.com', nilai_industri_teknis: 88, nilai_industri_nonteknis: 90, nilai_industri_disiplin: 85, nilai_sekolah_laporan: 85, nilai_sekolah_presentasi: 87, catatan_industri: 'Ahmad sangat proaktif dan mudah beradaptasi dengan tim developer.', catatan_sekolah: 'Laporan tersusun rapi dengan metodologi yang jelas.' },
  { id: 'eval-2', id_siswa: 'rina@simpkl.com', nilai_industri_teknis: 84, nilai_industri_nonteknis: 85, nilai_industri_disiplin: 92, nilai_sekolah_laporan: 0, nilai_sekolah_presentasi: 0, catatan_industri: 'Sangat disiplin dan tepat waktu dalam menangani keluhan jaringan.', catatan_sekolah: 'Laporan masih dalam proses bimbingan bab 3.' },
];

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  { id: 'ann-1', judul: 'Batas Akhir Pengajuan Tempat PKL Gelombang I', konten: 'Diinformasikan kepada seluruh siswa kelas XI, batas akhir pengisian pengajuan tempat PKL Gelombang I adalah tanggal 15 Juli 2026. Bagi yang belum mengajukan atau statusnya ditolak, harap segera menemui Koordinator PKL.', tanggal: '2026-07-01', author: 'Danu Prasetyo (Koordinator)' },
  { id: 'ann-2', judul: 'Format Penyusunan Laporan Akhir PKL 2026', konten: 'Format penulisan laporan PKL dapat diunduh di perpustakaan sekolah atau melalui wali kelas masing-masing. Silakan diskusikan sistematikanya dengan guru pembimbing masing-masing mulai bab 1.', tanggal: '2026-07-03', author: 'Sri Wahyuni M.Kom' },
];

const INITIAL_CLASSES: PklClass[] = [
  { id: 'class-1', nama_kelas: 'XII RPL 1', jurusan: 'Rekayasa Perangkat Lunak' },
  { id: 'class-2', nama_kelas: 'XII RPL 2', jurusan: 'Rekayasa Perangkat Lunak' },
  { id: 'class-3', nama_kelas: 'XII TKJ 1', jurusan: 'Teknik Komputer & Jaringan' },
  { id: 'class-4', nama_kelas: 'XII TKJ 2', jurusan: 'Teknik Komputer & Jaringan' },
  { id: 'class-5', nama_kelas: 'XII TKR', jurusan: 'Teknik Kendaraan Ringan' },
  { id: 'class-6', nama_kelas: 'XII DKV', jurusan: 'Desain Komunikasi Visual' }
];

// Helper to initialize local storage
function initializeLocalStorage() {
  const isInitialized = localStorage.getItem('SIM_PKL_INITIALIZED');
  if (!isInitialized) {
    localStorage.setItem('SIM_PKL_USERS', JSON.stringify(INITIAL_USERS));
    localStorage.setItem('SIM_PKL_INSTANSI', JSON.stringify(INITIAL_INSTANSI));
    localStorage.setItem('SIM_PKL_PLACEMENTS', JSON.stringify(INITIAL_PLACEMENTS));
    localStorage.setItem('SIM_PKL_JOURNALS', JSON.stringify(INITIAL_JOURNALS));
    localStorage.setItem('SIM_PKL_ATTENDANCE', JSON.stringify(INITIAL_ATTENDANCE));
    localStorage.setItem('SIM_PKL_EVALUATIONS', JSON.stringify(INITIAL_EVALUATIONS));
    localStorage.setItem('SIM_PKL_ANNOUNCEMENTS', JSON.stringify(INITIAL_ANNOUNCEMENTS));
    localStorage.setItem('SIM_PKL_CLASSES', JSON.stringify(INITIAL_CLASSES));
    localStorage.setItem('SIM_PKL_INITIALIZED', 'true');
  } else {
    // Ensure classes key exists even if app was initialized previously
    if (!localStorage.getItem('SIM_PKL_CLASSES')) {
      localStorage.setItem('SIM_PKL_CLASSES', JSON.stringify(INITIAL_CLASSES));
    }
    // Force migrate local storage to make sure standard admin and other mock users exist
    try {
      const usersRaw = localStorage.getItem('SIM_PKL_USERS');
      if (usersRaw) {
        const users = JSON.parse(usersRaw) as PklUser[];
        const hasAdmin = users.some(u => u.email === 'admin@simpkl.com');
        let updated = false;
        
        if (!hasAdmin) {
          users.push(INITIAL_USERS[0]); // Ensure admin is always there
          updated = true;
        }

        // Make sure everyone has a password, and students have kelas and jurusan
        const migratedUsers = users.map(u => {
          const match = INITIAL_USERS.find(iu => iu.email === u.email);
          if (!u.password) {
            u.password = match?.password || 'password123';
            updated = true;
          }
          if (u.role === 'siswa') {
            if (!u.kelas && match?.kelas) {
              u.kelas = match.kelas;
              updated = true;
            }
            if (!u.jurusan && match?.jurusan) {
              u.jurusan = match.jurusan;
              updated = true;
            }
          }
          return u;
        });

        if (updated) {
          localStorage.setItem('SIM_PKL_USERS', JSON.stringify(migratedUsers));
        }
      }
    } catch (e) {
      console.error('Failed to migrate local users:', e);
    }
  }
}

// Initialize immediately
initializeLocalStorage();

// Generic handler for local db operations
const localDb = {
  get: <T>(key: string): T[] => {
    initializeLocalStorage();
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  },
  set: <T>(key: string, data: T[]) => {
    localStorage.setItem(key, JSON.stringify(data));
  }
};

// -------------------------------------------------------------
// SECURE & SMART DATABASE ACTIONS (SUPABASE WITH LOCAL FALLBACK)
// -------------------------------------------------------------

export async function autoSeedSupabase(sb: any) {
  try {
    const INSTANSI_MAP: { [key: string]: string } = {
      'inst-1': '8a123bc4-56de-78fa-90bc-123456789abc',
      'inst-2': '9b123bc4-56de-78fa-90bc-123456789abc',
      'inst-3': 'a3123bc4-56de-78fa-90bc-123456789abc'
    };

    // 1. Instansi
    const { data: instCheck, error: instErr } = await sb.from('pkl_instansi').select('id');
    if (!instErr && (!instCheck || instCheck.length === 0)) {
      console.log('Seeding pkl_instansi to Supabase...');
      for (const inst of INITIAL_INSTANSI) {
        const realId = INSTANSI_MAP[inst.id] || inst.id;
        await sb.from('pkl_instansi').upsert({
          id: realId,
          nama_instansi: inst.nama_instansi,
          alamat: inst.alamat,
          kuota: inst.kuota,
          pembimbing_nama: inst.pembimbing_nama,
          pembimbing_telp: inst.pembimbing_telp
        });
      }
    }

    // 2. Users
    const { data: userCheck, error: userErr } = await sb.from('pkl_users').select('id');
    if (!userErr && (!userCheck || userCheck.length === 0)) {
      console.log('Seeding pkl_users to Supabase...');
      for (const u of INITIAL_USERS) {
        const realIdInstansi = u.id_instansi ? (INSTANSI_MAP[u.id_instansi] || u.id_instansi) : null;
        await sb.from('pkl_users').upsert({
          id: u.id,
          email: u.email,
          password: u.password || 'password123',
          nama: u.nama,
          role: u.role,
          nomor_induk: u.nomor_induk,
          telepon: u.telepon,
          kelas: u.kelas || null,
          jurusan: u.jurusan || null,
          id_instansi: realIdInstansi,
          id_pembimbing: u.id_pembimbing || null
        });
      }
    }

    // 3. Placements
    const { data: placeCheck, error: placeErr } = await sb.from('pkl_placements').select('id');
    if (!placeErr && (!placeCheck || placeCheck.length === 0)) {
      console.log('Seeding pkl_placements to Supabase...');
      for (const p of INITIAL_PLACEMENTS) {
        const realIdInstansi = p.id_instansi ? (INSTANSI_MAP[p.id_instansi] || p.id_instansi) : null;
        await sb.from('pkl_placements').upsert({
          id_siswa: p.id_siswa,
          id_instansi: realIdInstansi,
          tanggal_mulai: p.tanggal_mulai,
          tanggal_selesai: p.tanggal_selesai,
          status: p.status,
          catatan: p.catatan
        });
      }
    }

    // 4. Journals
    const { data: jourCheck, error: jourErr } = await sb.from('pkl_journals').select('id');
    if (!jourErr && (!jourCheck || jourCheck.length === 0)) {
      console.log('Seeding pkl_journals to Supabase...');
      for (const j of INITIAL_JOURNALS) {
        await sb.from('pkl_journals').upsert({
          id_siswa: j.id_siswa,
          tanggal: j.tanggal,
          kegiatan: j.kegiatan,
          ringkasan_belajar: j.ringkasan_belajar,
          foto_url: j.foto_url || null,
          status: j.status,
          catatan_pembimbing: j.catatan_pembimbing || null
        });
      }
    }

    // 5. Attendance
    const { data: attCheck, error: attErr } = await sb.from('pkl_attendance').select('id');
    if (!attErr && (!attCheck || attCheck.length === 0)) {
      console.log('Seeding pkl_attendance to Supabase...');
      for (const a of INITIAL_ATTENDANCE) {
        await sb.from('pkl_attendance').upsert({
          id_siswa: a.id_siswa,
          tanggal: a.tanggal,
          jam_masuk: a.jam_masuk,
          jam_keluar: a.jam_keluar || null,
          status: a.status,
          keterangan: a.keterangan || null,
          status_verifikasi: a.status_verifikasi
        });
      }
    }

    // 6. Evaluations
    const { data: evalCheck, error: evalErr } = await sb.from('pkl_evaluations').select('id');
    if (!evalErr && (!evalCheck || evalCheck.length === 0)) {
      console.log('Seeding pkl_evaluations to Supabase...');
      for (const e of INITIAL_EVALUATIONS) {
        await sb.from('pkl_evaluations').upsert({
          id_siswa: e.id_siswa,
          nilai_industri_teknis: e.nilai_industri_teknis,
          nilai_industri_nonteknis: e.nilai_industri_nonteknis,
          nilai_industri_disiplin: e.nilai_industri_disiplin,
          nilai_sekolah_laporan: e.nilai_sekolah_laporan,
          nilai_sekolah_presentasi: e.nilai_sekolah_presentasi,
          catatan_industri: e.catatan_industri || null,
          catatan_sekolah: e.catatan_sekolah || null
        });
      }
    }

    // 7. Announcements
    const { data: annCheck, error: annErr } = await sb.from('pkl_announcements').select('id');
    if (!annErr && (!annCheck || annCheck.length === 0)) {
      console.log('Seeding pkl_announcements to Supabase...');
      for (const ann of INITIAL_ANNOUNCEMENTS) {
        await sb.from('pkl_announcements').upsert({
          judul: ann.judul,
          konten: ann.konten,
          tanggal: ann.tanggal,
          author: ann.author
        });
      }
    }
  } catch (error) {
    console.error('Error during auto-seeding Supabase tables:', error);
  }
}

export async function dbGetUsers(): Promise<{ data: PklUser[], fromSupabase: boolean, error?: string }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_users').select('*');
      if (!error && data) {
        if (data.length === 0) {
          console.log('Supabase users table is empty, auto-seeding default users...');
          await autoSeedSupabase(sb);
          const { data: refetched } = await sb.from('pkl_users').select('*');
          if (refetched && refetched.length > 0) {
            const sanitized = (refetched as PklUser[]).map(u => ({
              ...u,
              password: u.password || 'password123'
            }));
            return { data: sanitized, fromSupabase: true };
          } else {
            console.warn('Supabase seeding returned no users, falling back to local storage');
            return { data: localDb.get<PklUser>('SIM_PKL_USERS'), fromSupabase: false };
          }
        }
        // Ensure every user has a password field defaulted to 'password123' if empty
        const sanitized = (data as PklUser[]).map(u => ({
          ...u,
          password: u.password || 'password123'
        }));
        return { data: sanitized, fromSupabase: true };
      }
      console.warn('Supabase users error, falling back to local storage:', error);
    } catch (e) {
      console.error('Supabase query failed:', e);
    }
  }
  return { data: localDb.get<PklUser>('SIM_PKL_USERS'), fromSupabase: false };
}

export async function dbSaveUser(user: PklUser): Promise<{ success: boolean, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;

  if (sb) {
    try {
      const { error } = await sb.from('pkl_users').upsert(user);
      if (!error) {
        success = true;
        fromSupabase = true;

        // Auto-register/enroll the user into official Supabase Auth if a password is listed
        const rawPassword = user.password;
        if (rawPassword && rawPassword !== '[SECURED BY SUPABASE AUTH]') {
          const authSb = getSupabaseNoSessionClient();
          if (authSb) {
            try {
              const { error: authError } = await authSb.auth.signUp({
                email: user.email,
                password: rawPassword,
              });
              if (!authError) {
                console.log(`Auto-enrolled user ${user.email} into Supabase Auth.`);
              } else {
                console.log(`Supabase Auth auto-enrollment skipped for ${user.email}: ${authError.message}`);
              }
            } catch (err) {
              console.error('Error during auto-enrollment:', err);
            }
          }
        }
      } else {
        console.warn('Supabase upsert user error:', error);
      }
    } catch (e) {
      console.error('Supabase user upsert failed:', e);
    }
  }

  // Always update local storage for data alignment
  const users = localDb.get<PklUser>('SIM_PKL_USERS');
  const index = users.findIndex(u => u.id === user.id);
  if (index !== -1) {
    users[index] = user;
  } else {
    users.push(user);
  }
  localDb.set('SIM_PKL_USERS', users);
  
  if (!fromSupabase) success = true; // Local always succeeds

  return { success, fromSupabase };
}

export async function dbDeleteUser(userId: string): Promise<{ success: boolean, fromSupabase: boolean, error?: string }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let errorMsg = '';

  if (sb) {
    try {
      // 1. Programmatic cascade deletion in Supabase to prevent Foreign Key constraints
      // (in case the user's Supabase tables don't have ON DELETE CASCADE set up yet)
      await sb.from('pkl_evaluations').delete().eq('id_siswa', userId);
      await sb.from('pkl_attendance').delete().eq('id_siswa', userId);
      await sb.from('pkl_journals').delete().eq('id_siswa', userId);
      await sb.from('pkl_placements').delete().eq('id_siswa', userId);
      
      // Update students who reference this user as id_pembimbing
      await sb.from('pkl_users').update({ id_pembimbing: null }).eq('id_pembimbing', userId);

      // 2. Now delete the user
      const { error } = await sb.from('pkl_users').delete().eq('id', userId);
      if (!error) {
        success = true;
        fromSupabase = true;
      } else {
        // If it's a "relation does not exist" error, it means the table is not set up on Supabase,
        // so we are in local fallback mode. In that case, we can proceed with local success.
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_users not found, proceeding with local deletion');
        } else {
          console.error('Supabase user delete failed:', error);
          errorMsg = error.message;
          // Set fromSupabase = true to block local fallback success because it's a real db error
          fromSupabase = true; 
        }
      }
    } catch (e: any) {
      console.error('Supabase user delete failed:', e);
      errorMsg = e?.message || String(e);
    }
  }

  // 3. Mirror the deletion in Local Storage for data consistency
  const users = localDb.get<PklUser>('SIM_PKL_USERS');
  localDb.set('SIM_PKL_USERS', users.filter(u => u.id !== userId));

  const evaluations = localDb.get<any>('SIM_PKL_EVALUATIONS');
  localDb.set('SIM_PKL_EVALUATIONS', evaluations.filter((ev: any) => ev.id_siswa !== userId));

  const attendance = localDb.get<any>('SIM_PKL_ATTENDANCE');
  localDb.set('SIM_PKL_ATTENDANCE', attendance.filter((at: any) => at.id_siswa !== userId));

  const journals = localDb.get<any>('SIM_PKL_JOURNALS');
  localDb.set('SIM_PKL_JOURNALS', journals.filter((jl: any) => jl.id_siswa !== userId));

  const placements = localDb.get<any>('SIM_PKL_PLACEMENTS');
  localDb.set('SIM_PKL_PLACEMENTS', placements.filter((pl: any) => pl.id_siswa !== userId));

  // Remove mapping of pembimbing from other users locally
  const updatedLocalUsers = users.map(u => {
    if (u.id_pembimbing === userId) {
      return { ...u, id_pembimbing: undefined };
    }
    return u;
  }).filter(u => u.id !== userId);
  localDb.set('SIM_PKL_USERS', updatedLocalUsers);

  // If we succeeded on Supabase, or if we didn't try/need to (no Supabase or table does not exist)
  if (!fromSupabase) {
    success = true;
  }

  return { success, fromSupabase, error: errorMsg };
}

// ---------------------- INSTANSI ----------------------

export async function dbGetInstansi(): Promise<{ data: PklInstansi[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_instansi').select('*').order('nama_instansi');
      if (!error && data) {
        return { data: data as PklInstansi[], fromSupabase: true };
      }
    } catch (e) {}
  }
  return { data: localDb.get<PklInstansi>('SIM_PKL_INSTANSI'), fromSupabase: false };
}

export async function dbSaveInstansi(instansi: PklInstansi): Promise<{ success: boolean, data?: PklInstansi, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = instansi;

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_instansi').upsert(instansi).select().single();
      if (!error && data) {
        success = true;
        fromSupabase = true;
        returnedData = data as PklInstansi;
      }
    } catch (e) {}
  }

  const list = localDb.get<PklInstansi>('SIM_PKL_INSTANSI');
  const index = list.findIndex(i => i.id === instansi.id);
  if (index !== -1) {
    list[index] = returnedData;
  } else {
    list.push(returnedData);
  }
  localDb.set('SIM_PKL_INSTANSI', list);

  if (!fromSupabase) success = true;
  return { success, data: returnedData, fromSupabase };
}

export async function dbDeleteInstansi(id: string): Promise<{ success: boolean, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;

  if (sb) {
    try {
      const { error } = await sb.from('pkl_instansi').delete().eq('id', id);
      if (!error) {
        success = true;
        fromSupabase = true;
      }
    } catch (e) {}
  }

  const list = localDb.get<PklInstansi>('SIM_PKL_INSTANSI');
  localDb.set('SIM_PKL_INSTANSI', list.filter(i => i.id !== id));

  if (!fromSupabase) success = true;
  return { success, fromSupabase };
}

// ---------------------- PLACEMENTS ----------------------

export async function dbGetPlacements(): Promise<{ data: PklPlacement[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_placements').select('*');
      if (!error && data) {
        return { data: data as PklPlacement[], fromSupabase: true };
      }
    } catch (e) {}
  }
  return { data: localDb.get<PklPlacement>('SIM_PKL_PLACEMENTS'), fromSupabase: false };
}

export async function dbSavePlacement(placement: PklPlacement): Promise<{ success: boolean, data?: PklPlacement, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = placement;

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_placements').upsert(placement).select().single();
      if (!error && data) {
        success = true;
        fromSupabase = true;
        returnedData = data as PklPlacement;
      }
    } catch (e) {}
  }

  const list = localDb.get<PklPlacement>('SIM_PKL_PLACEMENTS');
  const index = list.findIndex(p => p.id === placement.id);
  if (index !== -1) {
    list[index] = returnedData;
  } else {
    list.push(returnedData);
  }
  localDb.set('SIM_PKL_PLACEMENTS', list);

  if (!fromSupabase) success = true;
  return { success, data: returnedData, fromSupabase };
}

// ---------------------- JOURNALS ----------------------

export async function dbGetJournals(): Promise<{ data: PklJournal[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_journals').select('*').order('tanggal', { ascending: false });
      if (!error && data) {
        return { data: data as PklJournal[], fromSupabase: true };
      }
    } catch (e) {}
  }
  return { data: localDb.get<PklJournal>('SIM_PKL_JOURNALS'), fromSupabase: false };
}

export async function dbSaveJournal(journal: PklJournal): Promise<{ success: boolean, data?: PklJournal, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = journal;

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_journals').upsert(journal).select().single();
      if (!error && data) {
        success = true;
        fromSupabase = true;
        returnedData = data as PklJournal;
      }
    } catch (e) {}
  }

  const list = localDb.get<PklJournal>('SIM_PKL_JOURNALS');
  const index = list.findIndex(j => j.id === journal.id);
  if (index !== -1) {
    list[index] = returnedData;
  } else {
    list.push(returnedData);
  }
  localDb.set('SIM_PKL_JOURNALS', list);

  if (!fromSupabase) success = true;
  return { success, data: returnedData, fromSupabase };
}

export async function dbDeleteJournal(id: string): Promise<{ success: boolean, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;

  if (sb) {
    try {
      const { error } = await sb.from('pkl_journals').delete().eq('id', id);
      if (!error) {
        success = true;
        fromSupabase = true;
      }
    } catch (e) {}
  }

  const list = localDb.get<PklJournal>('SIM_PKL_JOURNALS');
  localDb.set('SIM_PKL_JOURNALS', list.filter(j => j.id !== id));

  if (!fromSupabase) success = true;
  return { success, fromSupabase };
}

// ---------------------- ATTENDANCE ----------------------

export async function dbGetAttendance(): Promise<{ data: PklAttendance[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_attendance').select('*').order('tanggal', { ascending: false });
      if (!error && data) {
        return { data: data as PklAttendance[], fromSupabase: true };
      }
    } catch (e) {}
  }
  return { data: localDb.get<PklAttendance>('SIM_PKL_ATTENDANCE'), fromSupabase: false };
}

export async function dbSaveAttendance(attendance: PklAttendance): Promise<{ success: boolean, data?: PklAttendance, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = attendance;

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_attendance').upsert(attendance).select().single();
      if (!error && data) {
        success = true;
        fromSupabase = true;
        returnedData = data as PklAttendance;
      }
    } catch (e) {}
  }

  const list = localDb.get<PklAttendance>('SIM_PKL_ATTENDANCE');
  const index = list.findIndex(a => a.id === attendance.id);
  if (index !== -1) {
    list[index] = returnedData;
  } else {
    list.push(returnedData);
  }
  localDb.set('SIM_PKL_ATTENDANCE', list);

  if (!fromSupabase) success = true;
  return { success, data: returnedData, fromSupabase };
}

// ---------------------- EVALUATIONS ----------------------

export async function dbGetEvaluations(): Promise<{ data: PklEvaluation[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_evaluations').select('*');
      if (!error && data) {
        return { data: data as PklEvaluation[], fromSupabase: true };
      }
    } catch (e) {}
  }
  return { data: localDb.get<PklEvaluation>('SIM_PKL_EVALUATIONS'), fromSupabase: false };
}

export async function dbSaveEvaluation(evaluation: PklEvaluation): Promise<{ success: boolean, data?: PklEvaluation, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = evaluation;

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_evaluations').upsert(evaluation).select().single();
      if (!error && data) {
        success = true;
        fromSupabase = true;
        returnedData = data as PklEvaluation;
      }
    } catch (e) {}
  }

  const list = localDb.get<PklEvaluation>('SIM_PKL_EVALUATIONS');
  const index = list.findIndex(e => e.id_siswa === evaluation.id_siswa);
  if (index !== -1) {
    list[index] = returnedData;
  } else {
    list.push(returnedData);
  }
  localDb.set('SIM_PKL_EVALUATIONS', list);

  if (!fromSupabase) success = true;
  return { success, data: returnedData, fromSupabase };
}

// ---------------------- ANNOUNCEMENTS ----------------------

export async function dbGetAnnouncements(): Promise<{ data: Announcement[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_announcements').select('*').order('tanggal', { ascending: false });
      if (!error && data) {
        return { data: data as Announcement[], fromSupabase: true };
      }
    } catch (e) {}
  }
  return { data: localDb.get<Announcement>('SIM_PKL_ANNOUNCEMENTS'), fromSupabase: false };
}

export async function dbSaveAnnouncement(announcement: Announcement): Promise<{ success: boolean, data?: Announcement, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = announcement;

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_announcements').upsert(announcement).select().single();
      if (!error && data) {
        success = true;
        fromSupabase = true;
        returnedData = data as Announcement;
      }
    } catch (e) {}
  }

  const list = localDb.get<Announcement>('SIM_PKL_ANNOUNCEMENTS');
  const index = list.findIndex(a => a.id === announcement.id);
  if (index !== -1) {
    list[index] = returnedData;
  } else {
    list.push(returnedData);
  }
  localDb.set('SIM_PKL_ANNOUNCEMENTS', list);

  if (!fromSupabase) success = true;
  return { success, data: returnedData, fromSupabase };
}

export async function dbDeleteAnnouncement(id: string): Promise<{ success: boolean, fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;

  if (sb) {
    try {
      const { error } = await sb.from('pkl_announcements').delete().eq('id', id);
      if (!error) {
        success = true;
        fromSupabase = true;
      }
    } catch (e) {}
  }

  const list = localDb.get<Announcement>('SIM_PKL_ANNOUNCEMENTS');
  localDb.set('SIM_PKL_ANNOUNCEMENTS', list.filter(a => a.id !== id));

  if (!fromSupabase) success = true;
  return { success, fromSupabase };
}

// -------------------------------------------------------------
// SYNC UTILITY TO EXPORT LOCAL DATA TO SUPABASE
// -------------------------------------------------------------

export async function syncLocalDataToSupabase(): Promise<{ success: boolean, message: string }> {
  const sb = getSupabaseClient();
  if (!sb) {
    return { success: false, message: 'Supabase belum terkonfigurasi.' };
  }

  try {
    // 1. Instansi
    const instansis = localDb.get<PklInstansi>('SIM_PKL_INSTANSI');
    for (const inst of instansis) {
      await sb.from('pkl_instansi').upsert({
        id: inst.id.includes('inst-') ? undefined : inst.id, // let Supabase generate UUID if it is our temp mock id
        nama_instansi: inst.nama_instansi,
        alamat: inst.alamat,
        kuota: inst.kuota,
        pembimbing_nama: inst.pembimbing_nama,
        pembimbing_telp: inst.pembimbing_telp
      });
    }

    // Refresh instansis from Supabase to get real UUIDs if needed,
    // but to make it simple we will upsert with absolute IDs.
    // Let's also do users, placements, journals, attendance, evaluations, announcements.
    const users = localDb.get<PklUser>('SIM_PKL_USERS');
    for (const u of users) {
      await sb.from('pkl_users').upsert({
        id: u.id,
        email: u.email,
        password: u.password || 'password123',
        nama: u.nama,
        role: u.role,
        nomor_induk: u.nomor_induk,
        telepon: u.telepon,
        kelas: u.kelas || null,
        jurusan: u.jurusan || null,
        id_instansi: u.id_instansi?.includes('inst-') ? null : u.id_instansi,
        id_pembimbing: u.id_pembimbing
      });
    }

    const placements = localDb.get<PklPlacement>('SIM_PKL_PLACEMENTS');
    for (const p of placements) {
      await sb.from('pkl_placements').upsert({
        id: p.id.includes('place-') ? undefined : p.id,
        id_siswa: p.id_siswa,
        id_instansi: p.id_instansi.includes('inst-') ? undefined : p.id_instansi,
        tanggal_mulai: p.tanggal_mulai,
        tanggal_selesai: p.tanggal_selesai,
        status: p.status,
        catatan: p.catatan
      });
    }

    const journals = localDb.get<PklJournal>('SIM_PKL_JOURNALS');
    for (const j of journals) {
      await sb.from('pkl_journals').upsert({
        id: j.id.includes('jour-') ? undefined : j.id,
        id_siswa: j.id_siswa,
        tanggal: j.tanggal,
        kegiatan: j.kegiatan,
        ringkasan_belajar: j.ringkasan_belajar,
        foto_url: j.foto_url,
        status: j.status,
        catatan_pembimbing: j.catatan_pembimbing
      });
    }

    const attendance = localDb.get<PklAttendance>('SIM_PKL_ATTENDANCE');
    for (const a of attendance) {
      await sb.from('pkl_attendance').upsert({
        id: a.id.includes('att-') ? undefined : a.id,
        id_siswa: a.id_siswa,
        tanggal: a.tanggal,
        jam_masuk: a.jam_masuk,
        jam_keluar: a.jam_keluar,
        status: a.status,
        keterangan: a.keterangan,
        status_verifikasi: a.status_verifikasi
      });
    }

    const evals = localDb.get<PklEvaluation>('SIM_PKL_EVALUATIONS');
    for (const e of evals) {
      await sb.from('pkl_evaluations').upsert({
        id: e.id.includes('eval-') ? undefined : e.id,
        id_siswa: e.id_siswa,
        nilai_industri_teknis: e.nilai_industri_teknis,
        nilai_industri_nonteknis: e.nilai_industri_nonteknis,
        nilai_industri_disiplin: e.nilai_industri_disiplin,
        nilai_sekolah_laporan: e.nilai_sekolah_laporan,
        nilai_sekolah_presentasi: e.nilai_sekolah_presentasi,
        catatan_industri: e.catatan_industri,
        catatan_sekolah: e.catatan_sekolah
      });
    }

    const announcements = localDb.get<Announcement>('SIM_PKL_ANNOUNCEMENTS');
    for (const ann of announcements) {
      await sb.from('pkl_announcements').upsert({
        id: ann.id.includes('ann-') ? undefined : ann.id,
        judul: ann.judul,
        konten: ann.konten,
        tanggal: ann.tanggal,
        author: ann.author
      });
    }

    try {
      const classes = localDb.get<PklClass>('SIM_PKL_CLASSES');
      for (const c of classes) {
        await sb.from('pkl_classes').upsert({
          id: c.id.includes('class-') ? undefined : c.id,
          nama_kelas: c.nama_kelas,
          jurusan: c.jurusan
        });
      }
    } catch (err) {
      console.warn('Skipping table pkl_classes sync - table might not exist in Supabase yet');
    }

    return { success: true, message: 'Data lokal berhasil disinkronisasikan ke database Supabase.' };
  } catch (error: any) {
    console.error('Gagal melakukan sinkronisasi data:', error);
    return { success: false, message: `Gagal sinkronisasi: ${error?.message || 'Error tidak diketahui'}` };
  }
}

// ---------------------- MASTER KELAS ----------------------

export async function dbGetClasses(): Promise<{ data: PklClass[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_classes').select('*').order('nama_kelas');
      if (!error && data) {
        return { data: data as PklClass[], fromSupabase: true };
      }
    } catch (e) {}
  }
  return { data: localDb.get<PklClass>('SIM_PKL_CLASSES').sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas)), fromSupabase: false };
}

export async function dbSaveClass(cls: PklClass): Promise<{ success: boolean, data?: PklClass, fromSupabase: boolean, error?: string }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = cls;
  let errorMsg = '';

  if (sb) {
    try {
      const dbPayload = {
        nama_kelas: cls.nama_kelas,
        jurusan: cls.jurusan
      };

      let result;
      if (cls.id && !cls.id.includes('class-')) {
        // Update existing in supabase
        result = await sb.from('pkl_classes').update(dbPayload).eq('id', cls.id).select();
      } else {
        // Insert new into supabase
        result = await sb.from('pkl_classes').insert([dbPayload]).select();
      }

      if (!result.error && result.data && result.data.length > 0) {
        success = true;
        fromSupabase = true;
        returnedData = result.data[0] as PklClass;
      } else if (result.error) {
        if (result.error.code === 'P0001' || result.error.message?.includes('relation') || result.error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_classes not found, proceeding locally');
        } else {
          console.error('Supabase save class failed:', result.error);
          errorMsg = result.error.message;
          fromSupabase = true;
        }
      }
    } catch (e: any) {
      console.error('Supabase save class failed:', e);
      errorMsg = e?.message || String(e);
    }
  }

  // Update locally too
  const classes = localDb.get<PklClass>('SIM_PKL_CLASSES');
  const existingIdx = classes.findIndex(c => c.id === cls.id);
  
  if (existingIdx >= 0) {
    classes[existingIdx] = returnedData;
  } else {
    // If it was created on Supabase, it has a proper UUID. If not, generate a local ID
    if (!returnedData.id || returnedData.id.includes('class-')) {
      returnedData.id = 'class-' + Math.random().toString(36).substring(2, 9);
    }
    classes.push(returnedData);
  }
  
  localDb.set('SIM_PKL_CLASSES', classes);

  if (!fromSupabase) {
    success = true;
  }

  return { success, data: returnedData, fromSupabase, error: errorMsg };
}

export async function dbDeleteClass(id: string): Promise<{ success: boolean, fromSupabase: boolean, error?: string }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let errorMsg = '';

  if (sb) {
    try {
      const { error } = await sb.from('pkl_classes').delete().eq('id', id);
      if (!error) {
        success = true;
        fromSupabase = true;
      } else {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_classes not found, proceeding locally');
        } else {
          console.error('Supabase delete class failed:', error);
          errorMsg = error.message;
          fromSupabase = true;
        }
      }
    } catch (e: any) {
      console.error('Supabase delete class failed:', e);
      errorMsg = e?.message || String(e);
    }
  }

  const classes = localDb.get<PklClass>('SIM_PKL_CLASSES');
  localDb.set('SIM_PKL_CLASSES', classes.filter(c => c.id !== id));

  if (!fromSupabase) {
    success = true;
  }

  return { success, fromSupabase, error: errorMsg };
}

