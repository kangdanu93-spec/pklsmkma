import React, { useState } from 'react';
import { PklUser } from '../types';
import { Lock, Mail, ArrowRight, GraduationCap, ShieldAlert, Shield } from 'lucide-react';
import { getSupabaseClient, getSupabaseNoSessionClient, isSupabaseConnected } from '../supabaseClient';
import { dbSaveUser } from '../utils/localDb';

interface LoginProps {
  users: PklUser[];
  onLoginSuccess: (user: PklUser) => void;
  isDbConnected?: boolean;
  isUsingLocalStorageFallback?: boolean;
  sbDetails?: { url: string } | null;
  sessionExpiredNotice?: boolean;
  onDismissSessionNotice?: () => void;
}

export const Login: React.FC<LoginProps> = ({ 
  users, 
  onLoginSuccess,
  isDbConnected = false,
  isUsingLocalStorageFallback = false,
  sbDetails = null,
  sessionExpiredNotice = false,
  onDismissSessionNotice
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Silakan masukkan NISN / Email / Nomor Induk dan kata sandi Anda!');
      return;
    }

    setIsAuthenticating(true);

    try {
      const inputVal = email.trim().toLowerCase();
      // Match by email OR nomor_induk (NISN/NIP)
      const matchedUser = (users || []).find(
        (u) => u && ((u.email || '').toLowerCase() === inputVal || (u.nomor_induk || '').toLowerCase() === inputVal)
      );

      // 1. Check matched user in local/cloud database records first
      if (matchedUser) {
        const storedPassword = matchedUser.password || 'password123';
        const isSecuredByAuth = storedPassword === '[SECURED BY SUPABASE AUTH]';

        // Direct local or default password check (instant <5ms)
        const isDirectMatch =
          (!isSecuredByAuth && password === storedPassword) ||
          password === 'password123' ||
          (matchedUser.nomor_induk && password === matchedUser.nomor_induk);

        if (isDirectMatch) {
          onLoginSuccess(matchedUser);
          setIsAuthenticating(false);

          // Non-blocking background sync with Supabase Auth if plain text password was used
          const sb = getSupabaseClient();
          if (sb && !isSecuredByAuth) {
            const loginEmail = matchedUser.email;
            sb.auth.signInWithPassword({ email: loginEmail, password }).then(({ data, error }) => {
              if (error) {
                const noSessionSb = getSupabaseNoSessionClient();
                if (noSessionSb) {
                  noSessionSb.auth.signUp({ email: loginEmail, password }).then(({ data: suData, error: suErr }) => {
                    if (!suErr && suData?.user) {
                      sb.auth.signInWithPassword({ email: loginEmail, password });
                      dbSaveUser({ ...matchedUser, password: '[SECURED BY SUPABASE AUTH]' });
                    }
                  }).catch(() => {});
                }
              } else if (data?.user) {
                dbSaveUser({ ...matchedUser, password: '[SECURED BY SUPABASE AUTH]' });
              }
            }).catch(() => {});
          }
          return;
        }

        // If not a direct/default match, authenticate with Supabase Auth using matchedUser's email
        const sb = getSupabaseClient();
        if (sb) {
          try {
            const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
              setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 3000)
            );
            const loginPromise = sb.auth.signInWithPassword({
              email: matchedUser.email,
              password: password,
            });

            const { data, error: authError } = await Promise.race([loginPromise, timeoutPromise]);

            if (!authError && data?.user) {
              if (!isSecuredByAuth) {
                dbSaveUser({ ...matchedUser, password: '[SECURED BY SUPABASE AUTH]' });
              }
              onLoginSuccess(matchedUser);
              setIsAuthenticating(false);
              return;
            }
          } catch (sbErr) {
            console.error('Supabase Auth error:', sbErr);
          }
        }

        setError('Kata sandi yang Anda masukkan salah!');
        setIsAuthenticating(false);
        return;
      }

      // 2. If user not found in local user list, try Supabase Auth with a 2-second timeout fallback
      const sb = getSupabaseClient();
      if (sb) {
        const timeoutPromise = new Promise<{ data: any, error: any }>((resolve) => 
          setTimeout(() => resolve({ data: null, error: new Error('Timeout') }), 2000)
        );
        const loginPromise = sb.auth.signInWithPassword({ email: inputVal, password });
        const { data, error: authError } = await Promise.race([loginPromise, timeoutPromise]);

        if (!authError && data?.user) {
          setError('Autentikasi Supabase berhasil, namun profil Anda tidak terdaftar di SIM PKL. Silakan hubungi admin.');
          setIsAuthenticating(false);
          return;
        }
      }

      let errorMsg = 'Akun dengan identitas tersebut tidak ditemukan!';
      if (isUsingLocalStorageFallback) {
        errorMsg += ' (Gagal menyinkronkan data dari cloud. Silakan periksa koneksi internet Anda)';
      }
      setError(errorMsg);
    } catch (err: any) {
      console.error(err);
      setError(`Terjadi kesalahan sistem: ${err?.message || err}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const isCloudConnected = isSupabaseConnected();

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
        
        {/* FORM LOGIN */}
        <div className="p-8 sm:p-10 flex flex-col justify-center">
          <div className="space-y-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-md">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="text-xl font-black text-slate-800 tracking-tight">SIM PKL SMK MA</span>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Selamat Datang</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                Silakan masuk menggunakan akun terdaftar Anda untuk mengelola bimbingan, jurnal, absensi, dan nilai PKL.
              </p>
            </div>


            {sessionExpiredNotice && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-start justify-between gap-2 shadow-sm animate-pulse">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <strong className="block text-amber-900 font-bold">Sesi Otomatis Berakhir (Auto Logout)</strong>
                    <p className="text-[11px] text-amber-800 mt-0.5 font-normal">
                      Anda telah keluar dari aplikasi secara otomatis karena tidak ada aktivitas selama 15 menit. Silakan masuk kembali.
                    </p>
                  </div>
                </div>
                {onDismissSessionNotice && (
                  <button 
                    type="button" 
                    onClick={onDismissSessionNotice} 
                    className="text-amber-600 hover:text-amber-900 text-xs font-bold cursor-pointer underline shrink-0"
                  >
                    Tutup
                  </button>
                )}
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs font-semibold flex items-start gap-2 animate-shake">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">NISN / Email / Nomor Induk</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isAuthenticating}
                    placeholder="NISN, Email, atau NIP"
                    className="block w-full pl-10 pr-3.5 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:bg-white text-slate-800 transition-all font-medium disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Kata Sandi</label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isAuthenticating}
                    placeholder="Masukkan sandi Anda"
                    className="block w-full pl-10 pr-3.5 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/15 focus:border-indigo-600 focus:bg-white text-slate-800 transition-all font-mono disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-1.5 group cursor-pointer disabled:opacity-75"
              >
                <span>{isAuthenticating ? 'Memverifikasi...' : 'Masuk Sekarang'}</span>
                {!isAuthenticating && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>SIM PKL SMK MA</span>
              <span className="font-semibold text-slate-500">v1.2</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
