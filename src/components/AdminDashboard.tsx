import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, FileCheck, Calendar, Star, RefreshCw, Plus, Trash2, Edit,
  UserPlus, Check, X, ClipboardList, ShieldAlert, Download, Phone, MapPin,
  FileSpreadsheet, UploadCloud, Shield, BookOpen, GraduationCap, UserCheck,
  Settings, Megaphone, Search, ChevronLeft, ChevronRight, Database
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
  const isMonitoringOnly = !isSuperAdmin(admin);
  const [users, setUsers] = useState<PklUser[]>([]);
  const [instansiList, setInstansiList] = useState<PklInstansi[]>([]);
  const [placements, setPlacements] = useState<PklPlacement[]>([]);
  const [evaluations, setEvaluations] = useState<PklEvaluation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<PklClass[]>([]);
  const [loading, setLoading] = useState(true);

  // Active sub-tab state ('placements' | 'students' | 'teachers' | 'users' | 'companies' | 'reports' | 'classes' | 'permissions' | 'announcements')
  const [activeTab, setActiveTab] = useState<'placements' | 'students' | 'teachers' | 'users' | 'companies' | 'reports' | 'classes' | 'permissions' | 'announcements'>('placements');

  // Sidebar Menu Group open/close states
  const [openGroups, setOpenGroups] = useState({
    transaksi: true,
    master: true,
    laporan: true,
    sistem: true,
  });

  const toggleGroup = (group: 'transaksi' | 'master' | 'laporan' | 'sistem') => {
    setOpenGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  // Plotting list filter & pagination states
  const [plottingSearch, setPlottingSearch] = useState('');
  const [plottingStatusFilter, setPlottingStatusFilter] = useState<'all' | 'belum_diplot' | 'sudah_diplot'>('all');
  const [plottingClassFilter, setPlottingClassFilter] = useState('');
  const [plottingPage, setPlottingPage] = useState(1);

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
  const [editingInstansiId, setEditingInstansiId] = useState<string | null>(null);

  // New Announcement Form State
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annSuccess, setAnnSuccess] = useState('');

  // Edit states / Selection states
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentMasterId, setEditingStudentMasterId] = useState<string | null>(null);
  const [editingTeacherMasterId, setEditingTeacherMasterId] = useState<string | null>(null);
  const [tempPembimbingId, setTempPembimbingId] = useState('');
  const [tempInstansiId, setTempInstansiId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const [studentsPage, setStudentsPage] = useState(1);

  const [teacherSearch, setTeacherSearch] = useState('');
  const [teachersPage, setTeachersPage] = useState(1);

  const [companiesSearch, setCompaniesSearch] = useState('');
  const [companiesPage, setCompaniesPage] = useState(1);

  const [classesSearch, setClassesSearch] = useState('');
  const [classesPage, setClassesPage] = useState(1);

  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('');
  const [usersPage, setUsersPage] = useState(1);

  const [reportsSearch, setReportsSearch] = useState('');
  const [reportsClassFilter, setReportsClassFilter] = useState('');
  const [reportsPage, setReportsPage] = useState(1);
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

  useEffect(() => {
    if (activeTab === 'placements') {
      setOpenGroups(prev => ({ ...prev, transaksi: true }));
    } else if (['students', 'teachers', 'companies', 'classes', 'users'].includes(activeTab)) {
      setOpenGroups(prev => ({ ...prev, master: true }));
    } else if (['reports', 'announcements'].includes(activeTab)) {
      setOpenGroups(prev => ({ ...prev, laporan: true }));
    } else if (activeTab === 'permissions') {
      setOpenGroups(prev => ({ ...prev, sistem: true }));
    }
  }, [activeTab]);

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
  const handleSaveInstansi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instNama.trim() || !instAlamat.trim()) {
      alert('Silakan lengkapi nama dan alamat instansi!');
      return;
    }

    const instansiToSave: PklInstansi = {
      id: editingInstansiId || `inst-${Date.now()}`,
      nama_instansi: instNama.trim(),
      alamat: instAlamat.trim(),
      kuota: Number(instKuota),
      pembimbing_nama: instPembimbingNama.trim() || undefined,
      pembimbing_telp: instPembimbingTelp.trim() || undefined,
    };

    const res = await dbSaveInstansi(instansiToSave);
    if (res.success) {
      setInstSuccess(editingInstansiId ? 'Instansi/Perusahaan berhasil diperbarui!' : 'Instansi/Perusahaan berhasil ditambahkan!');
      setInstNama('');
      setInstAlamat('');
      setInstKuota(1);
      setInstPembimbingNama('');
      setInstPembimbingTelp('');
      setEditingInstansiId(null);
      fetchAdminData();
      onRefreshGlobalData();
      setTimeout(() => setInstSuccess(''), 4000);
    } else {
      alert(`Gagal menyimpan instansi ke database!\n\nDetail: ${res.error || 'Terjadi kesalahan sistem.'}`);
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
        id_instansi: tempInstansiId || undefined,
        id_pembimbing: tempPembimbingId || undefined
      };
      const res = await dbSaveUser(updatedUser);
      if (res.success) {
        if (tempInstansiId) {
          const existingPlace = placements.find(p => p.id_siswa === studentId);
          const newPlacement: PklPlacement = {
            id: existingPlace?.id || `place-${Date.now()}`,
            id_siswa: studentId,
            id_instansi: tempInstansiId,
            tanggal_mulai: existingPlace?.tanggal_mulai || '2026-07-01',
            tanggal_selesai: existingPlace?.tanggal_selesai || '2026-10-01',
            status: 'disetujui',
            catatan: 'Penempatan diplot langsung oleh Admin Koordinator.'
          };
          await dbSavePlacement(newPlacement);
        }
        setEditingStudentId(null);
        setTempPembimbingId('');
        setTempInstansiId('');
        fetchAdminData();
        onRefreshGlobalData();
        alert('Penempatan Instansi PKL dan Guru pembimbing berhasil disimpan!');
      } else {
        alert(`Gagal menyimpan data penempatan ke database!\n\nDetail: ${res.error || 'Terjadi kesalahan sistem.'}`);
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
    } else {
      alert(`Gagal memposting pengumuman!\n\nDetail: ${res.error || 'Terjadi kesalahan sistem.'}`);
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
    const matchesQuery = s.nama.toLowerCase().includes(query) ||
           s.nomor_induk.toLowerCase().includes(query) ||
           (s.kelas && s.kelas.toLowerCase().includes(query)) ||
           (s.jurusan && s.jurusan.toLowerCase().includes(query));
    const matchesClass = !studentClassFilter || s.kelas === studentClassFilter;
    return matchesQuery && matchesClass;
  });

  const filteredCompanies = instansiList.filter(c => {
    const query = companiesSearch.toLowerCase();
    return c.nama_instansi.toLowerCase().includes(query) ||
           c.alamat.toLowerCase().includes(query) ||
           (c.pembimbing_nama && c.pembimbing_nama.toLowerCase().includes(query));
  });

  const filteredClasses = classesList.filter(c => {
    const query = classesSearch.toLowerCase();
    return c.nama_kelas.toLowerCase().includes(query) ||
           c.jurusan.toLowerCase().includes(query);
  });

  const filteredUsers = users.filter(u => {
    const query = usersSearch.toLowerCase();
    const matchesQuery = u.nama.toLowerCase().includes(query) ||
           u.email.toLowerCase().includes(query) ||
           u.nomor_induk.toLowerCase().includes(query) ||
           (u.kelas && u.kelas.toLowerCase().includes(query)) ||
           (u.role && u.role.toLowerCase().includes(query));
    const matchesRole = !usersRoleFilter || u.role === usersRoleFilter;
    return matchesQuery && matchesRole;
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
      
      {/* MONITORING ONLY / PANITIA PKL BANNER */}
      {isMonitoringOnly && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
          <div className="flex gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shadow-amber-500/10 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-tight">Mode Monitoring Aktif (Panitia PKL)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Anda masuk sebagai anggota <strong className="text-slate-700">Panitia PKL</strong>. Anda memiliki hak akses penuh untuk melakukan monitoring dan pengawasan kegiatan PKL, rekapitulasi data, serta mengunduh berkas laporan tanpa hak modifikasi database utama.
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-amber-500 text-white font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-wider shrink-0 select-none">
            Read-Only Monitor
          </span>
        </div>
      )}
      
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
          <div className="bg-slate-50/80 border border-slate-200/60 rounded-2xl p-4 space-y-3 lg:sticky lg:top-6 shadow-xs">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block px-1">Menu Kontrol Admin</span>
            
            <div className="flex flex-col gap-3">
              {/* GROUP 1: PLOTTING & TRANSAKSI (AKTIVITAS) */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup('transaksi')}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:bg-slate-200/40 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-500" />
                    Aktivitas & Plotting
                  </span>
                  <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${openGroups.transaksi ? 'rotate-90 text-slate-600' : 'text-slate-400'}`} />
                </button>
                
                {openGroups.transaksi && (
                  <div className="flex flex-col gap-1 pl-2 mt-1 border-l border-slate-200 ml-2">
                    {isTabAllowed('admin_plotting') && (
                      <button
                        onClick={() => setActiveTab('placements')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          activeTab === 'placements' 
                            ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <ClipboardList className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'placements' ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">Plotting & Pengajuan PKL</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* GROUP 2: MASTER DATA */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup('master')}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:bg-slate-200/40 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-500" />
                    Master Data
                  </span>
                  <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${openGroups.master ? 'rotate-90 text-slate-600' : 'text-slate-400'}`} />
                </button>
                
                {openGroups.master && (
                  <div className="flex flex-col gap-1 pl-2 mt-1 border-l border-slate-200 ml-2">
                    {isTabAllowed('admin_siswa') && (
                      <button
                        onClick={() => { setActiveTab('students'); setUserRole('siswa'); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          activeTab === 'students' 
                            ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <GraduationCap className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'students' ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">Master Data Siswa</span>
                      </button>
                    )}
                    {isTabAllowed('admin_guru') && (
                      <button
                        onClick={() => { setActiveTab('teachers'); setUserRole('guru'); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          activeTab === 'teachers' 
                            ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <UserCheck className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'teachers' ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">Master Guru Pembimbing</span>
                      </button>
                    )}
                    {isTabAllowed('admin_instansi') && (
                      <button
                        onClick={() => setActiveTab('companies')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          activeTab === 'companies' 
                            ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Building2 className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'companies' ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate font-semibold">Master Instansi PKL</span>
                      </button>
                    )}
                    {isTabAllowed('admin_kelas') && (
                      <button
                        onClick={() => setActiveTab('classes')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          activeTab === 'classes' 
                            ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <BookOpen className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'classes' ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">Master Kelas & Jurusan</span>
                      </button>
                    )}
                    {isTabAllowed('admin_pengguna') && (
                      <button
                        onClick={() => { setActiveTab('users'); setUserRole('siswa'); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          activeTab === 'users' 
                            ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Settings className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'users' ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">Kelola Akun Login</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* GROUP 3: LAPORAN & KOMUNIKASI */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup('laporan')}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:bg-slate-200/40 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-indigo-500" />
                    Laporan & Informasi
                  </span>
                  <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${openGroups.laporan ? 'rotate-90 text-slate-600' : 'text-slate-400'}`} />
                </button>
                
                {openGroups.laporan && (
                  <div className="flex flex-col gap-1 pl-2 mt-1 border-l border-slate-200 ml-2">
                    {isTabAllowed('admin_rekap') && (
                      <button
                        onClick={() => setActiveTab('reports')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          activeTab === 'reports' 
                            ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <FileCheck className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'reports' ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">Laporan Rekap Nilai</span>
                      </button>
                    )}
                    {isTabAllowed('admin_pengumuman') && (
                      <button
                        onClick={() => setActiveTab('announcements')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          activeTab === 'announcements' 
                            ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                      >
                        <Megaphone className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'announcements' ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">Kelola Pengumuman</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* GROUP 4: KEAMANAN & SISTEM */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup('sistem')}
                  className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:bg-slate-200/40 rounded-lg transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    Keamanan & Sistem
                  </span>
                  <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${openGroups.sistem ? 'rotate-90 text-slate-600' : 'text-slate-400'}`} />
                </button>
                
                {openGroups.sistem && (
                  <div className="flex flex-col gap-1 pl-2 mt-1 border-l border-slate-200 ml-2">
                    <button
                      onClick={() => setActiveTab('permissions')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                        activeTab === 'permissions' 
                          ? 'bg-indigo-600 text-white shadow-sm font-bold' 
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <Shield className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'permissions' ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">Hak Akses Menu</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MAIN PANEL CONTENT & ACTION FORMS */}
        <div className="lg:col-span-9 space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* LEFT/MAIN MODULE COLUMN (based on activeTab) */}
            <div className={`${['students', 'teachers', 'users', 'companies', 'classes', 'permissions'].includes(activeTab) ? 'xl:col-span-8' : 'xl:col-span-12'} space-y-8`}>
          
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
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Pemetaan (Plotting) Instansi & Guru Pembimbing Siswa</h3>
                    <p className="text-xs text-slate-400">Hubungkan setiap siswa magang dengan Instansi PKL dan Guru Pembimbing masing-masing.</p>
                  </div>

                  {/* Filters Grid */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cari nama atau NISN..."
                        value={plottingSearch}
                        onChange={(e) => {
                          setPlottingSearch(e.target.value);
                          setPlottingPage(1);
                        }}
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 w-48 shadow-xs"
                      />
                    </div>

                    {/* Class Dropdown */}
                    <select
                      value={plottingClassFilter}
                      onChange={(e) => {
                        setPlottingClassFilter(e.target.value);
                        setPlottingPage(1);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white text-slate-700 shadow-xs"
                    >
                      <option value="">Semua Kelas</option>
                      {KELAS_OPTIONS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>

                    {/* Status Dropdown */}
                    <select
                      value={plottingStatusFilter}
                      onChange={(e) => {
                        setPlottingStatusFilter(e.target.value as any);
                        setPlottingPage(1);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white text-slate-700 shadow-xs"
                    >
                      <option value="all">Semua Status Plotting</option>
                      <option value="belum_diplot">Belum diplot</option>
                      <option value="sudah_diplot">Sudah diplot</option>
                    </select>
                  </div>
                </div>

                {(() => {
                  const plottingStudents = users.filter(u => u.role === 'siswa');
                  const filteredPlottingStudents = plottingStudents.filter((stud) => {
                    const searchLower = plottingSearch.toLowerCase();
                    const matchesSearch = !plottingSearch || 
                      stud.nama.toLowerCase().includes(searchLower) || 
                      (stud.nomor_induk || '').toLowerCase().includes(searchLower) ||
                      (stud.kelas || '').toLowerCase().includes(searchLower);

                    let matchesStatus = true;
                    if (plottingStatusFilter === 'belum_diplot') {
                      matchesStatus = !stud.id_pembimbing;
                    } else if (plottingStatusFilter === 'sudah_diplot') {
                      matchesStatus = !!stud.id_pembimbing;
                    }

                    const matchesClass = !plottingClassFilter || stud.kelas === plottingClassFilter;
                    return matchesSearch && matchesStatus && matchesClass;
                  });

                  const itemsPerPage = 8;
                  const totalPlottingPages = Math.ceil(filteredPlottingStudents.length / itemsPerPage) || 1;
                  const currentPlottingPage = Math.min(plottingPage, totalPlottingPages);
                  const paginatedPlottingStudents = filteredPlottingStudents.slice(
                    (currentPlottingPage - 1) * itemsPerPage,
                    currentPlottingPage * itemsPerPage
                  );

                  return (
                    <div className="space-y-4">
                      {paginatedPlottingStudents.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-xs text-slate-400 italic font-medium">Tidak ada data siswa yang cocok dengan filter aktif.</p>
                        </div>
                      ) : (
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
                              {paginatedPlottingStudents.map((stud) => {
                                const isEditing = editingStudentId === stud.id;
                                const company = instansiList.find(i => i.id === stud.id_instansi);
                                const currentTeacher = teachers.find(t => t.id === stud.id_pembimbing);
                                
                                  return (
                                    <tr key={stud.id} className="hover:bg-slate-50/50">
                                      <td className="py-3 pr-4">
                                        <span className="font-semibold text-slate-800 block">{stud.nama}</span>
                                        <span className="text-[10px] text-slate-400">{stud.kelas || 'No Kelas'} • NISN: {stud.nomor_induk}</span>
                                      </td>
                                      <td className="py-3 px-4 font-medium text-slate-700">
                                        {isEditing ? (
                                          <select
                                            value={tempInstansiId}
                                            onChange={(e) => setTempInstansiId(e.target.value)}
                                            className="px-2 py-1 rounded border border-slate-200 focus:outline-none bg-white text-slate-800 text-xs w-full max-w-[180px]"
                                          >
                                            <option value="">-- Pilih Instansi --</option>
                                            {instansiList.map(inst => (
                                              <option key={inst.id} value={inst.id}>{inst.nama_instansi}</option>
                                            ))}
                                          </select>
                                        ) : (
                                          company?.nama_instansi || <span className="text-slate-400 italic">Belum diplot</span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4">
                                        {isEditing ? (
                                          <select
                                            value={tempPembimbingId}
                                            onChange={(e) => setTempPembimbingId(e.target.value)}
                                            className="px-2 py-1 rounded border border-slate-200 focus:outline-none bg-white text-slate-800 text-xs"
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
                                              className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-semibold text-xs"
                                            >
                                              Batal
                                            </button>
                                            <button
                                              onClick={() => handleUpdatePembimbing(stud.id)}
                                              className="px-2 py-1 rounded bg-indigo-600 text-white font-semibold text-xs flex items-center gap-0.5"
                                            >
                                              <Check className="w-3 h-3" /> Simpan
                                            </button>
                                          </div>
                                        ) : (
                                          !isMonitoringOnly ? (
                                            <button
                                              onClick={() => {
                                                setEditingStudentId(stud.id);
                                                setTempPembimbingId(stud.id_pembimbing || '');
                                                setTempInstansiId(stud.id_instansi || '');
                                              }}
                                              className="text-xs text-indigo-600 hover:underline font-semibold"
                                            >
                                              Plot Siswa
                                            </button>
                                          ) : (
                                            <span className="text-[11px] text-slate-400 italic">No Akses</span>
                                          )
                                        )}
                                      </td>
                                    </tr>
                                  );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Pagination Controls */}
                      {totalPlottingPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-3 text-xs text-slate-500">
                          <p className="font-medium text-slate-400">
                            Menampilkan <span className="font-bold text-slate-700">{Math.min((currentPlottingPage - 1) * itemsPerPage + 1, filteredPlottingStudents.length)}</span> - <span className="font-bold text-slate-700">{Math.min(currentPlottingPage * itemsPerPage, filteredPlottingStudents.length)}</span> dari <span className="font-bold text-slate-700">{filteredPlottingStudents.length}</span> siswa
                          </p>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPlottingPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentPlottingPage === 1}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            
                            {Array.from({ length: totalPlottingPages }, (_, i) => i + 1).map((pg) => (
                              <button
                                key={pg}
                                onClick={() => setPlottingPage(pg)}
                                className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                                  currentPlottingPage === pg
                                    ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold'
                                }`}
                              >
                                {pg}
                              </button>
                            ))}

                            <button
                              onClick={() => setPlottingPage(prev => Math.min(prev + 1, totalPlottingPages))}
                              disabled={currentPlottingPage === totalPlottingPages}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                    {/* Search Input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cari nama, NISN, kelas..."
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 w-48 sm:w-64 shadow-sm"
                        onChange={(e) => { setStudentSearch(e.target.value); setStudentsPage(1); }}
                        value={studentSearch}
                      />
                    </div>
                    {/* Class Dropdown */}
                    <select
                      value={studentClassFilter}
                      onChange={(e) => {
                        setStudentClassFilter(e.target.value);
                        setStudentsPage(1);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white text-slate-700 shadow-sm"
                    >
                      <option value="">Semua Kelas</option>
                      {KELAS_OPTIONS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
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
                  {isMonitoringOnly ? (
                    <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/20 flex flex-col justify-center items-center text-center space-y-2">
                      <Shield className="w-8 h-8 text-amber-500 opacity-80" />
                      <h4 className="text-xs font-bold text-slate-700">Fitur Impor Dinonaktifkan</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed max-w-xs">
                        Pengunggahan atau modifikasi data siswa secara massal dinonaktifkan dalam mode monitoring Panitia PKL.
                      </p>
                    </div>
                  ) : (
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
                  )}
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
                    <p className="text-xs text-slate-400 italic">Siswa tidak ditemukan atau belum ada data siswa yang sesuai.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider bg-slate-50/50">
                            <th className="py-3 px-4 rounded-l-lg w-12 text-center">No</th>
                            <th className="py-3 px-4 w-32">NISN</th>
                            <th className="py-3 px-4">Nama Lengkap</th>
                            <th className="py-3 px-4 w-32">Kelas</th>
                            <th className="py-3 px-4">Jurusan</th>
                            {!isMonitoringOnly && <th className="py-3 px-4 rounded-r-lg text-right">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {(() => {
                            const itemsPerPage = 8;
                            const totalStudentsPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
                            const currentStudentsPage = Math.min(studentsPage, totalStudentsPages);
                            const paginatedStudents = filteredStudents.slice(
                              (currentStudentsPage - 1) * itemsPerPage,
                              currentStudentsPage * itemsPerPage
                            );

                            return paginatedStudents.map((stud, idx) => {
                              const actualIndex = (currentStudentsPage - 1) * itemsPerPage + idx + 1;
                              const isEditing = editingStudentMasterId === stud.id;
                              return (
                                <tr key={stud.id} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-indigo-50/40' : ''}`}>
                                  {isEditing ? (
                                    <>
                                      <td className="py-3 px-4 text-center font-medium text-slate-400">
                                        {actualIndex}
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
                                        {actualIndex}
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
                                      {!isMonitoringOnly && (
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
                                      )}
                                    </>
                                  )}
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {(() => {
                      const itemsPerPage = 8;
                      const totalStudentsPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
                      const currentStudentsPage = Math.min(studentsPage, totalStudentsPages);

                      if (totalStudentsPages <= 1) return null;
                      return (
                        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-3 text-xs text-slate-500">
                          <p className="font-medium text-slate-400">
                            Menampilkan <span className="font-bold text-slate-700">{Math.min((currentStudentsPage - 1) * itemsPerPage + 1, filteredStudents.length)}</span> - <span className="font-bold text-slate-700">{Math.min(currentStudentsPage * itemsPerPage, filteredStudents.length)}</span> dari <span className="font-bold text-slate-700">{filteredStudents.length}</span> siswa
                          </p>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setStudentsPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentStudentsPage === 1}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            
                            {Array.from({ length: totalStudentsPages }, (_, i) => i + 1).map((pg) => (
                              <button
                                key={pg}
                                onClick={() => setStudentsPage(pg)}
                                className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                                  currentStudentsPage === pg
                                    ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold'
                                }`}
                              >
                                {pg}
                              </button>
                            ))}

                            <button
                              onClick={() => setStudentsPage(prev => Math.min(prev + 1, totalStudentsPages))}
                              disabled={currentStudentsPage === totalStudentsPages}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
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
                  {!isMonitoringOnly && (
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
                  )}
                </div>
              </div>

              {/* SEARCH & FILTER */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  placeholder="Cari guru berdasarkan Nama, NIP/NIK, atau No Telepon..."
                  value={teacherSearch}
                  onChange={(e) => { setTeacherSearch(e.target.value); setTeachersPage(1); }}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none placeholder-slate-400 font-medium transition-all"
                />
                {teacherSearch && (
                  <button
                    onClick={() => { setTeacherSearch(''); setTeachersPage(1); }}
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
              {!isMonitoringOnly && (
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
              )}

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
              <div className="bg-white rounded-xl border border-slate-100 p-4 space-y-4">
                {filteredTeachers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    Tidak ada data guru pembimbing yang ditemukan.
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/30">
                            <th className="py-3 px-4 text-center w-12">No</th>
                            <th className="py-3 px-4 w-40">NIP / NIK</th>
                            <th className="py-3 px-4">Nama & Informasi Akun</th>
                            <th className="py-3 px-4 w-40 text-center">Bimbingan Siswa</th>
                            {!isMonitoringOnly && <th className="py-3 px-4 text-right w-36">Aksi</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-600">
                          {(() => {
                            const itemsPerPage = 8;
                            const totalTeachersPages = Math.ceil(filteredTeachers.length / itemsPerPage) || 1;
                            const currentTeachersPage = Math.min(teachersPage, totalTeachersPages);
                            const paginatedTeachers = filteredTeachers.slice(
                              (currentTeachersPage - 1) * itemsPerPage,
                              currentTeachersPage * itemsPerPage
                            );

                            return paginatedTeachers.map((teacher, idx) => {
                              const actualIndex = (currentTeachersPage - 1) * itemsPerPage + idx + 1;
                              const isEditing = editingTeacherMasterId === teacher.id;
                              const bimbinganCount = allStudents.filter(s => s.id_pembimbing === teacher.id).length;
                              return (
                                <tr key={teacher.id} className={`hover:bg-slate-50/30 transition-colors ${isEditing ? 'bg-indigo-50/30' : ''}`}>
                                  {isEditing ? (
                                    <>
                                      <td className="py-3 px-4 text-center font-medium text-slate-400">
                                        {actualIndex}
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
                                        {actualIndex}
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
                                      {!isMonitoringOnly && (
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
                                      )}
                                    </>
                                  )}
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {(() => {
                      const itemsPerPage = 8;
                      const totalTeachersPages = Math.ceil(filteredTeachers.length / itemsPerPage) || 1;
                      const currentTeachersPage = Math.min(teachersPage, totalTeachersPages);

                      if (totalTeachersPages <= 1) return null;
                      return (
                        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-3 text-xs text-slate-500">
                          <p className="font-medium text-slate-400">
                            Menampilkan <span className="font-bold text-slate-700">{Math.min((currentTeachersPage - 1) * itemsPerPage + 1, filteredTeachers.length)}</span> - <span className="font-bold text-slate-700">{Math.min(currentTeachersPage * itemsPerPage, filteredTeachers.length)}</span> dari <span className="font-bold text-slate-700">{filteredTeachers.length}</span> guru
                          </p>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setTeachersPage(prev => Math.max(prev - 1, 1))}
                              disabled={currentTeachersPage === 1}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            
                            {Array.from({ length: totalTeachersPages }, (_, i) => i + 1).map((pg) => (
                              <button
                                key={pg}
                                onClick={() => setTeachersPage(pg)}
                                className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                                  currentTeachersPage === pg
                                    ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold'
                                }`}
                              >
                                {pg}
                              </button>
                            ))}

                            <button
                              onClick={() => setTeachersPage(prev => Math.min(prev + 1, totalTeachersPages))}
                              disabled={currentTeachersPage === totalTeachersPages}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4" id="admin-users-mgmt">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 font-sans tracking-tight font-bold">Manajemen Master Pengguna</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Atur semua akun siswa, guru, pembimbing mitra industri, dan koordinator sekolah.</p>
                </div>
                
                {/* Search & Filter Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Cari nama, email, NISN..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 w-44 sm:w-56 shadow-sm font-medium"
                      onChange={(e) => { setUsersSearch(e.target.value); setUsersPage(1); }}
                      value={usersSearch}
                    />
                  </div>
                  
                  <select
                    value={usersRoleFilter}
                    onChange={(e) => { setUsersRoleFilter(e.target.value); setUsersPage(1); }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700 shadow-sm font-semibold"
                  >
                    <option value="">Semua Peran</option>
                    <option value="siswa">Siswa</option>
                    <option value="guru">Guru</option>
                    <option value="industri">Industri</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
 
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/30">
                      <th className="py-3 px-4 text-center w-12">No</th>
                      <th className="py-3 px-4">Nama & Email</th>
                      <th className="py-3 px-4 w-28">Role / Peran</th>
                      <th className="py-3 px-4 w-32">Nomor Induk</th>
                      <th className="py-3 px-4 w-36">No Telepon</th>
                      <th className="py-3 px-4 w-32">Sandi Login</th>
                      {!isMonitoringOnly && <th className="py-3 pl-4 text-right w-24">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                          Pengguna tidak ditemukan atau belum ada data.
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        const itemsPerPage = 8;
                        const totalUsersPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
                        const currentUsersPage = Math.min(usersPage, totalUsersPages);
                        const paginatedUsers = filteredUsers.slice(
                          (currentUsersPage - 1) * itemsPerPage,
                          currentUsersPage * itemsPerPage
                        );

                        return paginatedUsers.map((user, idx) => {
                          const actualIndex = (currentUsersPage - 1) * itemsPerPage + idx + 1;
                          const isEditing = editingUserId === user.id;
                          return (
                            <tr key={user.id} className={`hover:bg-slate-50/50 transition-colors ${isEditing ? 'bg-indigo-50/40' : ''}`}>
                              {isEditing ? (
                                <>
                                  {/* EDITING STATE */}
                                  <td className="py-3 px-4 text-center font-medium text-slate-400">
                                    {actualIndex}
                                  </td>
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
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                      placeholder="NISN/NIP"
                                    />
                                  </td>
                                  <td className="py-3 px-4">
                                    <input
                                      type="text"
                                      value={editTelepon}
                                      onChange={(e) => setEditTelepon(e.target.value)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                      placeholder="Telepon"
                                    />
                                  </td>
                                  <td className="py-3 px-4">
                                    <input
                                      type="text"
                                      value={editPassword}
                                      onChange={(e) => setEditPassword(e.target.value)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-xs text-slate-800 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
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
                                  <td className="py-3 px-4 text-center font-medium text-slate-400">
                                    {actualIndex}
                                  </td>
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
                                  {!isMonitoringOnly && (
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
                                  )}
                                </>
                              )}
                            </tr>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {(() => {
                const itemsPerPage = 8;
                const totalUsersPages = Math.ceil(filteredUsers.length / itemsPerPage) || 1;
                const currentUsersPage = Math.min(usersPage, totalUsersPages);

                if (totalUsersPages <= 1) return null;
                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-3 text-xs text-slate-500">
                    <p className="font-medium text-slate-400">
                      Menampilkan <span className="font-bold text-slate-700">{Math.min((currentUsersPage - 1) * itemsPerPage + 1, filteredUsers.length)}</span> - <span className="font-bold text-slate-700">{Math.min(currentUsersPage * itemsPerPage, filteredUsers.length)}</span> dari <span className="font-bold text-slate-700">{filteredUsers.length}</span> pengguna
                    </p>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setUsersPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentUsersPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      {Array.from({ length: totalUsersPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          onClick={() => setUsersPage(pg)}
                          className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                            currentUsersPage === pg
                              ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}

                      <button
                        onClick={() => setUsersPage(prev => Math.min(prev + 1, totalUsersPages))}
                        disabled={currentUsersPage === totalUsersPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: COMPANIES MANAGEMENT */}
          {activeTab === 'companies' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="admin-companies-mgmt">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Daftar Mitra Instansi & Perusahaan</h3>
                  <p className="text-xs text-slate-400">Daftar lengkap mitra industri, alamat lokasi magang, kuota, serta kontak pembimbing industri.</p>
                </div>
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari instansi, alamat..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 w-48 sm:w-64 shadow-sm"
                    onChange={(e) => { setCompaniesSearch(e.target.value); setCompaniesPage(1); }}
                    value={companiesSearch}
                  />
                </div>
              </div>

              {filteredCompanies.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-400 italic">Instansi tidak ditemukan atau belum ada data instansi.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const itemsPerPage = 6;
                      const totalCompaniesPages = Math.ceil(filteredCompanies.length / itemsPerPage) || 1;
                      const currentCompaniesPage = Math.min(companiesPage, totalCompaniesPages);
                      const paginatedCompanies = filteredCompanies.slice(
                        (currentCompaniesPage - 1) * itemsPerPage,
                        currentCompaniesPage * itemsPerPage
                      );

                      return paginatedCompanies.map((inst) => {
                        const plotSiswaCount = users.filter(u => u.role === 'siswa' && u.id_instansi === inst.id).length;
                        return (
                          <div key={inst.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all text-xs flex justify-between gap-4 bg-slate-50/30">
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <strong className="text-sm text-slate-800 block truncate">{inst.nama_instansi}</strong>
                              <p className="text-slate-500 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{inst.alamat}</span>
                              </p>
                              <p className="text-slate-600">
                                Kuota Siswa: <strong>{inst.kuota}</strong> | Sedang Magang: <strong className="text-indigo-600">{plotSiswaCount} siswa</strong>
                              </p>
                              {inst.pembimbing_nama && (
                                <div className="pt-1.5 border-t border-slate-100 text-slate-500 truncate">
                                  Pembimbing Industri: <strong>{inst.pembimbing_nama}</strong> ({inst.pembimbing_telp || 'no telepon'})
                                </div>
                              )}
                            </div>

                            {!isMonitoringOnly && (
                              <div className="flex flex-col gap-1.5 shrink-0 justify-start items-end">
                                <button
                                  onClick={() => {
                                    setEditingInstansiId(inst.id);
                                    setInstNama(inst.nama_instansi);
                                    setInstAlamat(inst.alamat);
                                    setInstKuota(inst.kuota);
                                    setInstPembimbingNama(inst.pembimbing_nama || '');
                                    setInstPembimbingTelp(inst.pembimbing_telp || '');
                                  }}
                                  className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg hover:text-indigo-700 transition-all border border-transparent hover:border-indigo-100"
                                  title="Edit Instansi"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteInstansi(inst.id)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg hover:text-rose-700 transition-all border border-transparent hover:border-rose-100"
                                  title="Hapus Instansi"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Pagination Controls */}
                  {(() => {
                    const itemsPerPage = 6;
                    const totalCompaniesPages = Math.ceil(filteredCompanies.length / itemsPerPage) || 1;
                    const currentCompaniesPage = Math.min(companiesPage, totalCompaniesPages);

                    if (totalCompaniesPages <= 1) return null;
                    return (
                      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-3 text-xs text-slate-500">
                        <p className="font-medium text-slate-400">
                          Menampilkan <span className="font-bold text-slate-700">{Math.min((currentCompaniesPage - 1) * itemsPerPage + 1, filteredCompanies.length)}</span> - <span className="font-bold text-slate-700">{Math.min(currentCompaniesPage * itemsPerPage, filteredCompanies.length)}</span> dari <span className="font-bold text-slate-700">{filteredCompanies.length}</span> instansi
                        </p>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setCompaniesPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentCompaniesPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          
                          {Array.from({ length: totalCompaniesPages }, (_, i) => i + 1).map((pg) => (
                            <button
                              key={pg}
                              onClick={() => setCompaniesPage(pg)}
                              className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                                currentCompaniesPage === pg
                                  ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold'
                              }`}
                            >
                              {pg}
                            </button>
                          ))}

                          <button
                            onClick={() => setCompaniesPage(prev => Math.min(prev + 1, totalCompaniesPages))}
                            disabled={currentCompaniesPage === totalCompaniesPages}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REPORTS REKAP NILAI */}
          {activeTab === 'reports' && (() => {
            const reportsList = compileReportData();
            const filteredReports = reportsList.filter(rep => {
              const query = reportsSearch.toLowerCase();
              const matchesQuery = rep.nama.toLowerCase().includes(query) ||
                                   rep.nisn.toLowerCase().includes(query) ||
                                   rep.instansi.toLowerCase().includes(query) ||
                                   rep.pembimbing.toLowerCase().includes(query);
              
              const studentObj = users.find(u => u.id === rep.id);
              const matchesClass = !reportsClassFilter || studentObj?.kelas === reportsClassFilter;
              
              return matchesQuery && matchesClass;
            });

            const itemsPerPage = 8;
            const totalReportsPages = Math.ceil(filteredReports.length / itemsPerPage) || 1;
            const currentReportsPage = Math.min(reportsPage, totalReportsPages);
            const paginatedReports = filteredReports.slice(
              (currentReportsPage - 1) * itemsPerPage,
              currentReportsPage * itemsPerPage
            );

            return (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4" id="admin-reports">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-slate-50 pb-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Laporan Rekap Nilai Siswa PKL</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Pantau seluruh perolehan nilai akhir (Sekolah & Industri) beserta rata-rata kumulatif.</p>
                  </div>
                  
                  {/* Action and Filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Cari nama, NISN, instansi..."
                        className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 w-44 sm:w-52 shadow-sm font-medium"
                        onChange={(e) => { setReportsSearch(e.target.value); setReportsPage(1); }}
                        value={reportsSearch}
                      />
                    </div>

                    <select
                      value={reportsClassFilter}
                      onChange={(e) => {
                        setReportsClassFilter(e.target.value);
                        setReportsPage(1);
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-700 shadow-sm font-semibold"
                    >
                      <option value="">Semua Kelas</option>
                      {KELAS_OPTIONS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>

                    <button
                      onClick={handleDownloadReport}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-indigo-600/10 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Ekspor (.JSON)
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/30">
                        <th className="py-3 px-4 text-center w-12">No</th>
                        <th className="py-3 px-4">Nama Siswa</th>
                        <th className="py-3 px-4">Instansi PKL</th>
                        <th className="py-3 px-4">Guru Pembimbing</th>
                        <th className="py-3 px-4 text-center">Total Kehadiran</th>
                        <th className="py-3 px-4">Rincian Nilai Akhir</th>
                        <th className="py-3 pl-4 text-right">Rerata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-600">
                      {filteredReports.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                            Laporan tidak ditemukan atau belum ada data.
                          </td>
                        </tr>
                      ) : (
                        paginatedReports.map((rep, idx) => {
                          const actualIndex = (currentReportsPage - 1) * itemsPerPage + idx + 1;
                          return (
                            <tr key={rep.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4 text-center font-medium text-slate-400">
                                {actualIndex}
                              </td>
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
                              <td className="py-3 px-4 text-center">
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
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalReportsPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-3 text-xs text-slate-500">
                    <p className="font-medium text-slate-400">
                      Menampilkan <span className="font-bold text-slate-700">{Math.min((currentReportsPage - 1) * itemsPerPage + 1, filteredReports.length)}</span> - <span className="font-bold text-slate-700">{Math.min(currentReportsPage * itemsPerPage, filteredReports.length)}</span> dari <span className="font-bold text-slate-700">{filteredReports.length}</span> laporan
                    </p>
                    
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setReportsPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentReportsPage === 1}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      
                      {Array.from({ length: totalReportsPages }, (_, i) => i + 1).map((pg) => (
                        <button
                          key={pg}
                          onClick={() => setReportsPage(pg)}
                          className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                            currentReportsPage === pg
                              ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold'
                          }`}
                        >
                          {pg}
                        </button>
                      ))}

                      <button
                        onClick={() => setReportsPage(prev => Math.min(prev + 1, totalReportsPages))}
                        disabled={currentReportsPage === totalReportsPages}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 5: CLASSES MANAGEMENT (MAIN PANE) */}
          {activeTab === 'classes' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4" id="admin-classes-mgmt">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                  <h3 className="text-base font-bold text-slate-800">Daftar Master Kelas</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Master data kelas digunakan untuk memvalidasi pilihan kelas pada saat pendaftaran atau pengeditan data siswa.</p>
                </div>
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari kelas, jurusan..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 w-44 sm:w-56 shadow-sm font-medium"
                    onChange={(e) => { setClassesSearch(e.target.value); setClassesPage(1); }}
                    value={classesSearch}
                  />
                </div>
              </div>

              {filteredClasses.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-400 italic">Kelas atau jurusan tidak ditemukan.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="pb-3 pr-4">Nama Kelas</th>
                          <th className="pb-3 px-4">Jurusan / Kompetensi Keahlian</th>
                          <th className="pb-3 px-4 text-center">Jumlah Siswa</th>
                          {!isMonitoringOnly && <th className="pb-3 pl-4 text-right">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-600">
                        {(() => {
                          const itemsPerPage = 8;
                          const totalClassesPages = Math.ceil(filteredClasses.length / itemsPerPage) || 1;
                          const currentClassesPage = Math.min(classesPage, totalClassesPages);
                          const paginatedClasses = filteredClasses.slice(
                            (currentClassesPage - 1) * itemsPerPage,
                            currentClassesPage * itemsPerPage
                          );

                          return paginatedClasses.map((cls) => {
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
                                {!isMonitoringOnly && (
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
                                )}
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  {(() => {
                    const itemsPerPage = 8;
                    const totalClassesPages = Math.ceil(filteredClasses.length / itemsPerPage) || 1;
                    const currentClassesPage = Math.min(classesPage, totalClassesPages);

                    if (totalClassesPages <= 1) return null;
                    return (
                      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-100 pt-4 gap-3 text-xs text-slate-500">
                        <p className="font-medium text-slate-400">
                          Menampilkan <span className="font-bold text-slate-700">{Math.min((currentClassesPage - 1) * itemsPerPage + 1, filteredClasses.length)}</span> - <span className="font-bold text-slate-700">{Math.min(currentClassesPage * itemsPerPage, filteredClasses.length)}</span> dari <span className="font-bold text-slate-700">{filteredClasses.length}</span> kelas
                        </p>
                        
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setClassesPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentClassesPage === 1}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          
                          {Array.from({ length: totalClassesPages }, (_, i) => i + 1).map((pg) => (
                            <button
                              key={pg}
                              onClick={() => setClassesPage(pg)}
                              className={`w-7 h-7 text-xs font-bold rounded-lg transition-all ${
                                currentClassesPage === pg
                                  ? 'bg-indigo-600 text-white shadow-xs font-extrabold'
                                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold'
                              }`}
                            >
                              {pg}
                            </button>
                          ))}

                          <button
                            onClick={() => setClassesPage(prev => Math.min(prev + 1, totalClassesPages))}
                            disabled={currentClassesPage === totalClassesPages}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
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
                                  disabled={isMonitoringOnly}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer transition-all disabled:opacity-50"
                                />
                              </td>
                              <td className="py-4 px-4 text-center">
                                <input
                                  type="checkbox"
                                  id={`perm-guru-${menu.id}`}
                                  checked={menu.allowed_roles.includes('guru')}
                                  onChange={() => handleTogglePermission(menu.id, 'guru')}
                                  disabled={isMonitoringOnly}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer transition-all disabled:opacity-50"
                                />
                              </td>
                              <td className="py-4 px-4 text-center">
                                <input
                                  type="checkbox"
                                  id={`perm-industri-${menu.id}`}
                                  checked={menu.allowed_roles.includes('industri')}
                                  onChange={() => handleTogglePermission(menu.id, 'industri')}
                                  disabled={isMonitoringOnly}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer transition-all disabled:opacity-50"
                                />
                              </td>
                              <td className="py-4 px-4 text-center">
                                <input
                                  type="checkbox"
                                  id={`perm-admin-${menu.id}`}
                                  checked={menu.allowed_roles.includes('admin')}
                                  onChange={() => handleTogglePermission(menu.id, 'admin')}
                                  disabled={isMonitoringOnly}
                                  className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer transition-all disabled:opacity-50"
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

          {/* TAB: ANNOUNCEMENTS MANAGEMENT (MAIN PANE) */}
          {activeTab === 'announcements' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6" id="admin-announcements-mgmt">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-indigo-600" /> Kelola Pengumuman Koordinator PKL
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Posting pengumuman penting yang akan muncul secara real-time di dashboard seluruh siswa, guru pembimbing, dan perwakilan industri.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Side: Create form */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-indigo-600" /> Tulis Pengumuman Koordinator
                    </h4>

                    <form onSubmit={handleAddAnnouncement} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-600 mb-1.5">Judul Pengumuman</label>
                        <input
                          type="text"
                          required
                          value={annTitle}
                          onChange={(e) => setAnnTitle(e.target.value)}
                          placeholder="Contoh: Batas Akhir Penyerahan Jurnal PKL..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-600 mb-1.5">Konten Pengumuman</label>
                        <textarea
                          rows={5}
                          required
                          value={annContent}
                          onChange={(e) => setAnnContent(e.target.value)}
                          placeholder="Tulis rincian informasi pengumuman di sini secara lengkap..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white text-slate-800 leading-relaxed"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Megaphone className="w-4 h-4" /> Posting Pengumuman
                      </button>

                      {annSuccess && <p className="text-[11px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 p-2 rounded-lg">{annSuccess}</p>}
                    </form>
                  </div>
                </div>

                {/* Right Side: Announcements list */}
                <div className="lg:col-span-7 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Histori Pengumuman Anda</h4>
                  
                  {announcements.filter(a => a.author.includes('Koordinator')).length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <Megaphone className="w-8 h-8 text-slate-350 mx-auto mb-2 opacity-55" />
                      <p className="text-xs text-slate-400 italic">Belum ada pengumuman yang di-posting.</p>
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[500px] overflow-y-auto pr-1">
                      {announcements.filter(a => a.author.includes('Koordinator')).map(ann => (
                        <div key={ann.id} className="p-4 bg-white hover:shadow-md hover:border-slate-200 transition-all rounded-2xl border border-slate-100 text-xs flex justify-between items-start gap-4 shadow-xs">
                          <div className="space-y-1.5">
                            <strong className="text-sm text-slate-800 font-extrabold">{ann.judul}</strong>
                            <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">{ann.konten}</p>
                            <span className="text-[10px] text-slate-400 font-medium block mt-1">{ann.tanggal}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteAnn(ann.id)}
                            className="text-rose-500 hover:text-rose-700 p-2 bg-rose-50 hover:bg-rose-100 border border-rose-100/50 rounded-xl transition-colors shrink-0"
                            title="Hapus Pengumuman"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

            </div>

            {/* RIGHT COLUMN: ACTION FORMS (USER ADD, INSTANSI ADD, ANNOUNCEMENTS) */}
            {['students', 'teachers', 'users', 'companies', 'classes', 'permissions'].includes(activeTab) && (
              <div className="xl:col-span-4 space-y-8">
                {isMonitoringOnly ? (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50/30 border border-amber-100 rounded-2xl shadow-xs p-6 space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-amber-100/50 pb-3">
                      <Shield className="w-4.5 h-4.5 text-amber-500 animate-pulse" /> Panel Monitoring Panitia
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Anda terdaftar sebagai anggota <span className="font-semibold text-slate-800">Panitia PKL</span>. Untuk menjaga integritas database dan data penempatan siswa, hak modifikasi data dinonaktifkan secara otomatis.
                    </p>
                    
                    <div className="space-y-3 pt-2 text-xs">
                      <div className="p-3.5 bg-white border border-amber-100/60 rounded-xl space-y-1">
                        <strong className="text-amber-800 font-extrabold block">Modus Operasional</strong>
                        <p className="text-slate-500">Read-Only / Hanya Tinjauan (Monitoring)</p>
                      </div>
                      
                      <div className="p-3.5 bg-white border border-amber-100/60 rounded-xl space-y-1.5">
                        <strong className="text-amber-800 font-extrabold block">Fungsionalitas yang Tersedia</strong>
                        <ul className="space-y-1 text-slate-500 font-medium list-disc list-inside">
                          <li>Melihat seluruh plotting & penempatan</li>
                          <li>Melakukan filter & pencarian data</li>
                          <li>Unduh Laporan Rekapitulasi Nilai</li>
                          <li>Unduh Template berkas PKL</li>
                        </ul>
                      </div>

                      <div className="p-3.5 bg-amber-500/10 text-amber-800 border border-amber-500/20 rounded-xl leading-relaxed">
                        Jika terdapat kesalahan data atau memerlukan penambahan siswa/guru/instansi baru, harap berkoordinasi dengan <strong>Super Admin</strong> / Koordinator PKL.
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
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
                {editingInstansiId ? (
                  <>
                    <Edit className="w-4 h-4 text-indigo-600" /> Edit Mitra Instansi
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-emerald-600" /> Tambah Mitra Instansi
                  </>
                )}
              </h4>

              <form onSubmit={handleSaveInstansi} className="space-y-3.5 text-xs">
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

                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-all"
                  >
                    {editingInstansiId ? 'Simpan Perubahan' : 'Tambahkan Instansi'}
                  </button>
                  {editingInstansiId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingInstansiId(null);
                        setInstNama('');
                        setInstAlamat('');
                        setInstKuota(1);
                        setInstPembimbingNama('');
                        setInstPembimbingTelp('');
                      }}
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-lg transition-all"
                    >
                      Batal
                    </button>
                  )}
                </div>

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
                  </>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
