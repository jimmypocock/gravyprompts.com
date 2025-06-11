'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
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

// Configure Amplify
const isProduction = process.env.NODE_ENV === 'production';
const userPoolId = isProduction
  ? process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID_PROD
  : process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID_DEV;
const clientId = isProduction
  ? process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID_PROD
  : process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID_DEV;

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

interface AuthContextType {
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user on mount
  useEffect(() => {
    loadUser();
    
    // Expose auth functions to window for debugging (only in development)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      (window as Window & { getAuthDebugInfo?: () => Promise<unknown> }).getAuthDebugInfo = async () => {
        try {
          const session = await fetchAuthSession();
          const token = await getIdToken();
          return {
            user,
            session,
            token,
            hasToken: !!token,
            tokenPreview: token ? `${token.substring(0, 50)}...` : 'No token',
          };
        } catch (error) {
          return { error: error instanceof Error ? error.message : String(error) };
        }
      };
    }
  }, [user]);

  const loadUser = async () => {
    try {
      setLoading(true);
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
      }
    } catch {
      // User is not authenticated
      setUser(null);
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
    try {
      setError(null);
      const signInData: SignInInput = {
        username: email,
        password,
      };
      await amplifySignIn(signInData);
      await loadUser();
    } catch (err) {
      setError((err as Error).message || 'Failed to sign in');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      setError(null);
      await amplifySignOut();
      setUser(null);
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
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) {
        throw new Error('No ID token available');
      }
      return idToken;
    } catch {
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