export default function Loading() {
  return (
    <div className="min-h-screen bg-white pt-20">
      <div className="sticky top-16 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="h-10 bg-gray-200 rounded-full animate-pulse" />
          <div className="flex gap-2 mt-4">
            <div className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200"
            >
              <div className="aspect-[4/3] bg-gray-200 animate-pulse" />
              <div className="p-4">
                <div className="h-6 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
