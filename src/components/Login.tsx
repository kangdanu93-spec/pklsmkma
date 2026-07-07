import React, { useState } from 'react';
import { PklUser } from '../types';
import { Lock, Mail, ArrowRight, GraduationCap, ShieldAlert, Shield } from 'lucide-react';
import { getSupabaseClient, getSupabaseNoSessionClient, isSupabaseConnected } from '../supabaseClient';
import { dbSaveUser } from '../utils/localDb';

interface LoginProps {
  users: PklUser[];
  onLoginSuccess: (user: PklUser) => void;
}

export const Login: React.FC<LoginProps> = ({ users, onLoginSuccess }) => {
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
      const sb = getSupabaseClient();
      const inputVal = email.trim().toLowerCase();
      // Match by email OR nomor_induk (NISN/NIP)
      const matchedUser = users.find(
        (u) => u.email.toLowerCase() === inputVal || u.nomor_induk.toLowerCase() === inputVal
      );

      const loginEmail = matchedUser ? matchedUser.email : inputVal;

      if (sb) {
        // 1. Attempt login with official Supabase Auth
        const { data, error: authError } = await sb.auth.signInWithPassword({
          email: loginEmail,
          password: password,
        });

        if (!authError && data?.user) {
          // Success! Fetch the matched local/public user profile
          if (matchedUser) {
            // Clean up the plain-text password column from the public table for privacy
            if (matchedUser.password && matchedUser.password !== '[SECURED BY SUPABASE AUTH]') {
              const updated = { ...matchedUser, password: '[SECURED BY SUPABASE AUTH]' };
              await dbSaveUser(updated);
            }
            onLoginSuccess(matchedUser);
          } else {
            setError('Autentikasi Supabase berhasil, namun profil Anda tidak terdaftar di SIM PKL. Silakan hubungi admin.');
          }
          setIsAuthenticating(false);
          return;
        }

        // 2. If Auth login fails because user isn't enrolled in Supabase Auth yet,
        // or if they are unconfirmed, we can check if they exist in pkl_users with correct plain password.
        if (matchedUser) {
          const correctPassword = matchedUser.password || 'password123';
          if (password === correctPassword) {
            // Self-healing: enrollment to Supabase Auth on-the-fly!
            const noSessionSb = getSupabaseNoSessionClient();
            if (noSessionSb) {
              try {
                const { data: signUpData, error: signUpError } = await noSessionSb.auth.signUp({
                  email: loginEmail,
                  password: password,
                });

                if (!signUpError && signUpData?.user) {
                  // Now perform official login with the main client to establish session
                  const { error: finalLoginError } = await sb.auth.signInWithPassword({
                    email: loginEmail,
                    password: password,
                  });

                  if (!finalLoginError) {
                    // Erase plain-text password from the public table for security!
                    const updated = { ...matchedUser, password: '[SECURED BY SUPABASE AUTH]' };
                    await dbSaveUser(updated);
                    onLoginSuccess(matchedUser);
                    setIsAuthenticating(false);
                    return;
                  } else {
                    // If login failed (e.g. requires email confirmation), bypass and log in via fallback
                    console.log('Supabase Auth signIn failed but user password is correct in public table. Logging in via fallback.', finalLoginError);
                    onLoginSuccess(matchedUser);
                    setIsAuthenticating(false);
                    return;
                  }
                } else {
                  // Fallback: If signUp failed (e.g., user already exists, rate limit), bypass and log in anyway
                  console.log('Supabase Auth signUp failed or user already registered. Logging in via fallback.', signUpError);
                  onLoginSuccess(matchedUser);
                  setIsAuthenticating(false);
                  return;
                }
              } catch (signUpErr) {
                console.error('Silent error during Supabase enrollment:', signUpErr);
                onLoginSuccess(matchedUser);
                setIsAuthenticating(false);
                return;
              }
            } else {
              // Fallback if no-session client could not be created
              onLoginSuccess(matchedUser);
              setIsAuthenticating(false);
              return;
            }
          } else {
            setError('Kata sandi yang Anda masukkan salah!');
          }
        } else {
          setError('Akun dengan identitas tersebut tidak ditemukan!');
        }
      } else {
        // 3. Fallback to Local Storage authentication if Supabase is offline/not set up
        if (!matchedUser) {
          setError('Akun dengan identitas tersebut tidak ditemukan!');
          setIsAuthenticating(false);
          return;
        }

        const correctPassword = matchedUser.password || 'password123';
        if (password === correctPassword) {
          onLoginSuccess(matchedUser);
        } else {
          setError('Kata sandi yang Anda masukkan salah!');
        }
      }
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
