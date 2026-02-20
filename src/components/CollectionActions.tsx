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
  const [regenerating, setRegenerating] = useState(false);

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
    const res = await fetch(`/api/collections/${collectionId}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    await fetch(`/api/collections/${collectionId}/regenerate`, { method: 'POST' });
    setRegenerating(false);
    router.refresh();
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          className="bg-void border border-seam px-3 py-1.5 text-sm text-parchment focus:border-gold focus:outline-none transition-colors"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'topic' | 'project')}
          className="bg-void border border-seam px-2 py-1.5 text-sm text-parchment focus:border-gold focus:outline-none transition-colors"
        >
          <option value="topic">Topic</option>
          <option value="project">Project</option>
        </select>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-3 py-1.5 hover:bg-gold-bright transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => { setName(initialName); setType(initialType); setEditing(false); }}
          className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-red-400">Delete? Items will become uncategorized.</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="border border-red-700 bg-red-900/50 font-mono text-xs tracking-widest text-red-300 uppercase px-3 py-1.5 hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={() => setConfirmDelete(false)}
          className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRegenerate}
        disabled={regenerating}
        className="border border-seam font-mono text-xs tracking-widest text-mist uppercase px-3 py-1.5 hover:border-gold/40 hover:text-parchment transition-colors disabled:opacity-50"
      >
        {regenerating ? 'Regenerating...' : 'Regenerate'}
      </button>
      <button
        onClick={() => setEditing(true)}
        className="border border-seam font-mono text-xs tracking-widest text-mist uppercase px-3 py-1.5 hover:border-gold/40 hover:text-parchment transition-colors"
      >
        Edit
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        className="border border-red-900/50 font-mono text-xs tracking-widest text-red-400 uppercase px-3 py-1.5 hover:border-red-700 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}
