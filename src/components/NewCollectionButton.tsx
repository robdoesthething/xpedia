'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NewCollectionModal from '@/components/NewCollectionModal';

export default function NewCollectionButton() {
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  function handleCreated(id: string) {
    setShowModal(false);
    router.push(`/dashboard/collection/${id}`);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        + New Collection
      </button>

      {showModal && (
        <NewCollectionModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
