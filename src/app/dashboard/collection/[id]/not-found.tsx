import Link from 'next/link';

export default function CollectionNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h2 className="text-xl font-semibold text-gray-900">Collection not found</h2>
      <p className="mt-2 max-w-md text-sm text-gray-500">
        This collection doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        &larr; Back to Collections
      </Link>
    </div>
  );
}
