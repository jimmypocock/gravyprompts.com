import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Dashboard - GravyPrompts',
  description: 'Manage templates and permissions',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Manage templates and user permissions</p>
        </div>
        {children}
      </div>
    </div>
  );
}