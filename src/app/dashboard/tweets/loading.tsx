export default function TweetsLoading() {
  return (
    <div>
      <div className="mb-6 h-7 w-40 animate-pulse rounded bg-gray-200" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="mt-2 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
