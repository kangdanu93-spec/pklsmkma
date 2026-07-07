import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, FileCheck, Calendar, Star, RefreshCw, Plus, Trash2, 
  UserPlus, Check, X, ClipboardList, ShieldAlert, Download, Phone, MapPin,
  FileSpreadsheet, UploadCloud, Shield, BookOpen, GraduationCap, UserCheck,
  Settings
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PklUser, PklInstansi, PklPlacement, PklEvaluation, Announcement, UserRole, PklClass, MenuAccess } from '../types';
import { 
  dbGetUsers, dbSaveUser, dbDeleteUser, 
  dbGetInstansi, dbSaveInstansi, dbDeleteInstansi, 
  dbGetPlacements, dbSavePlacement, 
  dbGetEvaluations, 
  dbGetAnnouncements, dbSaveAnnouncement, dbDeleteAnnouncement,
  dbGetAttendance, dbGetClasses, dbSaveClass, dbDeleteClass,
  dbGetMenuAccess, dbSaveMenuAccess, isSuperAdmin
} from '../utils/localDb';

const STATIC_KELAS_OPTIONS = [
  'XII RPL 1',
  'XII RPL 2',
  'XII TKJ 1',
  'XII TKJ 2',
  'XII TKR',
  'XII DKV'
];

const STATIC_JURUSAN_OPTIONS = [
  'Rekayasa Perangkat Lunak',
  'Teknik Komputer & Jaringan',
  'Teknik Kendaraan Ringan',
  'Desain Komunikasi Visual'
];

interface AdminDashboardProps {
  admin: PklUser;
  onRefreshGlobalData: () => void;
}

