import { supabase } from './supabaseClient';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

export interface AuthError {
  message: string;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: AuthError | null;
}

export const authService = {
  /**
   * Sign up a new user with email and password
   */
  async signUp(email: string, password: string): Promise<AuthResult> {
    if (!supabase) {
      return { user: null, session: null, error: { message: 'Supabase not configured' } };
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    return {
      user: data.user,
      session: data.session,
      error: error ? { message: error.message } : null,
    };
  },

  /**
   * Sign in an existing user with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) {
      return { user: null, session: null, error: { message: 'Supabase not configured' } };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return {
      user: data.user,
      session: data.session,
      error: error ? { message: error.message } : null,
    };
  },

  /**
   * Sign out the current user
   */
  async signOut(): Promise<{ error: AuthError | null }> {
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } };
    }

    const { error } = await supabase.auth.signOut();
    return { error: error ? { message: error.message } : null };
  },

  /**
   * Get the current user
   */
  async getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  /**
   * Get the current session
   */
  async getSession(): Promise<Session | null> {
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  /**
   * Subscribe to auth state changes
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } };

    return supabase.auth.onAuthStateChange(callback);
  },
};

