export type UserRole = 'siswa' | 'guru' | 'industri' | 'admin';

export interface PklUser {
  id: string;
  email: string;
  password?: string; // Sandi login pengguna (default: 'password123' atau nomor_induk)
  nama: string;
  role: UserRole;
  nomor_induk: string; // NISN untuk siswa, NIP/NIK untuk guru/pembimbing
  telepon: string;
  kelas?: string; // Kelas siswa (contoh: XI RPL 1)
  jurusan?: string; // Jurusan siswa (contoh: Rekayasa Perangkat Lunak)
  id_instansi?: string; // Terhubung ke instansi untuk siswa & pembimbing industri
  id_pembimbing?: string; // Siswa dibimbing oleh guru siapa
  created_at?: string;
}

export interface PklInstansi {
  id: string;
  nama_instansi: string;
  alamat: string;
  kuota: number;
  pembimbing_nama?: string;
  pembimbing_telp?: string;
  created_at?: string;
}

export interface PklPlacement {
  id: string;
  id_siswa: string;
  id_instansi: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: 'draft' | 'pending' | 'disetujui' | 'ditolak';
  catatan?: string;
  created_at?: string;
}

export interface PklJournal {
  id: string;
  id_siswa: string;
  tanggal: string;
  kegiatan: string;
  ringkasan_belajar: string;
  foto_url?: string;
  status: 'pending' | 'diverifikasi' | 'revisi';
  catatan_pembimbing?: string;
  created_at?: string;
}

export interface PklAttendance {
  id: string;
  id_siswa: string;
  tanggal: string;
  jam_masuk: string;
  jam_keluar?: string;
  status: 'hadir' | 'sakit' | 'izin' | 'alfa';
  keterangan?: string;
  status_verifikasi: 'pending' | 'disetujui' | 'ditolak';
  latitude?: number;
  longitude?: number;
  latitude_keluar?: number;
  longitude_keluar?: number;
  created_at?: string;
}

export interface PklEvaluation {
  id: string;
  id_siswa: string;
  nilai_industri_teknis: number; // Nilai kerja / teknis dari industri
  nilai_industri_nonteknis: number; // Nilai soft skill / kerja sama dari industri
  nilai_industri_disiplin: number; // Nilai kedisiplinan dari industri
  nilai_sekolah_laporan: number; // Nilai penulisan laporan oleh guru
  nilai_sekolah_presentasi: number; // Nilai ujian/presentasi oleh guru
  catatan_industri?: string;
  catatan_sekolah?: string;
  created_at?: string;
}

export interface Announcement {
  id: string;
  judul: string;
  konten: string;
  tanggal: string;
  author: string;
}

export interface PklClass {
  id: string;
  nama_kelas: string;
  jurusan: string;
}

export interface MenuAccess {
  id: string;
  nama_menu: string;
  kategori: 'Utama' | 'Siswa' | 'Guru' | 'Industri' | 'Admin';
  allowed_roles: UserRole[];
  deskripsi: string;
}


