import { getSupabaseClient, getSupabaseNoSessionClient } from '../supabaseClient';
import { 
  PklUser, PklInstansi, PklPlacement, PklJournal, PklAttendance, PklEvaluation, Announcement, PklClass, MenuAccess, TeacherMonitoring, OnlineUserSession 
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT pkl_attendance_siswa_tanggal_key UNIQUE (id_siswa, tanggal)
);

-- Penanganan aman untuk constraint unik pkl_attendance tanpa throw error jika sudah pernah dibuat
DO $$
BEGIN
  BEGIN
    ALTER TABLE pkl_attendance ADD CONSTRAINT pkl_attendance_siswa_tanggal_key UNIQUE (id_siswa, tanggal);
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
    WHEN OTHERS THEN NULL;
  END;
END $$;

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

-- 9. TABEL MONITORING GURU
CREATE TABLE IF NOT EXISTS pkl_teacher_monitoring (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_guru TEXT NOT NULL,
  nama_guru TEXT NOT NULL,
  tanggal DATE NOT NULL,
  jam_monitoring TIME NOT NULL,
  tipe_monitoring TEXT NOT NULL,
  latitude NUMERIC,
  longitude NUMERIC,
  foto_url TEXT,
  catatan TEXT,
  id_siswa TEXT,
  nama_siswa TEXT,
  nama_instansi TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. TABEL PENGATURAN / SETTINGS KOP SURAT
CREATE TABLE IF NOT EXISTS pkl_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) & define access policies
ALTER TABLE pkl_instansi ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_teacher_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE pkl_settings ENABLE ROW LEVEL SECURITY;

-- Allow public access policies for application database queries
DROP POLICY IF EXISTS "Public access for pkl_instansi" ON pkl_instansi;
CREATE POLICY "Public access for pkl_instansi" ON pkl_instansi FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_users" ON pkl_users;
CREATE POLICY "Public access for pkl_users" ON pkl_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_placements" ON pkl_placements;
CREATE POLICY "Public access for pkl_placements" ON pkl_placements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_journals" ON pkl_journals;
CREATE POLICY "Public access for pkl_journals" ON pkl_journals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_attendance" ON pkl_attendance;
CREATE POLICY "Public access for pkl_attendance" ON pkl_attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_evaluations" ON pkl_evaluations;
CREATE POLICY "Public access for pkl_evaluations" ON pkl_evaluations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_announcements" ON pkl_announcements;
CREATE POLICY "Public access for pkl_announcements" ON pkl_announcements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_classes" ON pkl_classes;
CREATE POLICY "Public access for pkl_classes" ON pkl_classes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_teacher_monitoring" ON pkl_teacher_monitoring;
CREATE POLICY "Public access for pkl_teacher_monitoring" ON pkl_teacher_monitoring FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for pkl_settings" ON pkl_settings;
CREATE POLICY "Public access for pkl_settings" ON pkl_settings FOR ALL USING (true) WITH CHECK (true);

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
('panitia@simpkl.com', 'panitia@simpkl.com', 'password123', 'Hendi Wijaya (Panitia PKL)', 'admin', 'NIP990033', '081223344556', NULL, NULL, NULL, NULL),
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
  { id: '8a123bc4-56de-78fa-90bc-123456789abc', nama_instansi: 'PT. Solusi Digital', alamat: 'Jl. Tekno Raya No. 10, Jakarta Selatan', kuota: 5, pembimbing_nama: 'Joko Prasetyo', pembimbing_telp: '081234567800' },
  { id: '9b123bc4-56de-78fa-90bc-123456789abc', nama_instansi: 'Bank Mandiri Tbk', alamat: 'Jl. Jenderal Sudirman Kav 52-53, Jakarta Pusat', kuota: 3, pembimbing_nama: 'Lisa Amalia', pembimbing_telp: '081234567801' },
  { id: 'a3123bc4-56de-78fa-90bc-123456789abc', nama_instansi: 'PT. Telkom Indonesia', alamat: 'Jl. Japati No. 1, Bandung, Jawa Barat', kuota: 4, pembimbing_nama: 'Rendra Siregar', pembimbing_telp: '081234567802' },
];

const INITIAL_USERS: PklUser[] = [
  // Admin
  { id: 'admin@simpkl.com', email: 'admin@simpkl.com', password: 'password123', nama: 'Danu Prasetyo (Koordinator)', role: 'admin', nomor_induk: 'NIP990022', telepon: '081122334455' },
  // Panitia PKL (Admin Monitoring Only)
  { id: 'panitia@simpkl.com', email: 'panitia@simpkl.com', password: 'password123', nama: 'Hendi Wijaya (Panitia PKL)', role: 'admin', nomor_induk: 'NIP990033', telepon: '081223344556' },
  // Guru
  { id: 'budi@simpkl.com', email: 'budi@simpkl.com', password: 'password123', nama: 'Drs. Budi Santoso', role: 'guru', nomor_induk: 'NIP19750821', telepon: '081211223344' },
  { id: 'sri@simpkl.com', email: 'sri@simpkl.com', password: 'password123', nama: 'Sri Wahyuni M.Kom', role: 'guru', nomor_induk: 'NIP19820412', telepon: '081299887766' },
  // Industri
  { id: 'joko@solusidigital.com', email: 'joko@solusidigital.com', password: 'password123', nama: 'Joko Prasetyo (PT. Solusi Digital)', role: 'industri', nomor_induk: 'NIKSD098', telepon: '081234567800', id_instansi: '8a123bc4-56de-78fa-90bc-123456789abc' },
  { id: 'lisa@bankmandiri.com', email: 'lisa@bankmandiri.com', password: 'password123', nama: 'Lisa Amalia (Bank Mandiri)', role: 'industri', nomor_induk: 'NIKBM743', telepon: '081234567801', id_instansi: '9b123bc4-56de-78fa-90bc-123456789abc' },
  // Siswa
  { id: 'ahmad@simpkl.com', email: 'ahmad@simpkl.com', password: 'password123', nama: 'Ahmad Fauzi', role: 'siswa', nomor_induk: 'NISN0062345', telepon: '085711223344', kelas: 'XII RPL 1', jurusan: 'Rekayasa Perangkat Lunak', id_instansi: '8a123bc4-56de-78fa-90bc-123456789abc', id_pembimbing: 'budi@simpkl.com' },
  { id: 'rina@simpkl.com', email: 'rina@simpkl.com', password: 'password123', nama: 'Rina Wijaya', role: 'siswa', nomor_induk: 'NISN0063456', telepon: '085755667788', kelas: 'XII TKJ 2', jurusan: 'Teknik Komputer & Jaringan', id_instansi: '9b123bc4-56de-78fa-90bc-123456789abc', id_pembimbing: 'sri@simpkl.com' },
  { id: 'dani@simpkl.com', email: 'dani@simpkl.com', password: 'password123', nama: 'Dani Setiawan', role: 'siswa', nomor_induk: 'NISN0064567', telepon: '085799001122', kelas: 'XII RPL 2', jurusan: 'Rekayasa Perangkat Lunak', id_pembimbing: 'budi@simpkl.com' }, // belum PKL
];

