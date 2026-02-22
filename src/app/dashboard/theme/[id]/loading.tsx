export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-48 bg-seam rounded" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-seam rounded" />)}
      </div>
    </div>
  );
}
