import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { syncFromSupabase } from '../lib/supabaseSync';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isSyncing: boolean;
  isInitialSyncing: boolean;
  signOut: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    let initialSyncDone = false;

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
            if (mounted) {
              setIsSyncing(false);
              setIsInitialSyncing(false);
              initialSyncDone = true;
            }
          } else {
            setIsInitialSyncing(false);
            initialSyncDone = true;
          }
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching session:', err);
          setLoading(false);
          setIsSyncing(false);
          setIsInitialSyncing(false);
          initialSyncDone = true;
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
          if (!initialSyncDone) {
            setIsSyncing(true);
            await syncFromSupabase(activeUser.id);
            if (mounted) {
              setIsSyncing(false);
              setIsInitialSyncing(false);
              initialSyncDone = true;
            }
          } else {
            // Background sync (non-blocking)
            setIsSyncing(true);
            syncFromSupabase(activeUser.id).finally(() => {
              if (mounted) setIsSyncing(false);
            });
          }
        } else {
          setIsSyncing(false);
          setIsInitialSyncing(false);
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
      setIsInitialSyncing(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isSyncing, isInitialSyncing, signOut }}>
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
