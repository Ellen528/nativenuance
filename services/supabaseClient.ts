import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'NOT FOUND');
console.log('Supabase Key:', supabaseAnonKey ? 'Found' : 'NOT FOUND');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Cloud sync will be disabled.');
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

console.log('Supabase client:', supabase ? 'Initialized' : 'NOT initialized');

export const isSupabaseConfigured = () => !!supabase;