const INITIAL_PLACEMENTS: PklPlacement[] = [
  { id: 'place-1', id_siswa: 'ahmad@simpkl.com', id_instansi: '8a123bc4-56de-78fa-90bc-123456789abc', tanggal_mulai: '2026-07-01', tanggal_selesai: '2026-10-01', status: 'disetujui', catatan: 'Penempatan di divisi Mobile Developer.' },
  { id: 'place-2', id_siswa: 'rina@simpkl.com', id_instansi: '9b123bc4-56de-78fa-90bc-123456789abc', tanggal_mulai: '2026-07-01', tanggal_selesai: '2026-10-01', status: 'disetujui', catatan: 'Penempatan di divisi IT Support.' },
  { id: 'place-3', id_siswa: 'dani@simpkl.com', id_instansi: 'a3123bc4-56de-78fa-90bc-123456789abc', tanggal_mulai: '2026-08-01', tanggal_selesai: '2026-11-01', status: 'pending', catatan: 'Mengajukan magang di Web Developer.' },
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

const INITIAL_TEACHER_MONITORING: TeacherMonitoring[] = [
  {
    id: 'mon-1',
    id_guru: 'budi@simpkl.com',
    nama_guru: 'Drs. Budi Santoso',
    tanggal: '2026-07-02',
    jam_monitoring: '10:30',
    tipe_monitoring: 'Monitoring 1',
    latitude: -6.917464,
    longitude: 107.619122,
    foto_url: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80',
    catatan: 'Kunjungan monitoring pertama. Siswa Ahmad Fauzi terpantau aktif mengikuti penjelasan supervisor industri.',
    id_siswa: 'inst-1',
    nama_siswa: 'Ahmad Fauzi',
    nama_instansi: 'PT. Solusi Digital Indonesia'
  },
  {
    id: 'mon-2',
    id_guru: 'sri@simpkl.com',
    nama_guru: 'Sri Wahyuni M.Kom',
    tanggal: '2026-07-03',
    jam_monitoring: '13:15',
    tipe_monitoring: 'Monitoring 1',
    latitude: -6.914744,
    longitude: 107.609810,
    foto_url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80',
    catatan: 'Monitoring rutin di Bank Mandiri. Rina Wijaya bertugas di divisi IT Support dengan performa sangat baik.',
    id_siswa: 'inst-2',
    nama_siswa: 'Rina Wijaya',
    nama_instansi: 'Bank Mandiri Cabang Utama'
  }
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
    localStorage.setItem('SIM_PKL_TEACHER_MONITORING', JSON.stringify([]));
    localStorage.setItem('SIM_PKL_INITIALIZED', 'true');
  } else {
    // Ensure classes key exists even if app was initialized previously
    if (!localStorage.getItem('SIM_PKL_CLASSES')) {
      localStorage.setItem('SIM_PKL_CLASSES', JSON.stringify(INITIAL_CLASSES));
    }
    // Ensure teacher monitoring key exists
    if (!localStorage.getItem('SIM_PKL_TEACHER_MONITORING')) {
      localStorage.setItem('SIM_PKL_TEACHER_MONITORING', JSON.stringify([]));
    }
    // Force migrate local storage to make sure standard admin and other mock users exist
    try {
      const usersRaw = localStorage.getItem('SIM_PKL_USERS');
      if (usersRaw) {
        const users = JSON.parse(usersRaw) as PklUser[];
        const hasAdmin = users.some(u => u.email === 'admin@simpkl.com');
        const hasPanitia = users.some(u => u.email === 'panitia@simpkl.com');
        let updated = false;
        
        if (!hasAdmin) {
          users.push(INITIAL_USERS[0]); // Ensure admin is always there
          updated = true;
        }
        if (!hasPanitia) {
          users.push(INITIAL_USERS[1]); // Ensure panitia is always there
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
    // Initialize menu access list if missing
    if (!localStorage.getItem('SIM_PKL_MENU_ACCESS')) {
      localStorage.setItem('SIM_PKL_MENU_ACCESS', JSON.stringify(DEFAULT_MENU_ACCESS));
    }
  }
}

export const DEFAULT_MENU_ACCESS: MenuAccess[] = [
  { id: 'dashboard_pkl', nama_menu: 'Dashboard PKL', kategori: 'Utama', allowed_roles: ['siswa', 'guru', 'industri', 'admin'], deskripsi: 'Akses ke halaman Dashboard utama sesuai peran masing-masing.' },
  { id: 'statistik_hasil', nama_menu: 'Statistik & Hasil', kategori: 'Utama', allowed_roles: ['industri', 'admin'], deskripsi: 'Akses ke menu Grafik Visual, Analitik, dan pencapaian PKL.' },
  
  { id: 'siswa_biodata', nama_menu: 'Biodata & Status PKL', kategori: 'Siswa', allowed_roles: ['siswa'], deskripsi: 'Melihat status penempatan, kelas, dan data pembimbing siswa.' },
  { id: 'siswa_pengajuan', nama_menu: 'Pengajuan Tempat PKL', kategori: 'Siswa', allowed_roles: ['siswa'], deskripsi: 'Mengajukan surat minat penempatan mandiri ke instansi mitra.' },
  { id: 'siswa_jurnal', nama_menu: 'Jurnal Kegiatan Harian', kategori: 'Siswa', allowed_roles: ['siswa'], deskripsi: 'Mengisi, mengedit, dan melihat riwayat jurnal kerja harian.' },
  { id: 'siswa_presensi', nama_menu: 'Presensi Harian', kategori: 'Siswa', allowed_roles: ['siswa'], deskripsi: 'Melakukan absen masuk dan keluar magang harian.' },
  { id: 'siswa_nilai', nama_menu: 'Hasil & Nilai Akhir', kategori: 'Siswa', allowed_roles: ['siswa'], deskripsi: 'Melihat rincian sertifikat nilai dari sekolah dan industri.' },

  { id: 'guru_bimbingan', nama_menu: 'Daftar Bimbingan Siswa', kategori: 'Guru', allowed_roles: ['guru'], deskripsi: 'Melihat rincian siswa yang dibimbing secara langsung.' },
  { id: 'guru_jurnal', nama_menu: 'Verifikasi Jurnal Kerja', kategori: 'Guru', allowed_roles: ['guru'], deskripsi: 'Memvalidasi, memberi catatan bimbingan, atau meminta revisi jurnal siswa.' },
  { id: 'guru_presensi', nama_menu: 'Verifikasi Presensi Siswa', kategori: 'Guru', allowed_roles: ['guru'], deskripsi: 'Memvalidasi kehadiran siswa sakit/izin/alfa.' },
  { id: 'guru_nilai', nama_menu: 'Input Nilai Laporan & Presentasi', kategori: 'Guru', allowed_roles: ['guru'], deskripsi: 'Memberikan nilai bimbingan, laporan akhir, dan presentasi ujian.' },

  { id: 'industri_siswa', nama_menu: 'Daftar Siswa Magang', kategori: 'Industri', allowed_roles: ['industri'], deskripsi: 'Melihat rincian siswa yang sedang magang di perusahaan.' },
  { id: 'industri_presensi', nama_menu: 'Persetujuan Kehadiran Harian', kategori: 'Industri', allowed_roles: ['industri'], deskripsi: 'Menyetujui atau menolak absensi masuk-keluar siswa harian.' },
  { id: 'industri_nilai', nama_menu: 'Penilaian Kompetensi (Teknis/Karakter)', kategori: 'Industri', allowed_roles: ['industri'], deskripsi: 'Menginput nilai kompetensi teknis, non-teknis, dan kedisiplinan.' },

  { id: 'admin_plotting', nama_menu: 'Plotting & Pengajuan PKL', kategori: 'Admin', allowed_roles: ['admin'], deskripsi: 'Memetakan pembimbing sekolah dan menyetujui pengajuan tempat PKL.' },
  { id: 'admin_siswa', nama_menu: 'Master Data Siswa', kategori: 'Admin', allowed_roles: ['admin'], deskripsi: 'Mengelola biodata lengkap siswa dan impor data via Excel.' },
  { id: 'admin_guru', nama_menu: 'Master Guru Pembimbing', kategori: 'Admin', allowed_roles: ['admin'], deskripsi: 'Mengelola biodata lengkap guru pembimbing dan impor data via Excel.' },
  { id: 'admin_pengguna', nama_menu: 'Kelola Pengguna', kategori: 'Admin', allowed_roles: ['admin'], deskripsi: 'Mengelola login, password, dan level hak akses user lain.' },
  { id: 'admin_instansi', nama_menu: 'Kelola Instansi Mitra', kategori: 'Admin', allowed_roles: ['admin'], deskripsi: 'Mengelola daftar perusahaan, kuota magang, dan kontak HRD.' },
  { id: 'admin_kelas', nama_menu: 'Master Kelas', kategori: 'Admin', allowed_roles: ['admin'], deskripsi: 'Mengelola daftar kelas dan jurusan aktif.' },
  { id: 'admin_rekap', nama_menu: 'Laporan Rekap Nilai', kategori: 'Admin', allowed_roles: ['admin'], deskripsi: 'Mengunduh rekapitulasi nilai akhir dan absensi dalam format JSON.' },
];

export function dbGetMenuAccess(): MenuAccess[] {
  initializeLocalStorage();
  const raw = localStorage.getItem('SIM_PKL_MENU_ACCESS');
  if (!raw) {
    localStorage.setItem('SIM_PKL_MENU_ACCESS', JSON.stringify(DEFAULT_MENU_ACCESS));
    return DEFAULT_MENU_ACCESS;
  }
  try {
    const saved: MenuAccess[] = JSON.parse(raw);
    const merged = [...saved];
    let changed = false;
    DEFAULT_MENU_ACCESS.forEach(defItem => {
      const existing = merged.find(item => item.id === defItem.id);
      if (!existing) {
        merged.push(defItem);
        changed = true;
      } else if (defItem.id === 'statistik_hasil' && (existing.allowed_roles.includes('guru') || existing.allowed_roles.includes('siswa'))) {
        existing.allowed_roles = existing.allowed_roles.filter(r => r !== 'guru' && r !== 'siswa');
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('SIM_PKL_MENU_ACCESS', JSON.stringify(merged));
    }
    return merged;
  } catch (e) {
    console.error('Failed to parse menu access, resetting to default:', e);
    localStorage.setItem('SIM_PKL_MENU_ACCESS', JSON.stringify(DEFAULT_MENU_ACCESS));
    return DEFAULT_MENU_ACCESS;
  }
}

export function dbSaveMenuAccess(menuAccess: MenuAccess[]): { success: boolean } {
  localStorage.setItem('SIM_PKL_MENU_ACCESS', JSON.stringify(menuAccess));
  return { success: true };
}

export function isSuperAdmin(user: PklUser | null): boolean {
  if (!user) return false;
  const emailLower = user.email.toLowerCase();
  return user.role === 'admin' && (emailLower === 'kangdanu93@gmail.com' || emailLower === 'admin@simpkl.com');
}

export const INSTANSI_MAP: { [key: string]: string } = {
  'inst-1': '8a123bc4-56de-78fa-90bc-123456789abc',
  'inst-2': '9b123bc4-56de-78fa-90bc-123456789abc',
  'inst-3': 'a3123bc4-56de-78fa-90bc-123456789abc'
};

export function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Initialize immediately
initializeLocalStorage();

// Generic handler for local db operations
export const localDb = {
  get: <T>(key: string): T[] => {
    initializeLocalStorage();
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : [];
    } catch (e) {
      console.warn(`localStorage getItem error for ${key}:`, e);
      return [];
    }
  },
  set: <T>(key: string, data: T[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`localStorage setItem quota exceeded for ${key}, attempting cleanup & lightweight cache:`, e);
      try {
        // Strip large base64 image strings to fit in browser localStorage quota
        const lightweightData = data.map((item: any) => {
          if (item && typeof item === 'object') {
            const clone = { ...item };
            for (const prop of ['foto_url', 'foto_bukti', 'foto', 'bukti', 'image_url']) {
              if (typeof clone[prop] === 'string' && clone[prop].length > 500 && clone[prop].startsWith('data:image')) {
                clone[prop] = '[Foto Tersimpan di Cloud]';
              }
            }
            return clone;
          }
          return item;
        });
        localStorage.setItem(key, JSON.stringify(lightweightData));
      } catch (e2) {
        console.error(`localStorage setItem secondary fallback failed for ${key}:`, e2);
      }
    }
  }
};

// -------------------------------------------------------------
// SECURE & SMART DATABASE ACTIONS (SUPABASE WITH LOCAL FALLBACK)
// -------------------------------------------------------------

export async function autoSeedSupabase(sb: any) {
  try {
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

    // 8. Classes
    const { data: clsCheck, error: clsErr } = await sb.from('pkl_classes').select('id');
    if (!clsErr && (!clsCheck || clsCheck.length === 0)) {
      console.log('Seeding pkl_classes to Supabase...');
      for (const cls of INITIAL_CLASSES) {
        await sb.from('pkl_classes').upsert({
          id: cls.id.includes('class-') ? undefined : cls.id,
          nama_kelas: cls.nama_kelas,
          jurusan: cls.jurusan
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
            localDb.set('SIM_PKL_USERS', sanitized); // Sync local storage with latest Supabase records
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
        localDb.set('SIM_PKL_USERS', sanitized); // Sync local storage with latest Supabase records
        return { data: sanitized, fromSupabase: true };
      }
      console.warn('Supabase users error, falling back to local storage:', error);
    } catch (e) {
      console.error('Supabase query failed:', e);
    }
  }
  return { data: localDb.get<PklUser>('SIM_PKL_USERS'), fromSupabase: false };
}

export async function dbSaveUser(user: PklUser): Promise<{ success: boolean, fromSupabase: boolean, error?: string }> {
  // Map local mock instansi IDs to standard Supabase UUIDs
  let mappedInstansiId = user.id_instansi;
  if (mappedInstansiId && INSTANSI_MAP[mappedInstansiId]) {
    mappedInstansiId = INSTANSI_MAP[mappedInstansiId];
  }

  // Create a strictly-typed sanitized record for Supabase to avoid undefined or type syntax issues (such as empty string for UUID)
  const dbUser = {
    id: user.id,
    email: user.email,
    password: user.password || 'password123',
    nama: user.nama,
    role: user.role,
    nomor_induk: user.nomor_induk,
    telepon: user.telepon,
    kelas: user.kelas || null,
    jurusan: user.jurusan || null,
    id_instansi: (mappedInstansiId && mappedInstansiId.trim() !== '') ? mappedInstansiId : null,
    id_pembimbing: (user.id_pembimbing && user.id_pembimbing.trim() !== '') ? user.id_pembimbing : null,
  };

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let errorMsg = '';

  if (sb) {
    try {
      const { error } = await sb.from('pkl_users').upsert(dbUser);
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
        errorMsg = error.message;
        if (error.code === '42501') {
          errorMsg = 'Row Level Security (RLS) aktif pada tabel pkl_users. Silakan nonaktifkan RLS dengan perintah SQL: "ALTER TABLE pkl_users DISABLE ROW LEVEL SECURITY;"';
        }
        fromSupabase = true;
      }
    } catch (e: any) {
      console.error('Supabase user upsert failed:', e);
      errorMsg = e?.message || String(e);
    }
  }

  // Always update local storage for data alignment
  const users = localDb.get<PklUser>('SIM_PKL_USERS');
  const localUserToSave: PklUser = {
    ...user,
    id_instansi: dbUser.id_instansi || undefined,
    id_pembimbing: dbUser.id_pembimbing || undefined,
    kelas: dbUser.kelas || undefined,
    jurusan: dbUser.jurusan || undefined,
  };
  const index = users.findIndex(u => u.id === localUserToSave.id);
  if (index !== -1) {
    users[index] = localUserToSave;
  } else {
    users.push(localUserToSave);
  }
  localDb.set('SIM_PKL_USERS', users);
  
  if (!fromSupabase) success = true; // Local always succeeds

  return { success, fromSupabase, error: errorMsg };
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

export async function dbGetInstansi(): Promise<{ data: PklInstansi[], fromSupabase: boolean, error?: string }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_instansi').select('*').order('nama_instansi');
      if (!error && data) {
        if (data.length === 0) {
          console.log('Supabase pkl_instansi table is empty, auto-seeding default instansi...');
          await autoSeedSupabase(sb);
          const { data: refetched } = await sb.from('pkl_instansi').select('*').order('nama_instansi');
          if (refetched && refetched.length > 0) {
            const list = refetched as PklInstansi[];
            localDb.set('SIM_PKL_INSTANSI', list);
            return { data: list, fromSupabase: true };
          }
        } else {
          const list = data as PklInstansi[];
          localDb.set('SIM_PKL_INSTANSI', list);
          return { data: list, fromSupabase: true };
        }
      } else if (error) {
        console.warn('Supabase fetch instansi error:', error);
      }
    } catch (e: any) {
      console.error('Supabase fetch instansi exception:', e);
    }
  }
  return { data: localDb.get<PklInstansi>('SIM_PKL_INSTANSI'), fromSupabase: false };
}

export async function dbSaveInstansi(instansi: PklInstansi): Promise<{ success: boolean, data?: PklInstansi, fromSupabase: boolean, error?: string }> {
  // Determine target UUID for Supabase
  let targetId = instansi.id;
  if (INSTANSI_MAP[targetId]) {
    targetId = INSTANSI_MAP[targetId];
  } else if (!isUuid(targetId)) {
    targetId = generateUUID();
  }

  // Create sanitized database record for Supabase
  const dbInstansi = {
    id: targetId,
    nama_instansi: instansi.nama_instansi,
    alamat: instansi.alamat,
    kuota: Number(instansi.kuota) || 1,
    pembimbing_nama: instansi.pembimbing_nama || null,
    pembimbing_telp: instansi.pembimbing_telp || null
  };

  const returnedInstansi: PklInstansi = {
    id: targetId,
    nama_instansi: instansi.nama_instansi,
    alamat: instansi.alamat,
    kuota: Number(instansi.kuota) || 1,
    pembimbing_nama: instansi.pembimbing_nama || undefined,
    pembimbing_telp: instansi.pembimbing_telp || undefined
  };

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let errorMsg = '';

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_instansi').upsert(dbInstansi).select();
      if (!error) {
        success = true;
        fromSupabase = true;
        if (data && data.length > 0) {
          returnedInstansi.id = data[0].id;
          returnedInstansi.nama_instansi = data[0].nama_instansi;
          returnedInstansi.alamat = data[0].alamat;
          returnedInstansi.kuota = data[0].kuota;
          returnedInstansi.pembimbing_nama = data[0].pembimbing_nama || undefined;
          returnedInstansi.pembimbing_telp = data[0].pembimbing_telp || undefined;
        }
      } else {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_instansi not found, proceeding locally');
        } else {
          console.error('Supabase save instansi failed:', error.message, error.details, error.hint);
          errorMsg = error.message;
          if (error.code === '42501') {
            errorMsg = 'Row Level Security (RLS) aktif pada tabel pkl_instansi. Silakan nonaktifkan RLS dengan perintah SQL: "ALTER TABLE pkl_instansi DISABLE ROW LEVEL SECURITY;"';
          }
          fromSupabase = true;
        }
      }
    } catch (e: any) {
      console.error('Supabase save instansi threw exception:', e);
      errorMsg = e?.message || String(e);
    }
  }

  // Update local storage for data alignment
  const list = localDb.get<PklInstansi>('SIM_PKL_INSTANSI');
  const index = list.findIndex(i => i.id === instansi.id || i.id === targetId);
  if (index !== -1) {
    list[index] = returnedInstansi;
  } else {
    list.push(returnedInstansi);
  }
  localDb.set('SIM_PKL_INSTANSI', list);

  // If instansi ID changed (e.g., from 'inst-1' to UUID), align local users & placements
  if (instansi.id !== targetId) {
    const users = localDb.get<PklUser>('SIM_PKL_USERS');
    let usersUpdated = false;
    const updatedUsers = users.map(u => {
      if (u.id_instansi === instansi.id) {
        usersUpdated = true;
        return { ...u, id_instansi: targetId };
      }
      return u;
    });
    if (usersUpdated) localDb.set('SIM_PKL_USERS', updatedUsers);

    const placements = localDb.get<PklPlacement>('SIM_PKL_PLACEMENTS');
    let placeUpdated = false;
    const updatedPlaces = placements.map(p => {
      if (p.id_instansi === instansi.id) {
        placeUpdated = true;
        return { ...p, id_instansi: targetId };
      }
      return p;
    });
    if (placeUpdated) localDb.set('SIM_PKL_PLACEMENTS', updatedPlaces);
  }

  if (!fromSupabase) success = true;
  return { success, data: returnedInstansi, fromSupabase, error: errorMsg };
}

