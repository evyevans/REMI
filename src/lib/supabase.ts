import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// In showcase mode, fall back to placeholder values so the app doesn't throw.
// All Supabase calls will fail silently — hooks handle empty/error states gracefully.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const checkSupabaseConnection = async () => false;
