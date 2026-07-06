import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get credentials from environment variables or localStorage
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  // Check localStorage first (user-entered in UI)
  const localUrl = localStorage.getItem('SIM_PKL_SUPABASE_URL');
  const localKey = localStorage.getItem('SIM_PKL_SUPABASE_ANON_KEY');

  if (localUrl && localKey) {
    return { url: localUrl, anonKey: localKey };
  }

  // Fallback to Vite environment variables
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }

  return null;
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  if (!url || !anonKey) {
    localStorage.removeItem('SIM_PKL_SUPABASE_URL');
    localStorage.removeItem('SIM_PKL_SUPABASE_ANON_KEY');
  } else {
    localStorage.setItem('SIM_PKL_SUPABASE_URL', url.trim());
    localStorage.setItem('SIM_PKL_SUPABASE_ANON_KEY', anonKey.trim());
  }
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) {
    supabaseInstance = null;
    return null;
  }

  try {
    // Re-create instance if the config credentials don't match our active instance
    // or if no instance exists yet.
    if (!supabaseInstance) {
      supabaseInstance = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
    }
    return supabaseInstance;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
}

// Check if Supabase connection is fully configured and valid
export function isSupabaseConnected(): boolean {
  return getSupabaseConfig() !== null;
}

// Temporary client with persistSession: false to perform sign-ups/registrations
// of other users without overriding the currently logged in administrator's session
export function getSupabaseNoSessionClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;

  try {
    return createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  } catch (error) {
    console.error('Failed to initialize no-session Supabase client:', error);
    return null;
  }
}