export async function dbDeleteInstansi(id: string): Promise<{ success: boolean, fromSupabase: boolean, error?: string }> {
  let targetId = id;
  if (INSTANSI_MAP[id]) {
    targetId = INSTANSI_MAP[id];
  }

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let errorMsg = '';

  if (sb) {
    try {
      // 1. Unlink dependent users & placements in Supabase
      await sb.from('pkl_users').update({ id_instansi: null }).eq('id_instansi', targetId);
      await sb.from('pkl_placements').delete().eq('id_instansi', targetId);

      // 2. Delete instansi record
      const { error } = await sb.from('pkl_instansi').delete().eq('id', targetId);
      if (!error) {
        success = true;
        fromSupabase = true;
      } else {
        console.error('Supabase delete instansi failed:', error);
        errorMsg = error.message;
        if (error.code === '42501') {
          errorMsg = 'Row Level Security (RLS) aktif pada tabel pkl_instansi. Silakan nonaktifkan RLS dengan perintah SQL: "ALTER TABLE pkl_instansi DISABLE ROW LEVEL SECURITY;"';
        }
        fromSupabase = true;
      }
    } catch (e: any) {
      console.error('Supabase delete instansi exception:', e);
      errorMsg = e?.message || String(e);
    }
  }

  // Update local storage
  const list = localDb.get<PklInstansi>('SIM_PKL_INSTANSI');
  localDb.set('SIM_PKL_INSTANSI', list.filter(i => i.id !== id && i.id !== targetId));

  if (!fromSupabase) success = true;
  return { success, fromSupabase, error: errorMsg };
}

