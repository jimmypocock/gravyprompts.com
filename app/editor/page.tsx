'use client';

import { AuthGuard } from '@/components/AuthGuard';
import EditorContent from './EditorContent';

export default function EditorPage() {
  return (
    <AuthGuard requireAuth={true}>
      <EditorContent />
    </AuthGuard>
  );
}