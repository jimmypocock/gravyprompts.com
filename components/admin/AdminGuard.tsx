'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAdminAccess } from '@/lib/api/admin';
import { useAuth } from '@/lib/auth-context';

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    async function checkAccess() {
      if (authLoading) return;
      
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const access = await checkAdminAccess();
        setHasAccess(access);
        if (!access) {
          router.push('/');
        }
      } catch (error) {
        console.error('Error checking admin access:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, [user, authLoading, router]);

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div data-testid="loading-spinner" className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return <>{children}</>;
}