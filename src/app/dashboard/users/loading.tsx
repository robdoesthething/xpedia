export default function UsersLoading() {
  return (
    <div>
      <div className="mb-6 h-7 w-36 animate-pulse rounded bg-gray-200" />
      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <div className="mb-3 h-4 w-28 animate-pulse rounded bg-gray-200" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
