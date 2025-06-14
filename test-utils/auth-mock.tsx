import React from 'react';
import { AuthContext } from '@/lib/auth-context';

export interface MockAuthContextValue {
  user: any;
  loading: boolean;
  signIn?: jest.Mock;
  signOut?: jest.Mock;
  refreshToken?: jest.Mock;
}

export const createMockAuthContext = (value: Partial<MockAuthContextValue> = {}) => {
  const defaultValue: MockAuthContextValue = {
    user: null,
    loading: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
    refreshToken: jest.fn(),
    ...value,
  };

  return defaultValue;
};

export const MockAuthProvider: React.FC<{
  children: React.ReactNode;
  value?: Partial<MockAuthContextValue>;
}> = ({ children, value = {} }) => {
  const contextValue = createMockAuthContext(value);
  
  return (
    <AuthContext.Provider value={contextValue as any}>
      {children}
    </AuthContext.Provider>
  );
};