export default function CollectionDetailLoading() {
  return (
    <div>
      <div className="mb-6 h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-5 w-14 animate-pulse rounded-full bg-gray-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 h-4 w-20 animate-pulse rounded bg-gray-200" />
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
        </div>
      </div>
      <hr className="my-6 border-gray-200" />
      <div className="mb-4 h-6 w-24 animate-pulse rounded bg-gray-200" />
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 space-y-2">
              <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
