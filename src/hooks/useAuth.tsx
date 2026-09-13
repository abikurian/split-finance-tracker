import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { syncFromSupabase } from '../lib/supabaseSync';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSyncing: boolean;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(session);
          const activeUser = session?.user ?? null;
          setUser(activeUser);
          setLoading(false);

          if (activeUser) {
            setIsSyncing(true);
            await syncFromSupabase(activeUser.id);
            if (mounted) setIsSyncing(false);
          }
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching session:', err);
          setLoading(false);
          setIsSyncing(false);
        }
      }
    };

    initAuth();

    // Listen to real-time auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (mounted) {
        setSession(session);
        const activeUser = session?.user ?? null;
        setUser(activeUser);
        setLoading(false);

        if (activeUser) {
          setIsSyncing(true);
          await syncFromSupabase(activeUser.id);
          if (mounted) setIsSyncing(false);
        } else {
          setIsSyncing(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (err) {
      console.error('Error signing out:', err);
      return { error: err as Error };
    } finally {
      setUser(null);
      setSession(null);
      setLoading(false);
      setIsSyncing(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isSyncing, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