// ---------------------- PLACEMENTS ----------------------

export async function dbGetPlacements(): Promise<{ data: PklPlacement[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_placements').select('*');
      if (!error && data) {
        localDb.set('SIM_PKL_PLACEMENTS', data as PklPlacement[]);
        return { data: data as PklPlacement[], fromSupabase: true };
      }
    } catch (e) {}
  }
  return { data: localDb.get<PklPlacement>('SIM_PKL_PLACEMENTS'), fromSupabase: false };
}

export async function dbSavePlacement(placement: PklPlacement): Promise<{ success: boolean, data?: PklPlacement, fromSupabase: boolean, error?: string }> {
  // Ensure the ID is a valid UUID before saving
  if (!isUuid(placement.id)) {
    placement.id = generateUUID();
  }
  
  let mappedInstansiId = placement.id_instansi;
  // Map local mock instansi IDs to standard Supabase UUIDs
  if (mappedInstansiId && INSTANSI_MAP[mappedInstansiId]) {
    mappedInstansiId = INSTANSI_MAP[mappedInstansiId];
  }

  // Ensure id_instansi is a valid UUID before attempting to save to Supabase
  if (mappedInstansiId && !isUuid(mappedInstansiId)) {
    console.warn(`Invalid id_instansi UUID format: ${mappedInstansiId}`);
    return { success: false, fromSupabase: false, error: 'Format ID Instansi tidak valid.' };
  }

  const dbPlacement: PklPlacement = {
    ...placement,
    id_instansi: mappedInstansiId
  };

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = dbPlacement;
  let errorMsg = '';

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_placements').upsert(dbPlacement).select();
      if (!error && data && data.length > 0) {
        success = true;
        fromSupabase = true;
        returnedData = data[0] as PklPlacement;
      } else if (error) {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_placements not found, proceeding locally');
        } else {
          console.error('Supabase save placement failed:', error.message);
          errorMsg = error.message;
          if (error.code === '42501') {
            errorMsg = 'Row Level Security (RLS) aktif pada tabel pkl_placements. Silakan nonaktifkan RLS dengan perintah SQL: "ALTER TABLE pkl_placements DISABLE ROW LEVEL SECURITY;"';
          }
          fromSupabase = true;
        }
      } else {
        success = true;
        fromSupabase = true;
      }
    } catch (e: any) {
      console.error('Supabase save placement threw exception:', e);
      errorMsg = e?.message || String(e);
    }
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
  return { success, data: returnedData, fromSupabase, error: errorMsg };
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