export default function AdminDashboard({ admin, onRefreshGlobalData }: AdminDashboardProps) {
  const [users, setUsers] = useState<PklUser[]>([]);
  const [instansiList, setInstansiList] = useState<PklInstansi[]>([]);
  const [placements, setPlacements] = useState<PklPlacement[]>([]);
  const [evaluations, setEvaluations] = useState<PklEvaluation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<PklClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Active sub-tab state ('placements' | 'students' | 'teachers' | 'users' | 'companies' | 'reports' | 'classes' | 'permissions')
  const [activeTab, setActiveTab] = useState<'placements' | 'students' | 'teachers' | 'users' | 'companies' | 'reports' | 'classes' | 'permissions'>('placements');

  // Dynamic dropdown options calculated from master classes state, with static fallbacks
  const KELAS_OPTIONS = classesList.length > 0
    ? classesList.map(c => c.nama_kelas)
    : STATIC_KELAS_OPTIONS;

  const JURUSAN_OPTIONS = classesList.length > 0
    ? Array.from(new Set(classesList.map(c => c.jurusan))).filter(Boolean)
    : STATIC_JURUSAN_OPTIONS;

  // New Class Form State
  const [clsNamaKelas, setClsNamaKelas] = useState('');
  const [clsJurusan, setClsJurusan] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classSuccess, setClassSuccess] = useState('');

  // New User Form State
  const [userEmail, setUserEmail] = useState('');
  const [userNama, setUserNama] = useState('');
  const [userRole, setUserRole] = useState<UserRole>('siswa');
  const [userNomorInduk, setUserNomorInduk] = useState('');
  const [userTelepon, setUserTelepon] = useState('');
  const [userPassword, setUserPassword] = useState('password123');
  const [userKelas, setUserKelas] = useState('');
  const [userJurusan, setUserJurusan] = useState('');
  const [userIdInstansi, setUserIdInstansi] = useState('');
  const [userIdPembimbing, setUserIdPembimbing] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  // Editing User Master State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('siswa');
  const [editNomorInduk, setEditNomorInduk] = useState('');
  const [editTelepon, setEditTelepon] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editKelas, setEditKelas] = useState('');
  const [editJurusan, setEditJurusan] = useState('');
  const [editIdInstansi, setEditIdInstansi] = useState('');
  const [editIdPembimbing, setEditIdPembimbing] = useState('');

  // New Instansi Form State
  const [instNama, setInstNama] = useState('');
  const [instAlamat, setInstAlamat] = useState('');
  const [instKuota, setInstKuota] = useState(1);
  const [instPembimbingNama, setInstPembimbingNama] = useState('');
  const [instPembimbingTelp, setInstPembimbingTelp] = useState('');
  const [instSuccess, setInstSuccess] = useState('');

  // New Announcement Form State
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annSuccess, setAnnSuccess] = useState('');

  // Edit states / Selection states
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentMasterId, setEditingStudentMasterId] = useState<string | null>(null);
  const [editingTeacherMasterId, setEditingTeacherMasterId] = useState<string | null>(null);
  const [tempPembimbingId, setTempPembimbingId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragOverTeacher, setIsDragOverTeacher] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: string; error?: string } | null>(null);
  const [teacherImportStatus, setTeacherImportStatus] = useState<{ success?: string; error?: string } | null>(null);

  // Menu permissions
  const [menuAccessList, setMenuAccessList] = useState<MenuAccess[]>([]);
  const [permissionsSuccess, setPermissionsSuccess] = useState('');

  const fetchPermissionsData = () => {
    const perms = dbGetMenuAccess();
    setMenuAccessList(perms);
  };

  const handleTogglePermission = (menuId: string, role: UserRole) => {
    const updated = menuAccessList.map(menu => {
      if (menu.id === menuId) {
        let roles = [...menu.allowed_roles];
        if (roles.includes(role)) {
          roles = roles.filter(r => r !== role);
        } else {
          roles.push(role);
        }
        return { ...menu, allowed_roles: roles };
      }
      return menu;
    });
    setMenuAccessList(updated);
    dbSaveMenuAccess(updated);
    setPermissionsSuccess('Konfigurasi Hak Akses berhasil disimpan secara real-time!');
    setTimeout(() => setPermissionsSuccess(''), 3000);
    onRefreshGlobalData(); // trigger immediate refresh in the main App component
  };

  const isTabAllowed = (tabMenuId: string): boolean => {
    if (!admin) return false;
    if (isSuperAdmin(admin)) return true;
    const menu = menuAccessList.find(m => m.id === tabMenuId);
    if (!menu) return true;
    return menu.allowed_roles.includes(admin.role);
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      fetchPermissionsData();
      const resUsers = await dbGetUsers();
      setUsers(resUsers.data);

      const resInst = await dbGetInstansi();
      setInstansiList(resInst.data);

      const resPlace = await dbGetPlacements();
      setPlacements(resPlace.data);

      const resEvals = await dbGetEvaluations();
      setEvaluations(resEvals.data);

      const resAnns = await dbGetAnnouncements();
      setAnnouncements(resAnns.data);

      const resAtt = await dbGetAttendance();
      setAttendance(resAtt.data);

      const resClasses = await dbGetClasses();
      setClassesList(resClasses.data);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ---------------- USER MANAGEMENT ----------------
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim() || !userNama.trim() || !userNomorInduk.trim() || !userTelepon.trim()) {
      alert('Silakan lengkapi semua bidang pengguna!');
      return;
    }

    const newUser: PklUser = {
      id: userEmail.trim(), // Use email as unique identifier
      email: userEmail.trim().toLowerCase(),
      password: userPassword.trim() || 'password123',
      nama: userNama.trim(),
      role: userRole,
      nomor_induk: userNomorInduk.trim(),
      telepon: userTelepon.trim(),
      kelas: userRole === 'siswa' ? userKelas.trim() : undefined,
      jurusan: userRole === 'siswa' ? userJurusan.trim() : undefined,
      id_instansi: userIdInstansi || undefined,
      id_pembimbing: userIdPembimbing || undefined,
    };

    const res = await dbSaveUser(newUser);
    if (res.success) {
      setUserSuccess('Pengguna baru berhasil ditambahkan!');
      setUserEmail('');
      setUserNama('');
      setUserNomorInduk('');
      setUserTelepon('');
      setUserPassword('password123');
      setUserKelas('');
      setUserJurusan('');
      setUserIdInstansi('');
      setUserIdPembimbing('');
      fetchAdminData();
      onRefreshGlobalData();
      setTimeout(() => setUserSuccess(''), 4000);
    }
  };

  // ---------------- EXCEL IMPORT & EXPORT ----------------
  const handleDownloadTemplate = () => {
    try {
      const templateData = [
        {
          'NISN': '1234567890',
          'Nama Lengkap': 'Budi Santoso',
          'Kelas': 'XII TKR',
          'Jurusan': 'Teknik Kendaraan Ringan',
          'Password': 'password123'
        },
        {
          'NISN': '1234567891',
          'Nama Lengkap': 'Siti Aminah',
          'Kelas': 'XII DKV',
          'Jurusan': 'Desain Komunikasi Visual',
          'Password': 'password123'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      
      // Set column widths for better readability
      const colWidths = [
        { wch: 15 }, // NISN
        { wch: 25 }, // Nama Lengkap
        { wch: 12 }, // Kelas
        { wch: 30 }, // Jurusan
        { wch: 15 }  // Password
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Siswa');
      
      XLSX.writeFile(workbook, 'Template_Upload_Siswa_PKL.xlsx');
    } catch (err) {
      console.error('Gagal mengunduh template:', err);
      alert('Gagal mengunduh template Excel!');
    }
  };

  const processExcelFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const binaryString = evt.target?.result;
        if (!binaryString) return;

        const workbook = XLSX.read(binaryString, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        if (json.length === 0) {
          setImportStatus({ error: 'File Excel kosong atau tidak terbaca.' });
          return;
        }

        // Check required columns
        const sampleRow = json[0];
        const requiredFields = ['NISN', 'Nama Lengkap', 'Kelas', 'Jurusan'];
        const missingFields = requiredFields.filter(f => !(f in sampleRow));
        if (missingFields.length > 0) {
          setImportStatus({ 
            error: `Format kolom salah! Kolom berikut wajib ada: ${missingFields.join(', ')}` 
          });
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const row of json) {
          const nama = String(row['Nama Lengkap'] || '').trim();
          const nisn = String(row['NISN'] || '').trim();
          const kelas = String(row['Kelas'] || '').trim();
          const jurusan = String(row['Jurusan'] || '').trim();
          const password = String(row['Password'] || 'password123').trim();
          const email = `${nisn}@siswa.simpkl.com`;
          const telepon = '-';

          if (!nisn || !nama) {
            errorCount++;
            continue;
          }

          const studentUser: PklUser = {
            id: email, // Email used as unique key
            email: email,
            password: password,
            nama: nama,
            role: 'siswa',
            nomor_induk: nisn,
            telepon: telepon,
            kelas: kelas || undefined,
            jurusan: jurusan || undefined
          };

          const res = await dbSaveUser(studentUser);
          if (res.success) {
            successCount++;
          } else {
            errorCount++;
          }
        }

        setImportStatus({ 
          success: `Berhasil mengimpor ${successCount} data siswa! (Gagal/Lewati: ${errorCount} baris)` 
        });
        fetchAdminData();
        onRefreshGlobalData();
      } catch (err) {
        console.error('Error processing excel:', err);
        setImportStatus({ error: 'Gagal menguraikan file Excel. Pastikan format file sesuai.' });
      }
    };

    reader.onerror = () => {
      setImportStatus({ error: 'Gagal membaca file.' });
    };

    reader.readAsBinaryString(file);
  };

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportStatus(null);
      processExcelFile(file);
    }
  };

  // ---------------- GURU PEMBIMBING EXCEL IMPORT ----------------
  const handleDownloadTeacherTemplate = () => {
    try {
      const templateData = [
        {
          'NIP/NIK': '19750821001',
          'Nama Lengkap': 'Drs. Ahmad Junaidi',
          'Telepon': '081234567890',
          'Password': 'password123'
        },
        {
          'NIP/NIK': '19820412002',
          'Nama Lengkap': 'Dewi Lestari M.Pd',
          'Telepon': '081299887766',
          'Password': 'password123'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      
      const colWidths = [
        { wch: 20 }, // NIP/NIK
        { wch: 30 }, // Nama Lengkap
        { wch: 18 }, // Telepon
        { wch: 15 }  // Password
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Guru Pembimbing');
      
      XLSX.writeFile(workbook, 'Template_Upload_Guru_Pembimbing_PKL.xlsx');
    } catch (err) {
      console.error('Gagal mengunduh template:', err);
      alert('Gagal mengunduh template Excel!');
    }
  };

  const processTeacherExcelFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const binaryString = evt.target?.result;
        if (!binaryString) return;

        const workbook = XLSX.read(binaryString, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<any>(worksheet);

        if (json.length === 0) {
          setTeacherImportStatus({ error: 'File Excel kosong atau tidak terbaca.' });
          return;
        }

        // Check required columns
        const sampleRow = json[0];
        const requiredFields = ['NIP/NIK', 'Nama Lengkap', 'Telepon'];
        const missingFields = requiredFields.filter(f => !(f in sampleRow));
        if (missingFields.length > 0) {
          setTeacherImportStatus({ 
            error: `Format kolom salah! Kolom berikut wajib ada: ${missingFields.join(', ')}` 
          });
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const row of json) {
          const nama = String(row['Nama Lengkap'] || '').trim();
          const nip = String(row['NIP/NIK'] || '').trim();
          const telepon = String(row['Telepon'] || '').trim();
          const password = String(row['Password'] || 'password123').trim();
          const email = `${nip}@guru.simpkl.com`;

          if (!nip || !nama) {
            errorCount++;
            continue;
          }

          const teacherUser: PklUser = {
            id: email, // Email used as unique key
            email: email,
            password: password,
            nama: nama,
            role: 'guru',
            nomor_induk: nip,
            telepon: telepon || '-'
          };

          const res = await dbSaveUser(teacherUser);
          if (res.success) {
            successCount++;
          } else {
            errorCount++;
          }
        }

        setTeacherImportStatus({ 
          success: `Berhasil mengimpor ${successCount} data guru pembimbing! (Gagal/Lewati: ${errorCount} baris)` 
        });
        fetchAdminData();
        onRefreshGlobalData();
      } catch (err) {
        console.error('Error processing excel:', err);
        setTeacherImportStatus({ error: 'Gagal menguraikan file Excel. Pastikan format file sesuai.' });
      }
    };

    reader.onerror = () => {
      setTeacherImportStatus({ error: 'Gagal membaca file.' });
    };

    reader.readAsBinaryString(file);
  };

  const handleUploadTeacherExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTeacherImportStatus(null);
      processTeacherExcelFile(file);
    }
  };

  const handleUpdateTeacherMaster = async (userId: string) => {
    const existing = users.find(u => u.id === userId);
    if (!existing) return;

    if (!editNama.trim() || !editNomorInduk.trim() || !editTelepon.trim()) {
      alert('Nama, NIP/NIK (nomor induk), dan telepon tidak boleh kosong!');
      return;
    }

    const updatedUser: PklUser = {
      ...existing,
      nama: editNama.trim(),
      nomor_induk: editNomorInduk.trim(),
      telepon: editTelepon.trim(),
      password: editPassword.trim() || 'password123',
    };

    const res = await dbSaveUser(updatedUser);
    if (res.success) {
      setEditingTeacherMasterId(null);
      fetchAdminData();
      onRefreshGlobalData();
    }
  };

  const handleUpdateUser = async (userId: string) => {
    const existing = users.find(u => u.id === userId);
    if (!existing) return;

    if (!editNama.trim() || !editNomorInduk.trim() || !editTelepon.trim()) {
      alert('Nama, nomor induk, dan telepon tidak boleh kosong!');
      return;
    }

    const updatedUser: PklUser = {
      ...existing,
      nama: editNama.trim(),
      role: editRole,
      nomor_induk: editNomorInduk.trim(),
      telepon: editTelepon.trim(),
      password: editPassword.trim() || 'password123',
      kelas: editRole === 'siswa' ? editKelas.trim() : undefined,
      jurusan: editRole === 'siswa' ? editJurusan.trim() : undefined,
      id_instansi: editIdInstansi || undefined,
      id_pembimbing: editIdPembimbing || undefined,
    };

    const res = await dbSaveUser(updatedUser);
    if (res.success) {
      setEditingUserId(null);
      setEditKelas('');
      setEditJurusan('');
      fetchAdminData();
      onRefreshGlobalData();
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus pengguna: ${userId}? Tindakan ini permanen.`)) {
      const res = await dbDeleteUser(userId);
      if (res.success) {
        setUsers(prev => prev.filter(u => u.id !== userId));
        onRefreshGlobalData();
      } else {
        alert(`Gagal menghapus pengguna dari database!\nDetail: ${res.error || 'Terjadi kesalahan sistem.'}`);
      }
    }
  };

  const handleUpdateStudentMaster = async (userId: string) => {
    const existing = users.find(u => u.id === userId);
    if (!existing) return;

    if (!editNama.trim() || !editNomorInduk.trim() || !editTelepon.trim()) {
      alert('Nama, NISN (nomor induk), dan telepon tidak boleh kosong!');
      return;
    }

    const updatedUser: PklUser = {
      ...existing,
      nama: editNama.trim(),
      nomor_induk: editNomorInduk.trim(),
      telepon: editTelepon.trim(),
      password: editPassword.trim() || 'password123',
      kelas: editKelas.trim(),
      jurusan: editJurusan.trim(),
    };

    const res = await dbSaveUser(updatedUser);
    if (res.success) {
      setEditingStudentMasterId(null);
      setEditKelas('');
      setEditJurusan('');
      fetchAdminData();
      onRefreshGlobalData();
    }
  };

  // ---------------- INSTANSI MANAGEMENT ----------------
  const handleAddInstansi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instNama.trim() || !instAlamat.trim()) {
      alert('Silakan lengkapi nama dan alamat instansi!');
      return;
    }

    const newInstansi: PklInstansi = {
      id: `inst-${Date.now()}`,
      nama_instansi: instNama.trim(),
      alamat: instAlamat.trim(),
      kuota: Number(instKuota),
      pembimbing_nama: instPembimbingNama.trim() || undefined,
      pembimbing_telp: instPembimbingTelp.trim() || undefined,
    };

    const res = await dbSaveInstansi(newInstansi);
    if (res.success) {
      setInstSuccess('Instansi/Perusahaan berhasil ditambahkan!');
      setInstNama('');
      setInstAlamat('');
      setInstKuota(1);
      setInstPembimbingNama('');
      setInstPembimbingTelp('');
      fetchAdminData();
      onRefreshGlobalData();
      setTimeout(() => setInstSuccess(''), 4000);
    }
  };

  const handleDeleteInstansi = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus instansi ini? Siswa yang terkait akan kehilangan instansi mereka.')) {
      const res = await dbDeleteInstansi(id);
      if (res.success) {
        setInstansiList(prev => prev.filter(i => i.id !== id));
        onRefreshGlobalData();
      }
    }
  };

  // ---------------- PLACEMENT APPROVALS ----------------
  const handleVerifyPlacement = async (place: PklPlacement, action: 'disetujui' | 'ditolak') => {
    const updatedPlacement: PklPlacement = {
      ...place,
      status: action,
      catatan: action === 'disetujui' ? 'Pengajuan disetujui oleh Koordinator PKL.' : 'Pengajuan ditolak. Kuota penuh atau instansi tidak relevan.'
    };

    const res = await dbSavePlacement(updatedPlacement);
    if (res.success) {
      // If approved, update student user record with company ID
      if (action === 'disetujui') {
        const studentUser = users.find(u => u.id === place.id_siswa);
        if (studentUser) {
          const updatedUser: PklUser = {
            ...studentUser,
            id_instansi: place.id_instansi
          };
          await dbSaveUser(updatedUser);
        }
      }

      setPlacements(prev => prev.map(p => p.id === place.id ? updatedPlacement : p));
      fetchAdminData();
      onRefreshGlobalData();
    }
  };

  // Update Guru Pembimbing Mapping (Plotting)
  const handleUpdatePembimbing = async (studentId: string) => {
    const studentUser = users.find(u => u.id === studentId);
    if (studentUser) {
      const updatedUser: PklUser = {
        ...studentUser,
        id_pembimbing: tempPembimbingId || undefined
      };
      const res = await dbSaveUser(updatedUser);
      if (res.success) {
        setEditingStudentId(null);
        setTempPembimbingId('');
        fetchAdminData();
        onRefreshGlobalData();
        alert('Guru pembimbing berhasil dipetakan!');
      }
    }
  };

  // ---------------- ANNOUNCEMENT MANAGEMENT ----------------
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annContent.trim()) {
      alert('Harap isi judul dan konten pengumuman!');
      return;
    }

    const newAnn: Announcement = {
      id: `ann-${Date.now()}`,
      judul: annTitle.trim(),
      konten: annContent.trim(),
      tanggal: new Date().toISOString().split('T')[0],
      author: admin.nama
    };

    const res = await dbSaveAnnouncement(newAnn);
    if (res.success) {
      setAnnSuccess('Pengumuman koordinator berhasil diposting!');
      setAnnTitle('');
      setAnnContent('');
      fetchAdminData();
      onRefreshGlobalData();
      setTimeout(() => setAnnSuccess(''), 4000);
    }
  };

  const handleDeleteAnn = async (id: string) => {
    if (confirm('Hapus pengumuman ini?')) {
      const res = await dbDeleteAnnouncement(id);
      if (res.success) {
        setAnnouncements(prev => prev.filter(a => a.id !== id));
        onRefreshGlobalData();
      }
    }
  };

  // ---------------- CLASS MASTER MANAGEMENT ----------------
  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clsNamaKelas.trim() || !clsJurusan.trim()) {
      alert('Harap isi nama kelas dan jurusan!');
      return;
    }

    const targetClass: PklClass = {
      id: editingClassId || `class-${Date.now()}`,
      nama_kelas: clsNamaKelas.trim(),
      jurusan: clsJurusan.trim()
    };

    const res = await dbSaveClass(targetClass);
    if (res.success) {
      setClassSuccess(editingClassId ? 'Kelas berhasil diperbarui!' : 'Kelas baru berhasil ditambahkan!');
      setClsNamaKelas('');
      setClsJurusan('');
      setEditingClassId(null);
      fetchAdminData();
      onRefreshGlobalData();
      setTimeout(() => setClassSuccess(''), 4000);
    } else {
      alert(`Gagal menyimpan kelas!\nDetail: ${res.error || 'Terjadi kesalahan'}`);
    }
  };

  const handleDeleteClass = async (id: string, name: string) => {
    const attachedStudents = users.filter(u => u.role === 'siswa' && u.kelas === name);
    if (attachedStudents.length > 0) {
      if (!confirm(`Ada ${attachedStudents.length} siswa yang saat ini terdaftar di kelas "${name}". Jika Anda menghapus kelas ini, informasi kelas mereka akan tetap ada di data siswa tetapi pilihan dropdown kelas ini tidak akan tersedia lagi. Lanjutkan menghapus?`)) {
        return;
      }
    } else {
      if (!confirm(`Apakah Anda yakin ingin menghapus kelas "${name}"?`)) {
        return;
      }
    }

    const res = await dbDeleteClass(id);
    if (res.success) {
      setClassesList(prev => prev.filter(c => c.id !== id));
      onRefreshGlobalData();
    } else {
      alert(`Gagal menghapus kelas!\nDetail: ${res.error || 'Terjadi kesalahan'}`);
    }
  };

  // ---------------- REPORT CALCULATIONS ----------------
  const compileReportData = () => {
    const studentsOnly = users.filter(u => u.role === 'siswa');
    return studentsOnly.map(student => {
      const myPlace = placements.find(p => p.id_siswa === student.id && p.status === 'disetujui');
      const company = myPlace ? instansiList.find(i => i.id === myPlace.id_instansi) : null;
      const teacherUser = student.id_pembimbing ? users.find(u => u.id === student.id_pembimbing) : null;
      
      const attendanceLogs = attendance.filter(a => a.id_siswa === student.id && a.status_verifikasi === 'disetujui');
      const presenceCount = attendanceLogs.filter(a => a.status === 'hadir').length;
      const sickIzinCount = attendanceLogs.filter(a => a.status === 'sakit' || a.status === 'izin').length;

      const evalData = evaluations.find(e => e.id_siswa === student.id);
      
      const scoreIndTeknis = evalData?.nilai_industri_teknis || 0;
      const scoreIndNonTeknis = evalData?.nilai_industri_nonteknis || 0;
      const scoreIndDisiplin = evalData?.nilai_industri_disiplin || 0;
      const scoreSchLaporan = evalData?.nilai_sekolah_laporan || 0;
      const scoreSchPresentasi = evalData?.nilai_sekolah_presentasi || 0;

      const averageScore = evalData ? (
        (scoreIndTeknis + scoreIndNonTeknis + scoreIndDisiplin + scoreSchLaporan + scoreSchPresentasi) / 5
      ).toFixed(1) : 'Belum Ada';

      return {
        id: student.id,
        nama: student.nama,
        nisn: student.nomor_induk,
        instansi: company?.nama_instansi || 'Belum Penempatan',
        pembimbing: teacherUser?.nama || 'Belum Diplot',
        kehadiran: `${presenceCount} Hari (Sakit/Izin: ${sickIzinCount})`,
        nilaiIndustri: `Teknis: ${scoreIndTeknis}, Soft: ${scoreIndNonTeknis}, Disiplin: ${scoreIndDisiplin}`,
        nilaiSekolah: `Laporan: ${scoreSchLaporan}, Ujian: ${scoreSchPresentasi}`,
        rataRata: averageScore
      };
    });
  };

  const handleDownloadReport = () => {
    const reportData = compileReportData();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Rekap_Nilai_PKL_${new Date().getFullYear()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const teachers = users.filter(u => u.role === 'guru');
  const filteredTeachers = teachers.filter(t => {
    const query = teacherSearch.toLowerCase();
    return t.nama.toLowerCase().includes(query) ||
           t.nomor_induk.toLowerCase().includes(query) ||
           (t.telepon && t.telepon.toLowerCase().includes(query));
  });
  const allStudents = users.filter(u => u.role === 'siswa');
  const filteredStudents = allStudents.filter(s => {
    const query = studentSearch.toLowerCase();
    return s.nama.toLowerCase().includes(query) ||
           s.nomor_induk.toLowerCase().includes(query) ||
           (s.kelas && s.kelas.toLowerCase().includes(query)) ||
           (s.jurusan && s.jurusan.toLowerCase().includes(query));
  });
  const studentsCount = allStudents.length;
  const companiesCount = instansiList.length;
  const pendingPlacementsCount = placements.filter(p => p.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm">Memuat Dashboard Koordinator PKL...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" id="admin-dashboard">
      
      {/* 1. ADMIN HEAD STATISTICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase">Total Siswa</span>
            <strong className="text-2xl text-slate-800">{studentsCount}</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Building2 className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase">Instansi PKL</span>
            <strong className="text-2xl text-slate-800">{companiesCount}</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl relative">
            <FileCheck className="w-5.5 h-5.5" />
            {pendingPlacementsCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            )}
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase">Pengajuan Pending</span>
            <strong className="text-2xl text-slate-800">{pendingPlacementsCount}</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="p-3.5 bg-slate-900 text-white rounded-xl">
            <Calendar className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold block uppercase">Pengumuman</span>
            <strong className="text-2xl text-slate-800">{announcements.length}</strong>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR NAVIGATION - VERTICAL STACKED (BERTINGKAT) */}
        <div className="lg:col-span-3">
          <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-4 space-y-1.5 lg:sticky lg:top-6">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block px-3 mb-2">Menu Kontrol Admin</span>
            
            <div className="flex flex-col gap-1">
              {isTabAllowed('admin_plotting') && (
                <button
                  onClick={() => setActiveTab('placements')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'placements' 
                      ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <ClipboardList className={`w-4 h-4 shrink-0 ${activeTab === 'placements' ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">Plotting & Pengajuan PKL</span>
                </button>
              )}
              {isTabAllowed('admin_siswa') && (
                <button
                  onClick={() => { setActiveTab('students'); setUserRole('siswa'); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'students' 
                      ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <GraduationCap className={`w-4 h-4 shrink-0 ${activeTab === 'students' ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">Master Data Siswa</span>
                </button>
              )}
              {isTabAllowed('admin_guru') && (
                <button
                  onClick={() => { setActiveTab('teachers'); setUserRole('guru'); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'teachers' 
                      ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <UserCheck className={`w-4 h-4 shrink-0 ${activeTab === 'teachers' ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">Master Guru Pembimbing</span>
                </button>
              )}
              {isTabAllowed('admin_pengguna') && (
                <button
                  onClick={() => { setActiveTab('users'); setUserRole('siswa'); }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'users' 
                      ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'users' ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">Kelola Pengguna</span>
                </button>
              )}
              {isTabAllowed('admin_instansi') && (
                <button
                  onClick={() => setActiveTab('companies')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'companies' 
                      ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'companies' ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">Kelola Instansi</span>
                </button>
              )}
              {isTabAllowed('admin_kelas') && (
                <button
                  onClick={() => setActiveTab('classes')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'classes' 
                      ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <BookOpen className={`w-4 h-4 shrink-0 ${activeTab === 'classes' ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">Master Kelas</span>
                </button>
              )}
              {isTabAllowed('admin_rekap') && (
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                    activeTab === 'reports' 
                      ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                  }`}
                >
                  <FileCheck className={`w-4 h-4 shrink-0 ${activeTab === 'reports' ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">Laporan Rekap Nilai</span>
                </button>
              )}
              
              <div className="h-px bg-slate-200 my-1.5" />
              
              <button
                onClick={() => setActiveTab('permissions')}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  activeTab === 'permissions' 
                    ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <Shield className={`w-4 h-4 shrink-0 ${activeTab === 'permissions' ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">Hak Akses Menu</span>
              </button>
            </div>
          </div>
        </div>

        {/* MAIN PANEL CONTENT & ACTION FORMS */}
        <div className="lg:col-span-9 space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* LEFT/MAIN MODULE COLUMN (based on activeTab) */}
            <div className="xl:col-span-8 space-y-8">
          
          {/* TAB 1: PLACEMENTS & PLOTTING */}
          {activeTab === 'placements' && (
            <div className="space-y-8" id="admin-placements">
              
              {/* PLACEMENT APPLICATIONS SECTION */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center justify-between">
                  <span>Persetujuan Pengajuan Tempat PKL</span>
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    {pendingPlacementsCount} perlu diproses
                  </span>
                </h3>

                {placements.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-6 text-center">Belum ada pengajuan tempat PKL dari siswa.</p>
                ) : (
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                    {placements.map((p) => {
                      const stud = users.find(u => u.id === p.id_siswa);
                      const inst = instansiList.find(i => i.id === p.id_instansi);
                      return (
                        <div key={p.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-sm text-slate-800">{stud?.nama || 'Siswa Tidak Ditemukan'}</strong>
                              <span className="text-[10px] text-slate-400">NISN: {stud?.nomor_induk}</span>
                            </div>
                            <p className="text-slate-600 mt-1">
                              Mengajukan ke: <strong>{inst?.nama_instansi}</strong> ({inst?.alamat})
                            </p>
                            <p className="text-slate-500 mt-0.5">
                              Durasi: {new Date(p.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - {new Date(p.tanggal_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              p.status === 'disetujui' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              p.status === 'ditolak' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                              'bg-amber-50 text-amber-700 border border-amber-100'
                            }`}>
                              {p.status}
                            </span>

                            {p.status === 'pending' && (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleVerifyPlacement(p, 'ditolak')}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100"
                                  title="Tolak Pengajuan"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleVerifyPlacement(p, 'disetujui')}
                                  className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100"
                                  title="Setujui Pengajuan"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* STUDENT GURU PLOTTING SECTION */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <h3 className="text-base font-bold text-slate-800 mb-4">Pemetaan (Plotting) Guru Pembimbing Siswa</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                        <th className="pb-3 pr-4">Nama Siswa</th>
                        <th className="pb-3 px-4">Instansi PKL</th>
                        <th className="pb-3 px-4">Guru Pembimbing</th>
                        <th className="pb-3 pl-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-600">
                      {users.filter(u => u.role === 'siswa').map((stud) => {
                        const isEditing = editingStudentId === stud.id;
                        const company = instansiList.find(i => i.id === stud.id_instansi);
                        const currentTeacher = teachers.find(t => t.id === stud.id_pembimbing);
                        
                        return (
                          <tr key={stud.id} className="hover:bg-slate-50/50">
                            <td className="py-3 pr-4">
                              <span className="font-semibold text-slate-800 block">{stud.nama}</span>
                              <span className="text-[10px] text-slate-400">NISN: {stud.nomor_induk}</span>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-700">
                              {company?.nama_instansi || 'Belum Penempatan'}
                            </td>
                            <td className="py-3 px-4">
                              {isEditing ? (
                                <select
                                  value={tempPembimbingId}
                                  onChange={(e) => setTempPembimbingId(e.target.value)}
                                  className="px-2 py-1 rounded border border-slate-200 focus:outline-none bg-white text-slate-800"
                                >
                                  <option value="">-- Pilih Guru --</option>
                                  {teachers.map(t => (
                                    <option key={t.id} value={t.id}>{t.nama}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className={`font-medium ${currentTeacher ? 'text-indigo-600' : 'text-slate-400 italic'}`}>
                                  {currentTeacher ? currentTeacher.nama : 'Belum diplot'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 pl-4 text-right">
                              {isEditing ? (
                                <div className="flex gap-1 justify-end">
                                  <button
                                    onClick={() => setEditingStudentId(null)}
                                    className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-semibold"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    onClick={() => handleUpdatePembimbing(stud.id)}
                                    className="px-2 py-1 rounded bg-indigo-600 text-white font-semibold flex items-center gap-0.5"
                                  >
                                    <Check className="w-3 h-3" /> Simpan
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingStudentId(stud.id);
                                    setTempPembimbingId(stud.id_pembimbing || '');
                                  }}
                                  className="text-xs text-indigo-600 hover:underline font-semibold"
                                >
                                  Plot Guru
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB: MASTER DATA SISWA */}
          {activeTab === 'students' && (
            <div className="space-y-6" id="admin-students-master">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Master Data Siswa</h3>
                    <p className="text-xs text-slate-400">Daftar lengkap seluruh siswa peserta PKL beserta Kelas dan Kompetensi Keahlian (Jurusan).</p>
                  </div>
                  {/* Search and Filters */}
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="text"
                      placeholder="Cari nama, NISN, kelas..."
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 w-48 sm:w-64 shadow-sm"
                      onChange={(e) => setStudentSearch(e.target.value)}
                      value={studentSearch}
                    />
                  </div>
                </div>

                {/* Excel Import & Template Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Download Card */}
                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between space-y-3 shadow-xs">
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        1. Unduh Template Excel
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Gunakan file template Excel resmi untuk mengisi data seluruh siswa magang secara massal tanpa Email dan Nomor HP. Siswa akan login menggunakan <b>NISN</b> sebagai username. Template ini telah disesuaikan dengan Kelas (<b>XII TKR, XII DKV</b>) dan Jurusan (<b>Teknik Kendaraan Ringan, Desain Komunikasi Visual</b>). Pastikan tidak mengubah susunan kolom.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="w-full sm:w-auto self-start px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/10 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh Template (.xlsx)
                    </button>
                  </div>

                  {/* Upload Card */}
                  <div className="flex flex-col space-y-2">
                    <div 
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          setImportStatus(null);
                          processExcelFile(file);
                        }
                      }}
                      className={`relative p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer min-h-[110px] ${
                        isDragOver 
                          ? 'border-indigo-500 bg-indigo-50/30' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleUploadExcel}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title=""
                      />
                      <UploadCloud className={`w-7 h-7 mb-1.5 transition-transform ${isDragOver ? 'scale-110 text-indigo-600' : 'text-slate-400'}`} />
                      <p className="text-xs font-bold text-slate-700">2. Unggah File Excel</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Tarik & letakkan file .xlsx di sini atau klik untuk mencari</p>
                    </div>

                    {importStatus && (
                      <div className={`p-2.5 rounded-lg text-[11px] font-semibold flex items-start gap-1.5 border ${
                        importStatus.success 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                          : 'bg-rose-50 border-rose-100 text-rose-800'
                      }`}>
                        {importStatus.success ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <span>{importStatus.success || importStatus.error}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick stats cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Total Siswa</span>
                    <strong className="block text-lg text-slate-800 mt-1">{allStudents.length}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Sudah Plot Guru</span>
                    <strong className="block text-lg text-indigo-600 mt-1">{allStudents.filter(s => s.id_pembimbing).length}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Belum Plot Guru</span>
                    <strong className="block text-lg text-amber-600 mt-1">{allStudents.filter(s => !s.id_pembimbing).length}</strong>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Belum PKL</span>
                    <strong className="block text-lg text-slate-500 mt-1">{allStudents.filter(s => !s.id_instansi).length}</strong>
                  </div>
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                    <p className="text-xs text-slate-400 italic">Siswa tidak ditemukan atau belum ada data siswa.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider bg-slate-50/50">
                          <th className="py-3 px-4 rounded-l-lg w-12 text-center">No</th>
                          <th className="py-3 px-4 w-32">NISN</th>
                          <th className="py-3 px-4">Nama Lengkap</th>
                          <th className="py-3 px-4 w-32">Kelas</th>
                          <th className="py-3 px-4">Jurusan</th>
                          <th className="py-3 px-4 rounded-r-lg text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {filteredStudents.map((stud, idx) => {
                          const isEditing = editingStudentMasterId === stud.id;
                          return (
                            <tr key={stud.id} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-indigo-50/40' : ''}`}>
                              {isEditing ? (
                                <>
                                  <td className="py-3 px-4 text-center font-medium text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3 px-4">
                                    <input
                                      type="text"
                                      value={editNomorInduk}
                                      onChange={(e) => setEditNomorInduk(e.target.value)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-medium font-mono"
                                      placeholder="NISN"
                                    />
                                  </td>
                                  <td className="py-3 px-4 space-y-1">
                                    <input
                                      type="text"
                                      value={editNama}
                                      onChange={(e) => setEditNama(e.target.value)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold"
                                      placeholder="Nama Lengkap"
                                    />
                                    <div className="flex gap-1">
                                      <input
                                        type="text"
                                        value={editTelepon}
                                        onChange={(e) => setEditTelepon(e.target.value)}
                                        className="w-1/2 px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                        placeholder="Telepon"
                                      />
                                      <input
                                        type="text"
                                        value={editPassword}
                                        onChange={(e) => setEditPassword(e.target.value)}
                                        className="w-1/2 px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                                        placeholder="Sandi login"
                                      />
                                    </div>
                                    <span className="text-[9px] text-slate-400 block px-1">{stud.email}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <select
                                      value={editKelas}
                                      onChange={(e) => setEditKelas(e.target.value)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-medium"
                                    >
                                      <option value="">-- Pilih Kelas --</option>
                                      {KELAS_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-3 px-4">
                                    <select
                                      value={editJurusan}
                                      onChange={(e) => setEditJurusan(e.target.value)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                    >
                                      <option value="">-- Pilih Jurusan --</option>
                                      {JURUSAN_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex gap-1 justify-end">
                                      <button
                                        onClick={() => setEditingStudentMasterId(null)}
                                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold"
                                      >
                                        Batal
                                      </button>
                                      <button
                                        onClick={() => handleUpdateStudentMaster(stud.id)}
                                        className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-0.5"
                                      >
                                        <Check className="w-3.5 h-3.5" /> Simpan
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                                    {stud.nomor_induk}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className="font-bold text-slate-800 block">{stud.nama}</span>
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center mt-0.5">
                                      <span className="text-[10px] text-slate-400">{stud.email}</span>
                                      {stud.telepon && (
                                        <span className="text-[10px] text-slate-400">• Telp: {stud.telepon}</span>
                                      )}
                                      <span className="text-[10px] text-slate-400">• Pass: {stud.password || 'password123'}</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold text-indigo-700">
                                    {stud.kelas || <span className="text-slate-300 italic font-normal">Belum diisi</span>}
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                                    {stud.jurusan || <span className="text-slate-300 italic">Belum diisi</span>}
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => {
                                          setEditingStudentMasterId(stud.id);
                                          setEditNama(stud.nama);
                                          setEditNomorInduk(stud.nomor_induk);
                                          setEditKelas(stud.kelas || '');
                                          setEditJurusan(stud.jurusan || '');
                                          setEditTelepon(stud.telepon || '');
                                          setEditPassword(stud.password || 'password123');
                                        }}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline px-2 py-1 hover:bg-indigo-50/50 rounded-md transition-all"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(stud.id)}
                                        className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent transition-all inline-flex"
                                        title="Hapus Siswa"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: GURU PEMBIMBING MANAGEMENT */}
          {activeTab === 'teachers' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="admin-teachers-mgmt">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight">Master Data Guru Pembimbing</h3>
                  <p className="text-xs text-slate-400">Kelola guru pembimbing PKL, download template excel, dan unggah data guru secara massal.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDownloadTeacherTemplate}
                    className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl border border-slate-200/60 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    Unduh Template Excel
                  </button>
                  <label className="cursor-pointer px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm">
                    <UploadCloud className="w-4 h-4" />
                    Unggah Excel
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleUploadTeacherExcel}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* SEARCH & FILTER */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="Cari guru berdasarkan Nama, NIP/NIK, atau No Telepon..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 font-medium transition-all"
                />
                {teacherSearch && (
                  <button
                    onClick={() => setTeacherSearch('')}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-xs transition-all"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* IMPORT STATUS MESSAGE */}
              {teacherImportStatus && (
                <div className={`p-4 rounded-xl text-xs font-semibold mb-6 flex items-start gap-2.5 ${
                  teacherImportStatus.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                }`}>
                  <div className="flex-1">
                    {teacherImportStatus.success || teacherImportStatus.error}
                  </div>
                  <button onClick={() => setTeacherImportStatus(null)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* DRAG AND DROP AREA */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOverTeacher(true); }}
                onDragLeave={() => setIsDragOverTeacher(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragOverTeacher(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    setTeacherImportStatus(null);
                    await processTeacherExcelFile(file);
                  }
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all mb-6 ${
                  isDragOverTeacher 
                    ? 'border-indigo-500 bg-indigo-50/30' 
                    : 'border-slate-200 bg-slate-50/20 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-indigo-500" />
                  <p className="text-xs font-semibold text-slate-700">Tarik & Lepas File Excel Guru di sini</p>
                  <p className="text-[10px] text-slate-400">Mendukung format .xlsx atau .xls dengan struktur NIP/NIK, Nama Lengkap, Telepon</p>
                </div>
              </div>

              {/* STATISTICS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Total Guru Pembimbing</span>
                  <span className="text-base font-bold text-slate-800">{teachers.length} Guru</span>
                </div>
                <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Guru Terfilter</span>
                  <span className="text-base font-bold text-indigo-600">{filteredTeachers.length} Guru</span>
                </div>
              </div>

              {/* TEACHERS LIST TABLE */}
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                {filteredTeachers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Tidak ada data guru pembimbing yang ditemukan.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/30">
                          <th className="py-3 px-4 text-center w-12">No</th>
                          <th className="py-3 px-4 w-40">NIP / NIK</th>
                          <th className="py-3 px-4">Nama & Informasi Akun</th>
                          <th className="py-3 px-4 w-40 text-center">Bimbingan Siswa</th>
                          <th className="py-3 px-4 text-right w-36">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600">
                        {filteredTeachers.map((teacher, idx) => {
                          const isEditing = editingTeacherMasterId === teacher.id;
                          const bimbinganCount = allStudents.filter(s => s.id_pembimbing === teacher.id).length;
                          return (
                            <tr key={teacher.id} className={`hover:bg-slate-50/30 transition-colors ${isEditing ? 'bg-indigo-50/30' : ''}`}>
                              {isEditing ? (
                                <>
                                  <td className="py-3 px-4 text-center font-medium text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3 px-4">
                                    <input
                                      type="text"
                                      value={editNomorInduk}
                                      onChange={(e) => setEditNomorInduk(e.target.value)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-medium font-mono"
                                      placeholder="NIP/NIK"
                                    />
                                  </td>
                                  <td className="py-3 px-4 space-y-1">
                                    <input
                                      type="text"
                                      value={editNama}
                                      onChange={(e) => setEditNama(e.target.value)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold"
                                      placeholder="Nama Lengkap"
                                    />
                                    <div className="flex gap-1">
                                      <input
                                        type="text"
                                        value={editTelepon}
                                        onChange={(e) => setEditTelepon(e.target.value)}
                                        className="w-1/2 px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                        placeholder="Telepon"
                                      />
                                      <input
                                        type="text"
                                        value={editPassword}
                                        onChange={(e) => setEditPassword(e.target.value)}
                                        className="w-1/2 px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                                        placeholder="Sandi login"
                                      />
                                    </div>
                                    <span className="text-[9px] text-slate-400 block px-1">{teacher.email}</span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">
                                      {bimbinganCount} Siswa
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex gap-1 justify-end">
                                      <button
                                        onClick={() => setEditingTeacherMasterId(null)}
                                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold"
                                      >
                                        Batal
                                      </button>
                                      <button
                                        onClick={() => handleUpdateTeacherMaster(teacher.id)}
                                        className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-0.5"
                                      >
                                        <Check className="w-3.5 h-3.5" /> Simpan
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3.5 px-4 text-center font-medium text-slate-400">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                                    {teacher.nomor_induk}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span className="font-bold text-slate-800 block">{teacher.nama}</span>
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 items-center mt-0.5">
                                      <span className="text-[10px] text-slate-400">{teacher.email}</span>
                                      {teacher.telepon && (
                                        <span className="text-[10px] text-slate-400">• Telp: {teacher.telepon}</span>
                                      )}
                                      <span className="text-[10px] text-slate-400">• Pass: {teacher.password || 'password123'}</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-center font-semibold text-slate-800">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      bimbinganCount > 0 
                                        ? 'bg-indigo-50 text-indigo-600' 
                                        : 'bg-amber-50 text-amber-600'
                                    }`}>
                                      {bimbinganCount} Siswa
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => {
                                          setEditingTeacherMasterId(teacher.id);
                                          setEditNama(teacher.nama);
                                          setEditNomorInduk(teacher.nomor_induk);
                                          setEditTelepon(teacher.telepon || '');
                                          setEditPassword(teacher.password || 'password123');
                                        }}
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline px-2 py-1 hover:bg-indigo-50/50 rounded-md transition-all"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => handleDeleteUser(teacher.id)}
                                        className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent transition-all inline-flex"
                                        title="Hapus Guru"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="admin-users-mgmt">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Manajemen Master Pengguna ({users.length})</h3>
                  <p className="text-xs text-slate-400">Atur semua akun siswa, guru, pembimbing mitra industri, dan koordinator sekolah.</p>
                </div>
              </div>
 
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Nama & Email</th>
                      <th className="pb-3 px-4">Role / Peran</th>
                      <th className="pb-3 px-4">Nomor Induk</th>
                      <th className="pb-3 px-4">No Telepon</th>
                      <th className="pb-3 px-4">Sandi Login</th>
                      <th className="pb-3 pl-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {users.map((user) => {
                      const isEditing = editingUserId === user.id;
                      return (
                        <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-indigo-50/40' : ''}`}>
                          {isEditing ? (
                            <>
                              {/* EDITING STATE */}
                              <td className="py-3 pr-4 space-y-1.5">
                                <input
                                  type="text"
                                  value={editNama}
                                  onChange={(e) => setEditNama(e.target.value)}
                                  className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-medium"
                                  placeholder="Nama Lengkap"
                                />
                                {editRole === 'siswa' && (
                                  <div className="flex gap-1.5">
                                    <select
                                      value={editKelas}
                                      onChange={(e) => setEditKelas(e.target.value)}
                                      className="w-1/2 px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-medium"
                                    >
                                      <option value="">Kelas</option>
                                      {KELAS_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                    <select
                                      value={editJurusan}
                                      onChange={(e) => setEditJurusan(e.target.value)}
                                      className="w-1/2 px-2 py-0.5 rounded border border-slate-200 bg-white text-[10px] text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                    >
                                      <option value="">Jurusan</option>
                                      {JURUSAN_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                                <span className="text-[10px] text-slate-400 block px-1">{user.email} (Email)</span>
                              </td>
                              <td className="py-3 px-4">
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                                  className="px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                >
                                  <option value="siswa">Siswa</option>
                                  <option value="guru">Guru</option>
                                  <option value="industri">Industri</option>
                                  <option value="admin">Admin</option>
                                </select>
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editNomorInduk}
                                  onChange={(e) => setEditNomorInduk(e.target.value)}
                                  className="w-28 px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                  placeholder="NISN/NIP"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editTelepon}
                                  onChange={(e) => setEditTelepon(e.target.value)}
                                  className="w-28 px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                  placeholder="Telepon"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input
                                  type="text"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  className="w-28 px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                                  placeholder="Sandi login"
                                />
                              </td>
                              <td className="py-3 pl-4 text-right">
                                <div className="flex gap-1 justify-end">
                                  <button
                                    onClick={() => setEditingUserId(null)}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold"
                                  >
                                    Batal
                                  </button>
                                  <button
                                    onClick={() => handleUpdateUser(user.id)}
                                    className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-0.5"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Simpan
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {/* DISPLAY STATE */}
                              <td className="py-3 pr-4 text-xs">
                                <span className="font-semibold text-slate-800 block">{user.nama}</span>
                                {user.role === 'siswa' && (user.kelas || user.jurusan) && (
                                  <span className="text-[10px] text-indigo-600 font-medium block">
                                    {user.kelas || '-'} • {user.jurusan || '-'}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-400">{user.email}</span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                  user.role === 'admin' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                  user.role === 'guru' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                  user.role === 'industri' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                  'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-medium text-slate-700">
                                {user.nomor_induk}
                              </td>
                              <td className="py-3 px-4">
                                {user.telepon}
                              </td>
                              <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                                {user.password || <span className="text-slate-300 italic">password123</span>}
                              </td>
                              <td className="py-3 pl-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setEditingUserId(user.id);
                                      setEditNama(user.nama);
                                      setEditRole(user.role);
                                      setEditNomorInduk(user.nomor_induk);
                                      setEditTelepon(user.telepon);
                                      setEditPassword(user.password || 'password123');
                                      setEditKelas(user.kelas || '');
                                      setEditJurusan(user.jurusan || '');
                                      setEditIdInstansi(user.id_instansi || '');
                                      setEditIdPembimbing(user.id_pembimbing || '');
                                    }}
                                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline px-2 py-1 hover:bg-indigo-50/50 rounded-md transition-all"
                                  >
                                    Edit
                                  </button>
                                  {user.email !== admin.email && (
                                    <button
                                      onClick={() => handleDeleteUser(user.id)}
                                      className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent transition-all inline-flex"
                                      title="Hapus Pengguna"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COMPANIES MANAGEMENT */}
          {activeTab === 'companies' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="admin-companies-mgmt">
              <h3 className="text-base font-bold text-slate-800 mb-4">Daftar Mitra Instansi & Perusahaan ({instansiList.length})</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {instansiList.map((inst) => {
                  const plotSiswaCount = users.filter(u => u.role === 'siswa' && u.id_instansi === inst.id).length;
                  return (
                    <div key={inst.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all text-xs flex justify-between gap-4">
                      <div className="space-y-1.5">
                        <strong className="text-sm text-slate-800 block">{inst.nama_instansi}</strong>
                        <p className="text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> {inst.alamat}
                        </p>
                        <p className="text-slate-600">
                          Kuota Siswa: <strong>{inst.kuota}</strong> | Sedang Magang: <strong className="text-indigo-600">{plotSiswaCount} siswa</strong>
                        </p>
                        {inst.pembimbing_nama && (
                          <div className="pt-1.5 border-t border-slate-100 text-slate-500">
                            Pembimbing Industri: <strong>{inst.pembimbing_nama}</strong> ({inst.pembimbing_telp || 'no telepon'})
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteInstansi(inst.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-all border border-transparent hover:border-rose-100 shrink-0 self-start"
                        title="Hapus Instansi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: REPORTS REKAP NILAI */}
          {activeTab === 'reports' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4" id="admin-reports">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-slate-800">Laporan Rekap Nilai Siswa PKL</h3>
                <button
                  onClick={handleDownloadReport}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/10"
                >
                  <Download className="w-4 h-4" /> Ekspor Hasil PKL (.JSON)
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Nama Siswa</th>
                      <th className="pb-3 px-4">Instansi PKL</th>
                      <th className="pb-3 px-4">Guru Pembimbing</th>
                      <th className="pb-3 px-4">Total Kehadiran</th>
                      <th className="pb-3 px-4">Rincian Nilai Akhir</th>
                      <th className="pb-3 pl-4 text-right">Rerata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600">
                    {compileReportData().map((rep) => (
                      <tr key={rep.id} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4">
                          <span className="font-semibold text-slate-800 block">{rep.nama}</span>
                          <span className="text-[10px] text-slate-400">NISN: {rep.nisn}</span>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-700">
                          {rep.instansi}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {rep.pembimbing}
                        </td>
                        <td className="py-3 px-4">
                          {rep.kehadiran}
                        </td>
                        <td className="py-3 px-4 font-medium text-[11px] leading-normal space-y-0.5">
                          <p className="text-emerald-700 font-semibold">Mitra: {rep.nilaiIndustri}</p>
                          <p className="text-indigo-700 font-semibold">Sekolah: {rep.nilaiSekolah}</p>
                        </td>
                        <td className="py-3 pl-4 text-right text-sm font-bold text-slate-800">
                          <span className={rep.rataRata !== 'Belum Ada' ? 'text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded' : 'text-slate-400 italic font-normal'}>
                            {rep.rataRata}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: CLASSES MANAGEMENT (MAIN PANE) */}
          {activeTab === 'classes' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6" id="admin-classes-mgmt">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Daftar Master Kelas ({classesList.length})</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Master data kelas digunakan untuk memvalidasi pilihan kelas pada saat pendaftaran atau pengeditan data siswa.</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="pb-3 pr-4">Nama Kelas</th>
                      <th className="pb-3 px-4">Jurusan / Kompetensi Keahlian</th>
                      <th className="pb-3 px-4 text-center">Jumlah Siswa</th>
                      <th className="pb-3 pl-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-600">
                    {classesList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                          Belum ada data kelas. Tambahkan kelas melalui panel di sebelah kanan.
                        </td>
                      </tr>
                    ) : (
                      classesList.map((cls) => {
                        const studentCount = users.filter(u => u.role === 'siswa' && u.kelas === cls.nama_kelas).length;
                        return (
                          <tr key={cls.id} className="hover:bg-slate-50/50">
                            <td className="py-3 pr-4 font-bold text-slate-800 text-sm">
                              {cls.nama_kelas}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {cls.jurusan}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-indigo-600">
                              {studentCount} Siswa
                            </td>
                            <td className="py-3 pl-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingClassId(cls.id);
                                    setClsNamaKelas(cls.nama_kelas);
                                    setClsJurusan(cls.jurusan);
                                  }}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold hover:underline px-2 py-1 hover:bg-indigo-50/50 rounded-md transition-all"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteClass(cls.id, cls.nama_kelas)}
                                  className="text-rose-600 hover:text-rose-800 p-1.5 rounded-lg hover:bg-rose-50 border border-transparent transition-all inline-flex"
                                  title="Hapus Kelas"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: MENU PERMISSIONS (MAIN PANE) */}
          {activeTab === 'permissions' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 animate-fade-in" id="admin-permissions-mgmt">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-600" /> Master Hak Akses Menu & Modul
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Konfigurasikan peran pengguna yang diizinkan untuk mengakses menu-menu di bawah ini.</p>
                </div>
              </div>

              {permissionsSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-xs font-semibold mb-4 flex items-center gap-1.5 animate-bounce">
                  <Check className="w-4 h-4 text-emerald-600" /> {permissionsSuccess}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-inner">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Nama Menu / Modul & Deskripsi</th>
                      <th className="py-3 px-4 text-center w-16">Siswa</th>
                      <th className="py-3 px-4 text-center w-16">Guru</th>
                      <th className="py-3 px-4 text-center w-16">Industri</th>
                      <th className="py-3 px-4 text-center w-16">Admin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {(['Utama', 'Siswa', 'Guru', 'Industri', 'Admin'] as const).map((cat) => {
                      const items = menuAccessList.filter(m => m.kategori === cat);
                      if (items.length === 0) return null;
                      return (
                        <React.Fragment key={cat}>
                          <tr className="bg-slate-50/65">
                            <td colSpan={5} className="py-2.5 px-4 font-extrabold text-indigo-900 text-[10px] uppercase tracking-wider bg-slate-50/50 border-y border-slate-100">
                              Kategori: Modul {cat}
                            </td>
                          </tr>
                          {items.map((menu) => (
                            <tr key={menu.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="py-4 px-4 pr-6">
                                <span className="font-bold text-slate-800 text-sm block">{menu.nama_menu}</span>
                                <span className="text-slate-400 text-[11px] block mt-1 leading-relaxed max-w-lg">{menu.deskripsi}</span>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <input
                                  type="checkbox"
                                  id={`perm-siswa-${menu.id}`}
                                  checked={menu.allowed_roles.includes('siswa')}
                                  onChange={() => handleTogglePermission(menu.id, 'siswa')}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer transition-all"
                                />
                              </td>
                              <td className="py-4 px-4 text-center">
                                <input
                                  type="checkbox"
                                  id={`perm-guru-${menu.id}`}
                                  checked={menu.allowed_roles.includes('guru')}
                                  onChange={() => handleTogglePermission(menu.id, 'guru')}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer transition-all"
                                />
                              </td>
                              <td className="py-4 px-4 text-center">
                                <input
                                  type="checkbox"
                                  id={`perm-industri-${menu.id}`}
                                  checked={menu.allowed_roles.includes('industri')}
                                  onChange={() => handleTogglePermission(menu.id, 'industri')}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer transition-all"
                                />
                              </td>
                              <td className="py-4 px-4 text-center">
                                <input
                                  type="checkbox"
                                  id={`perm-admin-${menu.id}`}
                                  checked={menu.allowed_roles.includes('admin')}
                                  onChange={() => handleTogglePermission(menu.id, 'admin')}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer transition-all"
                                />
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

            </div>

            {/* RIGHT COLUMN: ACTION FORMS (USER ADD, INSTANSI ADD, ANNOUNCEMENTS) */}
            <div className="xl:col-span-4 space-y-8">
          
          {/* PERMISSIONS INFO PANEL */}
          {activeTab === 'permissions' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4" id="permissions-sidebar">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                <ShieldAlert className="w-4.5 h-4.5 text-indigo-600 animate-pulse" /> Informasi Hak Akses
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pengaturan hak akses menentukan menu mana saja yang dapat dilihat dan digunakan oleh setiap peran di sistem SIM PKL.
              </p>
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-800 leading-relaxed space-y-2">
                <p className="font-bold">Keamanan Master:</p>
                <p>
                  Untuk modul sensitif seperti <strong className="text-slate-900">Setup Supabase</strong>, sistem membatasi akses secara absolut hanya untuk <strong className="text-slate-900">Super Admin</strong> (seperti <span className="font-semibold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-indigo-200">admin@simpkl.com</span> atau <span className="font-semibold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-indigo-200">kangdanu93@gmail.com</span>) untuk mencegah penyalahgunaan database cloud.
                </p>
              </div>
              <div className="text-[11px] text-slate-400 italic font-medium leading-relaxed">
                * Perubahan akan langsung disimpan secara real-time dan diterapkan ke semua sesi pengguna aktif.
              </div>
            </div>
          )}
          
          {/* USER ADD FORM */}
          {(activeTab === 'users' || activeTab === 'students' || activeTab === 'teachers') && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-indigo-600" /> {activeTab === 'students' ? 'Tambah Siswa Baru' : activeTab === 'teachers' ? 'Tambah Guru Pembimbing Baru' : 'Tambah Pengguna Baru'}
              </h4>

              <form onSubmit={handleAddUser} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Email / ID Unik</label>
                  <input
                    type="email"
                    required
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="nama@simpkl.com"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={userNama}
                    onChange={(e) => setUserNama(e.target.value)}
                    placeholder="Ahmad Fauzi..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                {activeTab === 'users' ? (
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Pilih Peran / Role</label>
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                    >
                      <option value="siswa">Siswa (Magang)</option>
                      <option value="guru">Guru Pembimbing</option>
                      <option value="industri">Pembimbing Industri</option>
                      <option value="admin">Koordinator PKL / Admin</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Peran / Role</label>
                    <input
                      type="text"
                      readOnly
                      value={activeTab === 'teachers' ? 'Guru Pembimbing' : 'Siswa (Magang)'}
                      className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 text-slate-500 font-semibold focus:outline-none cursor-not-allowed"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Nomor Induk (NISN/NIP)</label>
                  <input
                    type="text"
                    required
                    value={userNomorInduk}
                    onChange={(e) => setUserNomorInduk(e.target.value)}
                    placeholder={activeTab === 'teachers' ? 'NIP/NIK' : 'NISN006234 or NIP19820...'}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                {userRole === 'siswa' && (
                  <>
                    <div>
                      <label className="block font-semibold text-slate-500 mb-1">Kelas</label>
                      <select
                        required
                        value={userKelas}
                        onChange={(e) => setUserKelas(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {KELAS_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-500 mb-1">Jurusan</label>
                      <select
                        required
                        value={userJurusan}
                        onChange={(e) => setUserJurusan(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                      >
                        <option value="">-- Pilih Jurusan --</option>
                        {JURUSAN_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Nomor Telepon</label>
                  <input
                    type="tel"
                    required
                    value={userTelepon}
                    onChange={(e) => setUserTelepon(e.target.value)}
                    placeholder="0812XXXXXXXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Sandi / Password Login</label>
                  <input
                    type="text"
                    required
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    placeholder="password123"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800 font-mono"
                  />
                </div>

                {userRole === 'industri' && (
                  <div>
                    <label className="block font-semibold text-slate-500 mb-1">Kaitkan ke Instansi</label>
                    <select
                      value={userIdInstansi}
                      onChange={(e) => setUserIdInstansi(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                    >
                      <option value="">-- Pilih Instansi --</option>
                      {instansiList.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.nama_instansi}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all"
                >
                  {activeTab === 'students' ? 'Tambahkan Siswa' : activeTab === 'teachers' ? 'Tambahkan Guru Pembimbing' : 'Tambahkan Pengguna'}
                </button>

                {userSuccess && <p className="text-[10px] text-emerald-600 font-semibold">{userSuccess}</p>}
              </form>
            </div>
          )}

          {/* INSTANSI ADD FORM */}
          {activeTab === 'companies' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-600" /> Tambah Mitra Instansi
              </h4>

              <form onSubmit={handleAddInstansi} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Nama Instansi / Perusahaan</label>
                  <input
                    type="text"
                    required
                    value={instNama}
                    onChange={(e) => setInstNama(e.target.value)}
                    placeholder="PT. Solusi Digital..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Alamat Lengkap</label>
                  <textarea
                    rows={2}
                    required
                    value={instAlamat}
                    onChange={(e) => setInstAlamat(e.target.value)}
                    placeholder="Jl. Sudirman Kav 10..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Kuota Siswa (Sebutkan Batas)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={instKuota}
                    onChange={(e) => setInstKuota(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Nama Hub/Pembimbing Lapangan (Opsional)</label>
                  <input
                    type="text"
                    value={instPembimbingNama}
                    onChange={(e) => setInstPembimbingNama(e.target.value)}
                    placeholder="Joko Prasetyo..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">No HP Pembimbing Lapangan (Opsional)</label>
                  <input
                    type="tel"
                    value={instPembimbingTelp}
                    onChange={(e) => setInstPembimbingTelp(e.target.value)}
                    placeholder="0812XXXXXXXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all"
                >
                  Tambahkan Instansi
                </button>

                {instSuccess && <p className="text-[10px] text-emerald-600 font-semibold">{instSuccess}</p>}
              </form>
            </div>
          )}

          {/* TAB: CLASSES MANAGEMENT SIDEBAR */}
          {activeTab === 'classes' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" /> {editingClassId ? 'Edit Master Kelas' : 'Tambah Master Kelas'}
              </h4>

              <form onSubmit={handleSaveClass} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Nama Kelas</label>
                  <input
                    type="text"
                    required
                    value={clsNamaKelas}
                    onChange={(e) => setClsNamaKelas(e.target.value)}
                    placeholder="Contoh: XII RPL 1, XII TKJ 1..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Jurusan / Kompetensi Keahlian</label>
                  <input
                    type="text"
                    required
                    value={clsJurusan}
                    onChange={(e) => setClsJurusan(e.target.value)}
                    placeholder="Contoh: Rekayasa Perangkat Lunak..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all"
                  >
                    {editingClassId ? 'Simpan Perubahan' : 'Tambahkan Kelas'}
                  </button>
                  {editingClassId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingClassId(null);
                        setClsNamaKelas('');
                        setClsJurusan('');
                      }}
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition-all"
                    >
                      Batal
                    </button>
                  )}
                </div>

                {classSuccess && <p className="text-[10px] text-emerald-600 font-semibold">{classSuccess}</p>}
              </form>
            </div>
          )}

          {/* GENERAL KOORDINATOR ANNOUNCEMENT FORM */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <ClipboardList className="w-4.5 h-4.5 text-indigo-600" /> Tulis Pengumuman Koordinator
            </h4>

            <form onSubmit={handleAddAnnouncement} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-500 mb-1">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Batas Akhir Penyerahan Jurnal..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-500 mb-1">Konten Pengumuman</label>
                <textarea
                  rows={4}
                  required
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Tulis informasi pengumuman di sini..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none bg-white text-slate-800"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition-all"
              >
                Posting Pengumuman
              </button>

              {annSuccess && <p className="text-[10px] text-emerald-600 font-semibold">{annSuccess}</p>}
            </form>
          </div>

          {/* ACTIVE ANNOUNCEMENTS FROM KOORDINATOR */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histori Pengumuman Anda</h4>
            
            {announcements.filter(a => a.author.includes('Koordinator')).length === 0 ? (
              <p className="text-xs text-slate-400 italic">Belum ada pengumuman.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {announcements.filter(a => a.author.includes('Koordinator')).map(ann => (
                  <div key={ann.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex justify-between gap-3">
                    <div>
                      <strong className="text-slate-800 font-bold">{ann.judul}</strong>
                      <p className="text-slate-500 mt-1 whitespace-pre-wrap">{ann.konten}</p>
                      <span className="text-[9px] text-slate-400 block mt-1.5">{ann.tanggal}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteAnn(ann.id)}
                      className="text-rose-500 p-1 hover:bg-rose-50 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
