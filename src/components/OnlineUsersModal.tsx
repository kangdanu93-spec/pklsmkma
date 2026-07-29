import React, { useState, useEffect } from 'react';
import { Users, X, RefreshCw, Search, Shield, GraduationCap, Building2, UserCheck, Smartphone, Laptop, Clock, Activity, Wifi } from 'lucide-react';
import { OnlineUserSession, UserRole } from '../types';
import { dbGetOnlineUsers } from '../utils/localDb';

interface OnlineUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
}

export default function OnlineUsersModal({ isOpen, onClose, currentUserId }: OnlineUsersModalProps) {
  const [onlineList, setOnlineList] = useState<OnlineUserSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | UserRole>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchOnlineUsers = async () => {
    setIsRefreshing(true);
    try {
      const data = await dbGetOnlineUsers();
      setOnlineList(data);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Failed to fetch online users:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchOnlineUsers();
      const interval = setInterval(fetchOnlineUsers, 8000); // refresh every 8s
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter list
  const filteredUsers = onlineList.filter(u => {
    const matchesSearch = u.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.kelas && u.kelas.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (u.nomor_induk && u.nomor_induk.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = selectedRole === 'all' || u.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  const countByRole = {
    siswa: onlineList.filter(u => u.role === 'siswa').length,
    guru: onlineList.filter(u => u.role === 'guru').length,
    industri: onlineList.filter(u => u.role === 'industri').length,
    admin: onlineList.filter(u => u.role === 'admin').length,
  };

  const getTimeAgo = (timestamp: number) => {
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 10) return 'Baru saja';
    if (diffSec < 60) return `${diffSec} detik lalu`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin} menit lalu`;
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold border border-rose-200"><Shield className="w-3 h-3 text-rose-600" /> Admin</span>;
      case 'guru':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200"><UserCheck className="w-3 h-3 text-emerald-600" /> Guru</span>;
      case 'industri':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold border border-purple-200"><Building2 className="w-3 h-3 text-purple-600" /> Industri</span>;
      case 'siswa':
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200"><GraduationCap className="w-3 h-3 text-blue-600" /> Siswa</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 p-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/50 border border-indigo-400/40 flex items-center justify-center text-white">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white leading-tight">Pengguna Online / Aktif</h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                  <Wifi className="w-2.5 h-2.5 animate-pulse" /> Live Tracking
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                Total {onlineList.length} pengguna sedang mengakses aplikasi saat ini
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 text-indigo-200 hover:text-white hover:bg-white/20 transition-all cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-center shrink-0">
          <button
            onClick={() => setSelectedRole('all')}
            className={`p-2 rounded-xl transition-all cursor-pointer text-left border ${selectedRole === 'all' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-80 font-bold">Semua</div>
            <div className="text-base font-extrabold">{onlineList.length}</div>
          </button>

          <button
            onClick={() => setSelectedRole('siswa')}
            className={`p-2 rounded-xl transition-all cursor-pointer text-left border ${selectedRole === 'siswa' ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-80 font-bold">Siswa</div>
            <div className="text-base font-extrabold text-blue-600 group-hover:text-white">{countByRole.siswa}</div>
          </button>

          <button
            onClick={() => setSelectedRole('guru')}
            className={`p-2 rounded-xl transition-all cursor-pointer text-left border ${selectedRole === 'guru' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-80 font-bold">Guru</div>
            <div className="text-base font-extrabold text-emerald-600">{countByRole.guru}</div>
          </button>

          <button
            onClick={() => setSelectedRole('industri')}
            className={`p-2 rounded-xl transition-all cursor-pointer text-left border ${selectedRole === 'industri' ? 'bg-purple-600 text-white border-purple-600 shadow-xs' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
          >
            <div className="text-[10px] uppercase tracking-wider opacity-80 font-bold">Industri/Admin</div>
            <div className="text-base font-extrabold text-purple-600">{countByRole.industri + countByRole.admin}</div>
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama, email, kelas..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600">
                ×
              </button>
            )}
          </div>

          <button
            onClick={fetchOnlineUsers}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0"
            title="Sembunyikan / Refresh data online"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* User List Content */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium">Tidak ada pengguna online yang sesuai kriteria kueri.</p>
            </div>
          ) : (
            filteredUsers.map(user => {
              const isSelf = currentUserId === user.userId;
              return (
                <div
                  key={user.email}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                    isSelf 
                      ? 'bg-indigo-50/70 border-indigo-200 shadow-2xs' 
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center uppercase shadow-xs">
                        {user.nama.substring(0, 2)}
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate">{user.nama}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.2 bg-indigo-600 text-white text-[9px] font-extrabold rounded-md">
                            Anda
                          </span>
                        )}
                        {getRoleBadge(user.role)}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 truncate">
                        <span>{user.email}</span>
                        {user.kelas && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-slate-700">{user.kelas}</span>
                          </>
                        )}
                        {user.nomor_induk && (
                          <>
                            <span>•</span>
                            <span>{user.nomor_induk}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 text-[10px] space-y-0.5">
                    <div className="flex items-center justify-end gap-1 text-emerald-600 font-bold">
                      <Activity className="w-3 h-3 animate-pulse" />
                      <span>{getTimeAgo(user.lastActive)}</span>
                    </div>
                    {user.deviceInfo && (
                      <div className="text-slate-400 flex items-center justify-end gap-1 font-medium">
                        {user.deviceInfo.includes('Smartphone') ? (
                          <Smartphone className="w-3 h-3 text-slate-400" />
                        ) : (
                          <Laptop className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{user.deviceInfo}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Terakhir diperbarui: {lastRefreshed.toLocaleTimeString()}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
