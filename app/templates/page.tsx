import { Suspense } from 'react';
import TemplatesContent from './TemplatesContent';
import Loading from './loading';

export default function TemplatesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <TemplatesContent />
    </Suspense>
  );
}