export async function dbSaveJournal(journal: PklJournal): Promise<{ success: boolean, data?: PklJournal, fromSupabase: boolean, error?: string }> {
  // Ensure the ID is a valid UUID before saving
  if (!isUuid(journal.id)) {
    journal.id = generateUUID();
  }

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = journal;
  let errorMsg = '';

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_journals').upsert(journal).select();
      if (!error && data && data.length > 0) {
        success = true;
        fromSupabase = true;
        returnedData = data[0] as PklJournal;
      } else if (error) {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_journals not found, proceeding locally');
        } else {
          console.error('Supabase save journal failed:', error.message);
          errorMsg = error.message;
          if (error.code === '42501') {
            errorMsg = 'Row Level Security (RLS) aktif pada tabel pkl_journals. Silakan nonaktifkan RLS dengan perintah SQL: "ALTER TABLE pkl_journals DISABLE ROW LEVEL SECURITY;"';
          }
          fromSupabase = true;
        }
      } else {
        success = true;
        fromSupabase = true;
      }
    } catch (e: any) {
      console.error('Supabase save journal threw exception:', e);
      errorMsg = e?.message || String(e);
    }
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
  return { success, data: returnedData, fromSupabase, error: errorMsg };
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

export function deduplicateAttendance(records: PklAttendance[]): { cleanRecords: PklAttendance[], duplicateIdsToRemove: string[] } {
  const map = new Map<string, PklAttendance>();
  const duplicateIdsToRemove: string[] = [];

  for (const rec of records) {
    if (!rec || !rec.id_siswa || !rec.tanggal) continue;
    const key = `${rec.id_siswa}_${rec.tanggal}`;
    
    if (!map.has(key)) {
      map.set(key, rec);
    } else {
      const existing = map.get(key)!;
      let replaceExisting = false;

      const recHasKeluar = !!(rec.jam_keluar && rec.jam_keluar !== '-');
      const existingHasKeluar = !!(existing.jam_keluar && existing.jam_keluar !== '-');

      if (recHasKeluar && !existingHasKeluar) {
        replaceExisting = true;
      } else if (!recHasKeluar && existingHasKeluar) {
        replaceExisting = false;
      } else if (isUuid(rec.id) && !isUuid(existing.id)) {
        replaceExisting = true;
      } else if (rec.status_verifikasi === 'disetujui' && existing.status_verifikasi !== 'disetujui') {
        replaceExisting = true;
      }

      if (replaceExisting) {
        if (existing.id && isUuid(existing.id) && existing.id !== rec.id) {
          duplicateIdsToRemove.push(existing.id);
        }
        map.set(key, rec);
      } else {
        if (rec.id && isUuid(rec.id) && rec.id !== existing.id) {
          duplicateIdsToRemove.push(rec.id);
        }
      }
    }
  }

  return {
    cleanRecords: Array.from(map.values()),
    duplicateIdsToRemove
  };
}

export async function dbGetAttendance(): Promise<{ data: PklAttendance[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let rawData: PklAttendance[] = [];
  let fromSupabase = false;

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_attendance').select('*').order('tanggal', { ascending: false });
      if (!error && data) {
        rawData = data as PklAttendance[];
        fromSupabase = true;
      }
    } catch (e) {}
  }

  if (!fromSupabase) {
    rawData = localDb.get<PklAttendance>('SIM_PKL_ATTENDANCE');
  }

  const { cleanRecords, duplicateIdsToRemove } = deduplicateAttendance(rawData);

  // Sync clean records to local memory/storage
  localDb.set('SIM_PKL_ATTENDANCE', cleanRecords);

  // Asynchronously remove duplicate records from Supabase database if connected
  if (sb && fromSupabase && duplicateIdsToRemove.length > 0) {
    (async () => {
      try {
        const { error } = await sb.from('pkl_attendance').delete().in('id', duplicateIdsToRemove);
        if (!error) {
          console.log(`Deduplicated Supabase attendance: deleted ${duplicateIdsToRemove.length} duplicate rows.`);
        }
      } catch (e) {
        console.error('Failed to cleanup duplicate attendance rows in Supabase:', e);
      }
    })();
  }

  return { data: cleanRecords, fromSupabase };
}

export async function dbSaveAttendance(attendance: PklAttendance): Promise<{ success: boolean, data?: PklAttendance, fromSupabase: boolean, error?: string }> {
  const list = localDb.get<PklAttendance>('SIM_PKL_ATTENDANCE');

  // Find if an existing record already exists for this student & date
  const existingLocal = list.find(a => a.id_siswa === attendance.id_siswa && a.tanggal === attendance.tanggal);
  if (existingLocal && existingLocal.id && isUuid(existingLocal.id)) {
    attendance.id = existingLocal.id;
  }

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = attendance;
  let errorMsg = '';

  if (sb) {
    try {
      // Check Supabase for existing record if we don't have a UUID yet
      if (!attendance.id || !isUuid(attendance.id)) {
        const { data: existingSb } = await sb.from('pkl_attendance')
          .select('id')
          .eq('id_siswa', attendance.id_siswa)
          .eq('tanggal', attendance.tanggal)
          .limit(1);
        
        if (existingSb && existingSb.length > 0 && isUuid(existingSb[0].id)) {
          attendance.id = existingSb[0].id;
        }
      }

      // Ensure valid UUID
      if (!isUuid(attendance.id)) {
        attendance.id = generateUUID();
      }

      const { latitude, longitude, latitude_keluar, longitude_keluar, ...dbPayload } = attendance;
      const { data, error } = await sb.from('pkl_attendance').upsert(dbPayload).select();
      if (!error && data && data.length > 0) {
        success = true;
        fromSupabase = true;
        returnedData = data[0] as PklAttendance;
      } else if (error) {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_attendance not found, proceeding locally');
        } else {
          console.error('Supabase save attendance failed:', error.message);
          errorMsg = error.message;
          fromSupabase = true;
        }
      } else {
        success = true;
        fromSupabase = true;
      }
    } catch (e: any) {
      console.error('Supabase save attendance threw exception:', e);
      errorMsg = e?.message || String(e);
    }
  } else {
    if (!isUuid(attendance.id)) {
      attendance.id = generateUUID();
    }
  }

  // Update localDb list
  const existingIdx = list.findIndex(a => a.id === attendance.id || (a.id_siswa === attendance.id_siswa && a.tanggal === attendance.tanggal));
  if (existingIdx !== -1) {
    list[existingIdx] = returnedData;
  } else {
    list.push(returnedData);
  }

  const { cleanRecords } = deduplicateAttendance(list);
  localDb.set('SIM_PKL_ATTENDANCE', cleanRecords);

  if (!fromSupabase) success = true;
  return { success, data: returnedData, fromSupabase, error: errorMsg };
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

export async function dbSaveEvaluation(evaluation: PklEvaluation): Promise<{ success: boolean, data?: PklEvaluation, fromSupabase: boolean, error?: string }> {
  // Ensure the ID is a valid UUID before saving
  if (!isUuid(evaluation.id)) {
    evaluation.id = generateUUID();
  }

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = evaluation;
  let errorMsg = '';

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_evaluations').upsert(evaluation).select();
      if (!error && data && data.length > 0) {
        success = true;
        fromSupabase = true;
        returnedData = data[0] as PklEvaluation;
      } else if (error) {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_evaluations not found, proceeding locally');
        } else {
          console.error('Supabase save evaluation failed:', error.message);
          errorMsg = error.message;
          if (error.code === '42501') {
            errorMsg = 'Row Level Security (RLS) aktif pada tabel pkl_evaluations. Silakan nonaktifkan RLS dengan perintah SQL: "ALTER TABLE pkl_evaluations DISABLE ROW LEVEL SECURITY;"';
          }
          fromSupabase = true;
        }
      } else {
        success = true;
        fromSupabase = true;
      }
    } catch (e: any) {
      console.error('Supabase save evaluation threw exception:', e);
      errorMsg = e?.message || String(e);
    }
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
  return { success, data: returnedData, fromSupabase, error: errorMsg };
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

