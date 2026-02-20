'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CollectionActions({
  collectionId,
  initialName,
  initialType,
}: {
  collectionId: string;
  initialName: string;
  initialType: 'topic' | 'project';
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<'topic' | 'project'>(initialType);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/collections/${collectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), type }),
    });
    setSaving(false);

    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/collections/${collectionId}`, {
      method: 'DELETE',
    });
    setDeleting(false);

    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'topic' | 'project')}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="topic">Topic</option>
          <option value="project">Project</option>
        </select>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => {
            setName(initialName);
            setType(initialType);
            setEditing(false);
          }}
          className="rounded-md px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600">Delete this collection? Tweets will become uncategorized.</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="rounded-md px-3 py-1 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditing(true)}
        className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
      >
        Edit
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="rounded-md border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
      >
        Delete
      </button>
    </div>
  );
}
