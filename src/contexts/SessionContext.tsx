import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';

import type { InterviewScript } from '@/types/interviewScript';

export interface SessionContextData {
  sessionId: string;
  requester: string | null;
  prompt: string | null;
  company: string | null;
  product: string | null;
  feedbackDesired: string | null;
  desiredIcp: string | null;
  desiredIcpIndustry: string | null;
  desiredIcpRegion: string | null;
  keyQuestions: string | null;
  surveyQuestions: string[] | string | InterviewScript | null;
  updatedAt: string | null;
}

interface SessionContextType {
  sessionData: SessionContextData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<SessionContextData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessionContext = async (sessionId: string, pin: string) => {
    if (!sessionId || !pin) {
      setError('Session ID and PIN are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Try to get from sessionStorage first as fallback
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(`session_context_${sessionId}`);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            setSessionData(parsed);
            setIsLoading(false);
          } catch (e) {
            console.warn('Failed to parse cached session context', e);
          }
        }
      }

      const response = await fetch(`/api/sessions/context?sessionId=${encodeURIComponent(sessionId)}&pin=${encodeURIComponent(pin)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setSessionData(data);

      // Cache in sessionStorage as fallback
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`session_context_${sessionId}`, JSON.stringify(data));
        } catch (e) {
          console.warn('Failed to cache session context', e);
        }
      }
    } catch (err) {
      console.error('Failed to fetch session context', err);
      setError(err instanceof Error ? err.message : 'Failed to load session data');
    } finally {
      setIsLoading(false);
    }
  };

  const refetch = async () => {
    const sessionId = router.query.sid as string;
    const pin = router.query.pin as string;
    
    if (sessionId && pin) {
      await fetchSessionContext(sessionId, pin);
    }
  };

  useEffect(() => {
    if (!router.isReady) return;

    const sessionId = router.query.sid as string;
    const pin = router.query.pin as string;

    if (sessionId && pin) {
      fetchSessionContext(sessionId, pin);
    }
  }, [router.isReady, router.query.sid, router.query.pin]);

  const value: SessionContextType = {
    sessionData,
    isLoading,
    error,
    refetch
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}