export async function dbSaveAnnouncement(announcement: Announcement): Promise<{ success: boolean, data?: Announcement, fromSupabase: boolean, error?: string }> {
  // Ensure the ID is a valid UUID before saving
  if (!isUuid(announcement.id)) {
    announcement.id = generateUUID();
  }

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = announcement;
  let errorMsg = '';

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_announcements').upsert(announcement).select();
      if (!error && data && data.length > 0) {
        success = true;
        fromSupabase = true;
        returnedData = data[0] as Announcement;
      } else if (error) {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_announcements not found, proceeding locally');
        } else {
          console.error('Supabase save announcement failed:', error.message);
          errorMsg = error.message;
          if (error.code === '42501') {
            errorMsg = 'Row Level Security (RLS) aktif pada tabel pkl_announcements. Silakan nonaktifkan RLS dengan perintah SQL: "ALTER TABLE pkl_announcements DISABLE ROW LEVEL SECURITY;"';
          }
          fromSupabase = true;
        }
      } else {
        success = true;
        fromSupabase = true;
      }
    } catch (e: any) {
      console.error('Supabase save announcement threw exception:', e);
      errorMsg = e?.message || String(e);
    }
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

    // Refresh instansis from Supabase to get real UUIDs if needed,
    // but to make it simple we will upsert with absolute IDs.
    // Let's also do users, placements, journals, attendance, evaluations, announcements.
    const users = localDb.get<PklUser>('SIM_PKL_USERS');
    for (const u of users) {
      let realIdInstansi = u.id_instansi;
      if (realIdInstansi && INSTANSI_MAP[realIdInstansi]) {
        realIdInstansi = INSTANSI_MAP[realIdInstansi];
      }
      if (realIdInstansi && !isUuid(realIdInstansi)) {
        realIdInstansi = null;
      }

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

    const placements = localDb.get<PklPlacement>('SIM_PKL_PLACEMENTS');
    for (const p of placements) {
      let realIdInstansi = p.id_instansi;
      if (realIdInstansi && INSTANSI_MAP[realIdInstansi]) {
        realIdInstansi = INSTANSI_MAP[realIdInstansi];
      }
      if (!realIdInstansi || !isUuid(realIdInstansi)) {
        console.warn(`Skipping placement sync for ${p.id_siswa} because id_instansi is invalid: ${realIdInstansi}`);
        continue;
      }

      await sb.from('pkl_placements').upsert({
        id: p.id.includes('place-') ? undefined : p.id,
        id_siswa: p.id_siswa,
        id_instansi: realIdInstansi,
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
    const { cleanRecords: cleanAtt } = deduplicateAttendance(attendance);

    // Fetch existing Supabase attendance records to map (id_siswa + tanggal) -> ID
    const { data: existingSbAtt } = await sb.from('pkl_attendance').select('id, id_siswa, tanggal');
    const sbAttMap = new Map<string, string>();
    if (existingSbAtt) {
      existingSbAtt.forEach((row: any) => {
        if (row.id_siswa && row.tanggal && row.id) {
          sbAttMap.set(`${row.id_siswa}_${row.tanggal}`, row.id);
        }
      });
    }

    for (const a of cleanAtt) {
      const key = `${a.id_siswa}_${a.tanggal}`;
      const existingSbId = sbAttMap.get(key);
      const targetId = (a.id && isUuid(a.id)) ? a.id : (existingSbId || generateUUID());

      await sb.from('pkl_attendance').upsert({
        id: targetId,
        id_siswa: a.id_siswa,
        tanggal: a.tanggal,
        jam_masuk: a.jam_masuk,
        jam_keluar: a.jam_keluar || null,
        status: a.status,
        keterangan: a.keterangan || null,
        status_verifikasi: a.status_verifikasi
      });
      sbAttMap.set(key, targetId);
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

    try {
      const monitorings = localDb.get<TeacherMonitoring>('SIM_PKL_TEACHER_MONITORING').filter(m => m && !m.id.startsWith('mon-'));
      for (const mon of monitorings) {
        await sb.from('pkl_teacher_monitoring').upsert({
          id: mon.id,
          id_guru: mon.id_guru,
          nama_guru: mon.nama_guru,
          tanggal: mon.tanggal,
          jam_monitoring: mon.jam_monitoring,
          tipe_monitoring: mon.tipe_monitoring,
          latitude: mon.latitude,
          longitude: mon.longitude,
          foto_url: mon.foto_url,
          catatan: mon.catatan,
          id_siswa: mon.id_siswa,
          nama_siswa: mon.nama_siswa,
          nama_instansi: mon.nama_instansi
        });
      }
    } catch (err) {
      console.warn('Skipping table pkl_teacher_monitoring sync - table might not exist in Supabase yet');
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
        if (data.length === 0) {
          console.log('Supabase pkl_classes table is empty, auto-seeding default classes...');
          await autoSeedSupabase(sb);
          const { data: refetched } = await sb.from('pkl_classes').select('*').order('nama_kelas');
          if (refetched && refetched.length > 0) {
            return { data: refetched as PklClass[], fromSupabase: true };
          }
        } else {
          return { data: data as PklClass[], fromSupabase: true };
        }
      }
    } catch (e) {}
  }
  return { data: localDb.get<PklClass>('SIM_PKL_CLASSES').sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas)), fromSupabase: false };
}

