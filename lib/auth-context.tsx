'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Amplify } from 'aws-amplify';
import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  signOut as amplifySignOut,
  confirmSignUp,
  getCurrentUser,
  fetchUserAttributes,
  updateUserAttributes,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword,
  fetchAuthSession,
  type SignInInput,
  type SignUpInput,
} from 'aws-amplify/auth';

// Configure Amplify - Single Cognito pool for all environments
const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;

if (userPoolId && clientId) {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId,
        userPoolClientId: clientId,
      },
    },
  });
}

export interface UserProfile {
  email: string;
  emailVerified: boolean;
  fullname?: string;
  bio?: string;
  github?: string;
  twitter?: string;
  linkedin?: string;
}

export interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, fullname?: string) => Promise<{ isSignUpComplete: boolean; userId: string | undefined; nextStep: { signUpStep: string } }>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  resendConfirmationCode: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  confirmForgotPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  getIdToken: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for auth session to prevent excessive refreshes
  const sessionCacheRef = useRef<{
    session: { tokens?: { idToken?: { toString: () => string } } };
    timestamp: number;
  } | null>(null);

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []); // Empty dependency array - only run once on mount

  // Expose auth functions to window for debugging (only in development)
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as Window & { getAuthDebugInfo?: () => Promise<unknown> }).getAuthDebugInfo = async () => {
        try {
          const session = await fetchAuthSession();
          // Get token directly from session instead of using getIdToken
          const idToken = session.tokens?.idToken?.toString();
          return {
            user,
            session,
            token: idToken,
            hasToken: !!idToken,
            tokenPreview: idToken ? `${idToken.substring(0, 50)}...` : 'No token',
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      };
    }
  }, [user]); // Only depend on user

  const loadUser = async () => {
    try {
      setLoading(true);
      // Clear session cache when loading user to ensure fresh data
      sessionCacheRef.current = null;
      
      const currentUser = await getCurrentUser();
      if (currentUser) {
        const attributes = await fetchUserAttributes();
        setUser({
          email: attributes.email || '',
          emailVerified: attributes.email_verified === 'true',
          fullname: attributes.name,
          bio: attributes['custom:bio'],
          github: attributes['custom:github'],
          twitter: attributes['custom:twitter'],
          linkedin: attributes['custom:linkedin'],
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      // UserUnAuthenticatedException is expected when user is not logged in
      if ((error as Error)?.name !== 'UserUnAuthenticatedException') {
        console.error('Error loading user:', error);
      }
      // User is not authenticated
      setUser(null);
      // Clear session cache on auth failure
      sessionCacheRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullname?: string) => {
    try {
      setError(null);
      const signUpData: SignUpInput = {
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            ...(fullname && { name: fullname }),
          },
        },
      };
      const result = await amplifySignUp(signUpData);
      return {
        isSignUpComplete: result.isSignUpComplete,
        userId: result.userId || undefined,
        nextStep: {
          signUpStep: result.nextStep.signUpStep,
        },
      };
    } catch (err) {
      setError((err as Error).message || 'Failed to sign up');
      throw err;
    }
  };

  const signIn = async (email: string, password: string) => {
    const signInData: SignInInput = {
      username: email,
      password,
    };
    
    try {
      setError(null);
      await amplifySignIn(signInData);
      // Force reload user data
      await loadUser();
    } catch (err) {
      const errorMessage = (err as Error).message || '';
      
      // Handle "already signed in" error
      if (errorMessage.includes('already a signed in user')) {
        try {
          // Sign out the existing user first
          await amplifySignOut();
          // Clear the session cache
          sessionCacheRef.current = null;
          // Try signing in again
          await amplifySignIn(signInData);
          // Load the new user
          await loadUser();
          return; // Success!
        } catch (retryErr) {
          setError((retryErr as Error).message || 'Failed to sign in after clearing session');
          throw retryErr;
        }
      }
      
      setError(errorMessage || 'Failed to sign in');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await amplifySignOut();
      setUser(null);
      // Clear session cache on sign out
      sessionCacheRef.current = null;
    } catch (err) {
      setError((err as Error).message || 'Failed to sign out');
      throw err;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      setError(null);
      const attributeUpdates: Record<string, string> = {};
      
      if (updates.fullname !== undefined) attributeUpdates.name = updates.fullname;
      if (updates.bio !== undefined) attributeUpdates['custom:bio'] = updates.bio;
      if (updates.github !== undefined) attributeUpdates['custom:github'] = updates.github;
      if (updates.twitter !== undefined) attributeUpdates['custom:twitter'] = updates.twitter;
      if (updates.linkedin !== undefined) attributeUpdates['custom:linkedin'] = updates.linkedin;

      await updateUserAttributes({
        userAttributes: attributeUpdates,
      });

      // Reload user to get updated attributes
      await loadUser();
    } catch (err) {
      setError((err as Error).message || 'Failed to update profile');
      throw err;
    }
  };

  const resendConfirmationCode = async (email: string) => {
    try {
      setError(null);
      await resendSignUpCode({ username: email });
    } catch (err) {
      setError((err as Error).message || 'Failed to resend confirmation code');
      throw err;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      setError(null);
      await resetPassword({ username: email });
    } catch (err) {
      setError((err as Error).message || 'Failed to initiate password reset');
      throw err;
    }
  };

  const confirmForgotPassword = async (email: string, code: string, newPassword: string) => {
    try {
      setError(null);
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword,
      });
    } catch (err) {
      setError((err as Error).message || 'Failed to reset password');
      throw err;
    }
  };

  const getIdToken = async (): Promise<string> => {
    try {
      // Check if we have a cached session that's less than 5 minutes old
      const now = Date.now();
      if (sessionCacheRef.current && (now - sessionCacheRef.current.timestamp) < 5 * 60 * 1000) {
        const cachedToken = sessionCacheRef.current.session.tokens?.idToken?.toString();
        if (cachedToken) {
          return cachedToken;
        }
      }

      // Fetch new session and cache it
      const session = await fetchAuthSession();
      sessionCacheRef.current = {
        session,
        timestamp: now,
      };

      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) {
        throw new Error('No ID token available');
      }
      return idToken;
    } catch {
      // Clear cache on error
      sessionCacheRef.current = null;
      throw new Error('Failed to get authentication token');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    signUp,
    confirmSignUp: async (email: string, code: string) => {
      try {
        setError(null);
        await confirmSignUp({ username: email, confirmationCode: code });
      } catch (err) {
        setError((err as Error).message || 'Failed to confirm sign up');
        throw err;
      }
    },
    signIn,
    signOut,
    updateProfile,
    resendConfirmationCode,
    forgotPassword,
    confirmForgotPassword,
    refreshUser: loadUser,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};