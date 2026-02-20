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
        className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-4 py-2 hover:bg-gold-bright transition-colors focus:outline-none"
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