export async function dbSaveClass(cls: PklClass): Promise<{ success: boolean, data?: PklClass, fromSupabase: boolean, error?: string }> {
  // Ensure the ID is a valid UUID before saving
  if (!isUuid(cls.id)) {
    cls.id = generateUUID();
  }

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = cls;
  let errorMsg = '';

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_classes').upsert(cls).select();
      if (!error && data && data.length > 0) {
        success = true;
        fromSupabase = true;
        returnedData = data[0] as PklClass;
      } else if (error) {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_classes not found, proceeding locally');
        } else {
          console.error('Supabase save class failed:', error);
          errorMsg = error.message;
          if (error.code === '42501') {
            errorMsg = 'Row Level Security (RLS) aktif pada tabel pkl_classes. Silakan nonaktifkan RLS dengan perintah SQL: "ALTER TABLE pkl_classes DISABLE ROW LEVEL SECURITY;"';
          }
          fromSupabase = true;
        }
      } else {
        success = true;
        fromSupabase = true;
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

// ---------------------- MONITORING GURU ----------------------

export async function dbGetTeacherMonitorings(): Promise<{ data: TeacherMonitoring[], fromSupabase: boolean }> {
  const sb = getSupabaseClient();
  let allFetched: TeacherMonitoring[] = [];
  let fetchedFromSupabase = false;

  if (sb) {
    const candidateTables = [
      'pkl_teacher_monitoring',
      'pkl_teacher_monitorings',
      'pkl_monitoring_guru',
      'pkl_monitoring',
      'pkl_kunjungan_guru',
      'pkl_kunjungan'
    ];

    for (const tableName of candidateTables) {
      try {
        const { data, error } = await sb.from(tableName).select('*');
        if (!error && Array.isArray(data)) {
          fetchedFromSupabase = true;
          if (data.length > 0) {
            const normalized = data.map((item: any) => ({
              id: String(item.id || item.monitoring_id || item.id_monitoring || generateUUID()),
              id_guru: item.id_guru || item.guru_id || item.email_guru || item.guru_email || item.user_id || item.id_user || item.nip || '',
              nama_guru: item.nama_guru || item.guru_nama || item.guru || item.nama || item.nama_pembimbing || item.pembimbing || '',
              tanggal: item.tanggal || item.tgl || item.date || (item.created_at ? String(item.created_at).split('T')[0] : ''),
              jam_monitoring: item.jam_monitoring || item.jam || item.waktu || item.time || item.jam_kunjungan || '',
              tipe_monitoring: item.tipe_monitoring || item.tipe || item.type || item.tipeMonitoring || item.tipe_kunjungan || item.kunjungan || 'Monitoring 1',
              latitude: item.latitude != null ? Number(item.latitude) : (item.lat != null ? Number(item.lat) : (item.lat_gps != null ? Number(item.lat_gps) : undefined)),
              longitude: item.longitude != null ? Number(item.longitude) : (item.lng != null ? Number(item.lng) : (item.long != null ? Number(item.long) : (item.lng_gps != null ? Number(item.lng_gps) : undefined))),
              foto_url: item.foto_url || item.foto || item.bukti || item.image_url || item.url_foto || item.foto_bukti || undefined,
              catatan: item.catatan || item.keterangan || item.catatan_kunjungan || item.notes || item.deskripsi || undefined,
              id_siswa: item.id_siswa || item.siswa_id || undefined,
              nama_siswa: item.nama_siswa || item.siswa || item.nama_siswa_monitored || undefined,
              id_instansi: item.id_instansi || item.instansi_id || undefined,
              nama_instansi: item.nama_instansi || item.instansi || item.perusahaan || item.nama_perusahaan || item.dudi || item.nama_dudi || undefined,
              created_at: item.created_at
            }));

            allFetched.push(...normalized);
            break; // Stop querying once candidate table with data is found
          }
        }
      } catch (e) {
        // try next table candidate
      }
    }
  }

  if (fetchedFromSupabase) {
    // Sort by tanggal & jam_monitoring descending (latest first)
    allFetched.sort((a, b) => {
      const timeA = `${a.tanggal || ''} ${a.jam_monitoring || ''}`;
      const timeB = `${b.tanggal || ''} ${b.jam_monitoring || ''}`;
      return timeB.localeCompare(timeA);
    });

    // Deduplicate by ID or unique key
    const seen = new Set<string>();
    const uniqueData: TeacherMonitoring[] = [];
    for (const item of allFetched) {
      const key = item.id || `${item.id_guru}_${item.nama_guru}_${item.nama_instansi}_${item.tanggal}_${item.tipe_monitoring}_${item.jam_monitoring}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(item);
      }
    }

    localDb.set('SIM_PKL_TEACHER_MONITORING', uniqueData);
    return { data: uniqueData, fromSupabase: true };
  }

  // Fallback to local storage if Supabase is unavailable or table query failed
  const localData = localDb.get<TeacherMonitoring>('SIM_PKL_TEACHER_MONITORING');
  const arrLocal = Array.isArray(localData) ? localData : [];

  arrLocal.sort((a, b) => {
    const timeA = `${a.tanggal || ''} ${a.jam_monitoring || ''}`;
    const timeB = `${b.tanggal || ''} ${b.jam_monitoring || ''}`;
    return timeB.localeCompare(timeA);
  });

  const seenLocal = new Set<string>();
  const uniqueLocal: TeacherMonitoring[] = [];
  for (const item of arrLocal) {
    const key = item.id || `${item.id_guru}_${item.nama_guru}_${item.nama_instansi}_${item.tanggal}_${item.tipe_monitoring}_${item.jam_monitoring}`;
    if (!seenLocal.has(key)) {
      seenLocal.add(key);
      uniqueLocal.push(item);
    }
  }

  return { data: uniqueLocal, fromSupabase: false };
}

export async function dbSaveTeacherMonitoring(monitoring: TeacherMonitoring): Promise<{ success: boolean, data?: TeacherMonitoring, fromSupabase: boolean, error?: string }> {
  if (!isUuid(monitoring.id)) {
    monitoring.id = generateUUID();
  }

  // Guarantee tipe_monitoring is populated
  if (!monitoring.tipe_monitoring) {
    monitoring.tipe_monitoring = (monitoring as any).tipe || (monitoring as any).tipeMonitoring || 'Monitoring 1';
  }

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let returnedData = monitoring;
  let errorMsg = '';

  if (sb) {
    const candidateTables = [
      'pkl_teacher_monitoring',
      'pkl_teacher_monitorings',
      'pkl_monitoring_guru',
      'pkl_monitoring',
      'pkl_kunjungan_guru',
      'pkl_kunjungan'
    ];

    const trySupabaseSave = async () => {
      for (const tableName of candidateTables) {
        try {
          // Server-side duplicate check before inserting new row
          const selectPromise = sb
            .from(tableName)
            .select('*')
            .eq('tanggal', monitoring.tanggal)
            .eq('tipe_monitoring', monitoring.tipe_monitoring);

          const { data: existingRows } = await Promise.race([
            selectPromise,
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
          ]).catch(() => ({ data: null }));

          if (Array.isArray(existingRows) && existingRows.length > 0) {
            const isDup = existingRows.some((r: any) => {
              const sameGuru = (r.id_guru === monitoring.id_guru || r.nama_guru === monitoring.nama_guru);
              const sameInstansi = (r.id_siswa === monitoring.id_siswa || 
                                   (r.nama_instansi && monitoring.nama_instansi && String(r.nama_instansi).toLowerCase().trim() === String(monitoring.nama_instansi).toLowerCase().trim()));
              return sameGuru && sameInstansi;
            });

            if (isDup) {
              return {
                isDuplicateError: true,
                error: `Laporan ${monitoring.tipe_monitoring} untuk ${monitoring.nama_instansi || 'instansi ini'} pada tanggal ${monitoring.tanggal} sudah pernah tersimpan.`
              };
            }
          }

          const upsertPromise = sb.from(tableName).upsert(monitoring).select();
          const { data, error } = await Promise.race([
            upsertPromise,
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000))
          ]);

          if (!error && data && data.length > 0) {
            return { success: true, returnedData: data[0] as TeacherMonitoring };
          } else if (!error) {
            return { success: true, returnedData: monitoring };
          }
        } catch (e: any) {
          errorMsg = e?.message || String(e);
        }
      }
      return null;
    };

    try {
      const resSb = await Promise.race([
        trySupabaseSave(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
      ]);

      if (resSb?.isDuplicateError) {
        return {
          success: false,
          fromSupabase: true,
          error: resSb.error
        };
      }

      if (resSb?.success) {
        success = true;
        fromSupabase = true;
        if (resSb.returnedData) {
          returnedData = resSb.returnedData;
        }
      }
    } catch (sbErr: any) {
      console.warn('Supabase save operation timed out or failed, falling back to local DB:', sbErr);
    }
  }

  // Update locally too (as fallback cache)
  try {
    const monitorings = localDb.get<TeacherMonitoring>('SIM_PKL_TEACHER_MONITORING');
    const existingIdx = monitorings.findIndex(m => 
      m.id === monitoring.id || 
      (m.id_guru === monitoring.id_guru && m.nama_instansi === monitoring.nama_instansi && m.tanggal === monitoring.tanggal && m.tipe_monitoring === monitoring.tipe_monitoring)
    );
    
    if (existingIdx >= 0) {
      monitorings[existingIdx] = returnedData;
    } else {
      monitorings.push(returnedData);
    }
    
    localDb.set('SIM_PKL_TEACHER_MONITORING', monitorings);
  } catch (errLocal) {
    console.warn('Local storage cache update failed in dbSaveTeacherMonitoring:', errLocal);
  }

  if (!fromSupabase) {
    success = true;
  }

  return { success, data: returnedData, fromSupabase, error: errorMsg };
}

export async function dbDeleteTeacherMonitoring(id: string): Promise<{ success: boolean, fromSupabase: boolean, error?: string }> {
  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let errorMsg = '';

  if (sb) {
    try {
      const { error } = await sb.from('pkl_teacher_monitoring').delete().eq('id', id);
      if (!error) {
        success = true;
        fromSupabase = true;
      } else {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_teacher_monitoring not found, proceeding locally');
        } else {
          console.error('Supabase delete teacher monitoring failed:', error);
          errorMsg = error.message;
          fromSupabase = true;
        }
      }
    } catch (e: any) {
      console.error('Supabase delete teacher monitoring failed:', e);
      errorMsg = e?.message || String(e);
    }
  }

  const monitorings = localDb.get<TeacherMonitoring>('SIM_PKL_TEACHER_MONITORING');
  localDb.set('SIM_PKL_TEACHER_MONITORING', monitorings.filter(m => m.id !== id));

  if (!fromSupabase) {
    success = true;
  }

  return { success, fromSupabase, error: errorMsg };
}

export async function dbGetSettings(): Promise<{ [key: string]: string }> {
  const sb = getSupabaseClient();
  const settings: { [key: string]: string } = {};
  
  // Load defaults
  const defaults: { [key: string]: string } = {
    kop_atas: 'PEMERINTAH PROVINSI JAWA BARAT',
    kop_tengah: 'DINAS PENDIDIKAN',
    kop_sekolah: 'SMK NEGERI 1 KOTA BANDUNG',
    kop_sub: 'Bidang Keahlian: Teknologi Informasi dan Komunikasi',
    kop_alamat: 'Jl. Wastukencana No.12, Kec. Sumur Bandung, Kota Bandung, Jawa Barat 40117',
    kop_kontak: 'Telp: (022) 4204515 | Email: info@smkn1bandung.sch.id | Website: www.smkn1bandung.sch.id',
    kop_logo: ''
  };

  // Merge with localStorage first as cache/fallback
  Object.keys(defaults).forEach(key => {
    settings[key] = localStorage.getItem(key) || defaults[key];
  });

  if (sb) {
    try {
      const { data, error } = await sb.from('pkl_settings').select('*');
      if (!error && data) {
        data.forEach((row: { key: string, value: string }) => {
          settings[row.key] = row.value;
          localStorage.setItem(row.key, row.value);
        });
      } else {
        if (error && (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist'))) {
          console.warn('Supabase table pkl_settings not found, using local storage fallback');
        }
      }
    } catch (e) {
      console.error('Supabase get settings failed:', e);
    }
  }

  return settings;
}

export async function dbSaveSetting(key: string, value: string): Promise<{ success: boolean, fromSupabase: boolean, error?: string }> {
  // Save to localStorage immediately
  localStorage.setItem(key, value);

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let errorMsg = '';

  if (sb) {
    try {
      const { error } = await sb.from('pkl_settings').upsert({ key, value });
      if (!error) {
        success = true;
        fromSupabase = true;
      } else {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_settings not found, saved to local storage only');
        } else {
          console.error('Supabase save setting failed:', error);
          errorMsg = error.message;
          fromSupabase = true;
        }
      }
    } catch (e: any) {
      console.error('Supabase save setting failed:', e);
      errorMsg = e?.message || String(e);
    }
  }

  if (!fromSupabase) {
    success = true;
  }

  return { success, fromSupabase, error: errorMsg };
}

export async function dbResetSettings(): Promise<{ success: boolean, fromSupabase: boolean, error?: string }> {
  const keys = ['kop_atas', 'kop_tengah', 'kop_sekolah', 'kop_sub', 'kop_alamat', 'kop_kontak', 'kop_logo'];
  keys.forEach(key => localStorage.removeItem(key));

  const sb = getSupabaseClient();
  let fromSupabase = false;
  let success = false;
  let errorMsg = '';

  if (sb) {
    try {
      const { error } = await sb.from('pkl_settings').delete().in('key', keys);
      if (!error) {
        success = true;
        fromSupabase = true;
      } else {
        if (error.code === 'P0001' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Supabase table pkl_settings not found, cleared local storage only');
        } else {
          console.error('Supabase reset settings failed:', error);
          errorMsg = error.message;
          fromSupabase = true;
        }
      }
    } catch (e: any) {
      console.error('Supabase reset settings failed:', e);
      errorMsg = e?.message || String(e);
    }
  }

  if (!fromSupabase) {
    success = true;
  }

  return { success, fromSupabase, error: errorMsg };
}

// ---------------------- ONLINE USER TRACKING ----------------------

export async function dbUpdateUserHeartbeat(user: PklUser): Promise<OnlineUserSession[]> {
  try {
    const raw = localStorage.getItem('SIM_PKL_ONLINE_SESSIONS');
    let sessions: OnlineUserSession[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    
    // Filter out inactive sessions (> 3 minutes)
    sessions = sessions.filter(s => now - s.lastActive < 3 * 60 * 1000);
    
    // Resolve instansi & guru pembimbing
    let nama_instansi = '';
    let nama_guru_pembimbing = '';
    let id_instansi = user.id_instansi || '';
    let id_pembimbing = user.id_pembimbing || '';

    try {
      // 1. Resolve Instansi
      if (id_instansi) {
        const rawInst = localStorage.getItem('SIM_PKL_INSTANSI');
        if (rawInst) {
          const instansiList: PklInstansi[] = JSON.parse(rawInst);
          const matched = instansiList.find(i => i.id === id_instansi);
          if (matched) nama_instansi = matched.nama_instansi;
        }
      }

      // If user is siswa and instansi not set yet, check placements
      if (!nama_instansi && user.role === 'siswa') {
        const rawPlace = localStorage.getItem('SIM_PKL_PLACEMENTS');
        if (rawPlace) {
          const placements: PklPlacement[] = JSON.parse(rawPlace);
          const pl = placements.find(p => p.id_siswa === user.id);
          if (pl) {
            id_instansi = pl.id_instansi;
            const rawInst = localStorage.getItem('SIM_PKL_INSTANSI');
            if (rawInst) {
              const instansiList: PklInstansi[] = JSON.parse(rawInst);
              const matched = instansiList.find(i => i.id === pl.id_instansi);
              if (matched) nama_instansi = matched.nama_instansi;
            }
          }
        }
      }

      // 2. Resolve Guru Pembimbing
      if (user.role === 'guru') {
        nama_guru_pembimbing = user.nama;
      } else if (id_pembimbing) {
        const rawUsers = localStorage.getItem('SIM_PKL_USERS');
        if (rawUsers) {
          const usersList: PklUser[] = JSON.parse(rawUsers);
          const matchedGuru = usersList.find(u => u.id === id_pembimbing);
          if (matchedGuru) nama_guru_pembimbing = matchedGuru.nama;
        }
      }
    } catch (e) {}

    const existingIndex = sessions.findIndex(s => s.userId === user.id || s.email === user.email);
    const updatedSession: OnlineUserSession = {
      userId: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role,
      kelas: user.kelas,
      nomor_induk: user.nomor_induk,
      id_instansi,
      nama_instansi,
      id_pembimbing,
      nama_guru_pembimbing,
      lastActive: now,
      deviceInfo: typeof navigator !== 'undefined' ? (navigator.userAgent.includes('Mobile') ? 'Smartphone' : 'Desktop/Laptop') : 'Web'
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = updatedSession;
    } else {
      sessions.push(updatedSession);
    }

    localStorage.setItem('SIM_PKL_ONLINE_SESSIONS', JSON.stringify(sessions));

    // Try storing in Supabase pkl_settings or broadcasting if available
    const sb = getSupabaseClient();
    if (sb) {
      try {
        await sb.from('pkl_settings').upsert({
          key: `online_${user.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          value: JSON.stringify(updatedSession)
        });
      } catch (err) {}
    }

    return sessions;
  } catch (e) {
    console.error('Heartbeat update error:', e);
    return [];
  }
}

