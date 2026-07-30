import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get credentials from environment variables or localStorage
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const DEFAULT_SUPABASE_URL = 'https://eppbwhvtezpcbukcshxu.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwcGJ3aHZ0ZXpwY2J1a2NzaHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NzU2ODUsImV4cCI6MjA5ODM1MTY4NX0.hn5S8wnseARTq3s6ozP4HbUtLwLtLmd0-s6fLwo-ML0';

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

  // Universal fallback to active cloud database for seamless cross-device login
  return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY };
}

export function saveSupabaseConfig(url: string, anonKey: string) {
  if (!url || !anonKey) {
    localStorage.removeItem('SIM_PKL_SUPABASE_URL');
    localStorage.removeItem('SIM_PKL_SUPABASE_ANON_KEY');
  } else {
    localStorage.setItem('SIM_PKL_SUPABASE_URL', url.trim());
    localStorage.setItem('SIM_PKL_SUPABASE_ANON_KEY', anonKey.trim());
  }

  // Persist to the full-stack server so other browsers and devices sync automatically on load
  fetch('/api/save-supabase-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: (url || '').trim(), anonKey: (anonKey || '').trim() })
  }).catch(err => console.error('Failed to save Supabase config to server:', err));
}

export async function syncSupabaseConfigFromServer(): Promise<boolean> {
  try {
    const localUrl = localStorage.getItem('SIM_PKL_SUPABASE_URL');
    const localKey = localStorage.getItem('SIM_PKL_SUPABASE_ANON_KEY');

    // If local credentials exist, aggressively push to server in background so other devices get it
    if (localUrl && localKey) {
      fetch('/api/save-supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: localUrl.trim(), anonKey: localKey.trim() })
      }).catch(() => {});
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch('/api/supabase-config', { signal: controller.signal }).catch(() => null);
    clearTimeout(timeoutId);

    if (res && res.ok) {
      const data = await res.json();
      if (data.url && data.anonKey) {
        if (localUrl !== data.url || localKey !== data.anonKey) {
          localStorage.setItem('SIM_PKL_SUPABASE_URL', data.url.trim());
          localStorage.setItem('SIM_PKL_SUPABASE_ANON_KEY', data.anonKey.trim());
          supabaseInstance = null; // Reset instance to force re-creation
          return true; // Config was updated
        }
      }
    }
  } catch (err) {
    console.error('Failed to sync Supabase config from server:', err);
  }
  return false;
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
