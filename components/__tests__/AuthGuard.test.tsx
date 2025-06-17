import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { AuthGuard } from '../AuthGuard';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn(),
  signOut: jest.fn(),
}));

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('AuthGuard', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
  };

  const mockChild = <div data-testid="protected-content">Protected Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  describe('when authentication is required (default)', () => {
    it('should show loading state initially', () => {
      (fetchAuthSession as jest.Mock).mockImplementation(() => new Promise(() => {}));
      
      render(<AuthGuard>{mockChild}</AuthGuard>);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should render children when user is authenticated with valid token', async () => {
      const mockIdToken = 'header.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.signature';
      
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: mockIdToken,
        },
      });

      render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should redirect to login when user is not authenticated', async () => {
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: null,
      });

      render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should redirect to login when session fetch fails', async () => {
      (fetchAuthSession as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should sign out and redirect when token is expired', async () => {
      const expiredToken = 'header.' + btoa(JSON.stringify({ exp: Date.now() / 1000 - 3600 })) + '.signature';
      
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: expiredToken,
        },
      });
      (signOut as jest.Mock).mockResolvedValue(undefined);

      render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(signOut).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/login');
      });

      expect(consoleLogSpy).toHaveBeenCalledWith('Token expired, signing out...');
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should handle malformed tokens gracefully', async () => {
      const malformedToken = 'invalid-token-format';
      
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: malformedToken,
        },
      });

      render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });

      // Error will be logged but we don't need to verify it
    });
  });

  describe('when authentication is not required', () => {
    it('should render children even when not authenticated', async () => {
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: null,
      });

      render(<AuthGuard requireAuth={false}>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should render children when authenticated', async () => {
      const mockIdToken = 'header.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.signature';
      
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: mockIdToken,
        },
      });

      render(<AuthGuard requireAuth={false}>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });

    it('should not redirect on auth errors when not required', async () => {
      (fetchAuthSession as jest.Mock).mockRejectedValue(new Error('Auth error'));

      render(<AuthGuard requireAuth={false}>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle session with missing idToken property', async () => {
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          accessToken: 'access-token',
          // idToken is missing
        },
      });

      render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should handle token expiring exactly at current time', async () => {
      const currentTimeInSeconds = Date.now() / 1000;
      const tokenAtExpiry = 'header.' + btoa(JSON.stringify({ exp: currentTimeInSeconds })) + '.signature';
      
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: tokenAtExpiry,
        },
      });
      (signOut as jest.Mock).mockResolvedValue(undefined);

      render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(signOut).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should only check auth once on mount', async () => {
      const mockIdToken = 'header.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.signature';
      
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: mockIdToken,
        },
      });

      const { rerender } = render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });

      // Rerender with different children
      const newChild = <div data-testid="new-content">New Content</div>;
      rerender(<AuthGuard>{newChild}</AuthGuard>);

      // Should not call fetchAuthSession again
      expect(fetchAuthSession).toHaveBeenCalledTimes(1);
    });

    it('should handle signOut failures gracefully', async () => {
      const expiredToken = 'header.' + btoa(JSON.stringify({ exp: Date.now() / 1000 - 3600 })) + '.signature';
      
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: expiredToken,
        },
      });
      (signOut as jest.Mock).mockRejectedValue(new Error('SignOut failed'));

      render(<AuthGuard>{mockChild}</AuthGuard>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });

      // Error will be logged but we don't need to verify it
    });
  });

  describe('loading state', () => {
    it('should have proper loading UI structure', () => {
      (fetchAuthSession as jest.Mock).mockImplementation(() => new Promise(() => {}));
      
      render(<AuthGuard>{mockChild}</AuthGuard>);
      
      const loadingContainer = screen.getByText('Loading...').parentElement;
      expect(loadingContainer).toHaveClass('flex', 'items-center', 'justify-center', 'min-h-screen');
      
      const loadingText = screen.getByText('Loading...');
      expect(loadingText).toHaveClass('text-gray-500');
    });
  });

  describe('multiple children', () => {
    it('should render multiple children when authenticated', async () => {
      const mockIdToken = 'header.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.signature';
      
      (fetchAuthSession as jest.Mock).mockResolvedValue({
        tokens: {
          idToken: mockIdToken,
        },
      });

      render(
        <AuthGuard>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </AuthGuard>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child-1')).toBeInTheDocument();
        expect(screen.getByTestId('child-2')).toBeInTheDocument();
        expect(screen.getByTestId('child-3')).toBeInTheDocument();
      });
    });
  });
});