export async function dbRemoveUserOnlineSession(userId: string) {
  try {
    const raw = localStorage.getItem('SIM_PKL_ONLINE_SESSIONS');
    if (raw) {
      let sessions: OnlineUserSession[] = JSON.parse(raw);
      sessions = sessions.filter(s => s.userId !== userId && s.email !== userId);
      localStorage.setItem('SIM_PKL_ONLINE_SESSIONS', JSON.stringify(sessions));
    }

    const sb = getSupabaseClient();
    if (sb) {
      try {
        await sb.from('pkl_settings').delete().eq('key', `online_${userId.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
      } catch (err) {}
    }
  } catch (e) {
    console.error('Remove online session error:', e);
  }
}

export async function dbGetOnlineUsers(): Promise<OnlineUserSession[]> {
  const now = Date.now();
  let localSessions: OnlineUserSession[] = [];
  try {
    const raw = localStorage.getItem('SIM_PKL_ONLINE_SESSIONS');
    if (raw) {
      localSessions = JSON.parse(raw);
      localSessions = localSessions.filter(s => now - s.lastActive < 3 * 60 * 1000);
    }
  } catch (e) {}

  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data } = await sb.from('pkl_settings').select('key, value').like('key', 'online_%');
      if (data && data.length > 0) {
        const remoteSessions: OnlineUserSession[] = [];
        data.forEach((row: any) => {
          try {
            const parsed: OnlineUserSession = JSON.parse(row.value);
            if (now - parsed.lastActive < 3 * 60 * 1000) {
              remoteSessions.push(parsed);
            }
          } catch (e2) {}
        });

        // Merge local & remote sessions by email
        const sessionMap = new Map<string, OnlineUserSession>();
        localSessions.forEach(s => sessionMap.set(s.email, s));
        remoteSessions.forEach(s => {
          const existing = sessionMap.get(s.email);
          if (!existing || s.lastActive > existing.lastActive) {
            sessionMap.set(s.email, s);
          }
        });
        const merged = Array.from(sessionMap.values());
        localStorage.setItem('SIM_PKL_ONLINE_SESSIONS', JSON.stringify(merged));
        return merged;
      }
    } catch (e) {}
  }

  return localSessions;
}


