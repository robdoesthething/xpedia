export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-6 h-7 w-48 animate-pulse rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-5 w-12 animate-pulse rounded-full bg-gray-100" />
            </div>
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-gray-100" />
            <div className="mt-4 flex justify-between">
              <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
