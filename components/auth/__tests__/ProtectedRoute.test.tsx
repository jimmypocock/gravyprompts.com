import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ProtectedRoute } from '../ProtectedRoute';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: jest.fn(),
}));

describe('ProtectedRoute', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
  };

  const mockChild = <div data-testid="protected-content">Protected Content</div>;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('when user is authenticated', () => {
    it('should render children when user is authenticated', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '123', email: 'user@example.com' },
        loading: false,
      });

      render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should render multiple children', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '123', email: 'user@example.com' },
        loading: false,
      });

      render(
        <ProtectedRoute>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </ProtectedRoute>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });
  });

  describe('when user is not authenticated', () => {
    it('should redirect to login by default', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });

      render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      expect(mockPush).toHaveBeenCalledWith('/login');
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should redirect to custom path when specified', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });

      render(
        <ProtectedRoute redirectTo="/auth/signin">
          {mockChild}
        </ProtectedRoute>
      );

      expect(mockPush).toHaveBeenCalledWith('/auth/signin');
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should return null while redirecting', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });

      const { container } = render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when auth is loading', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: true,
      });

      render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      // Check for loading container
      const loadingDiv = document.querySelector('.min-h-screen');
      expect(loadingDiv).toBeInTheDocument();
      expect(loadingDiv).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');

      // Should not redirect while loading
      expect(mockPush).not.toHaveBeenCalled();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should show animated loading indicator', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: true,
      });

      render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      const animatedElement = document.querySelector('.animate-pulse');
      expect(animatedElement).toBeInTheDocument();

      const bounceElement = document.querySelector('.animate-bounce');
      expect(bounceElement).toBeInTheDocument();
      expect(bounceElement).toHaveClass('h-12', 'w-12', 'bg-primary', 'rounded-full');
    });
  });

  describe('auth state transitions', () => {
    it('should handle transition from loading to authenticated', async () => {
      const { rerender } = render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      // Start with loading
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: true,
      });
      rerender(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();

      // Transition to authenticated
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '123', email: 'user@example.com' },
        loading: false,
      });
      rerender(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle transition from loading to unauthenticated', async () => {
      const { rerender } = render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      // Start with loading
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: true,
      });
      rerender(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      expect(mockPush).not.toHaveBeenCalled();

      // Transition to unauthenticated
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });
      rerender(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
    });

    it('should handle transition from authenticated to unauthenticated', async () => {
      const { rerender } = render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      // Start authenticated
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '123', email: 'user@example.com' },
        loading: false,
      });
      rerender(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();

      // User logs out
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });
      rerender(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined user object', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: undefined,
        loading: false,
      });

      render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      expect(mockPush).toHaveBeenCalledWith('/login');
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('should not redirect multiple times', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });

      const { rerender } = render(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      expect(mockPush).toHaveBeenCalledTimes(1);

      // Rerender multiple times
      rerender(<ProtectedRoute>{mockChild}</ProtectedRoute>);
      rerender(<ProtectedRoute>{mockChild}</ProtectedRoute>);

      // Should still only redirect once
      expect(mockPush).toHaveBeenCalledTimes(1);
    });

    it('should handle empty children gracefully', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { id: '123', email: 'user@example.com' },
        loading: false,
      });

      const { container } = render(<ProtectedRoute>{null}</ProtectedRoute>);

      expect(container.innerHTML).toBe('');
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should handle auth context errors gracefully', () => {
      (useAuth as jest.Mock).mockImplementation(() => {
        throw new Error('Auth context error');
      });

      // Should not crash the app
      expect(() => {
        render(<ProtectedRoute>{mockChild}</ProtectedRoute>);
      }).toThrow('Auth context error');
    });
  });

  describe('redirectTo prop', () => {
    it('should use custom redirect path', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });

      render(
        <ProtectedRoute redirectTo="/custom/login">
          {mockChild}
        </ProtectedRoute>
      );

      expect(mockPush).toHaveBeenCalledWith('/custom/login');
    });

    it('should handle empty redirect path', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        loading: false,
      });

      render(
        <ProtectedRoute redirectTo="">
          {mockChild}
        </ProtectedRoute>
      );

      expect(mockPush).toHaveBeenCalledWith('');
    });
  });
});