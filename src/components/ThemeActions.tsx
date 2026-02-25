'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDeleteBar from '@/components/ConfirmDeleteBar';

export default function ThemeActions({
  themeId,
  initialName,
}: {
  themeId: string;
  initialName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleRename() {
    setSaving(true);
    setSaveError(null);
    const res = await fetch(`/api/themes/${themeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setSaveError(body.error ?? 'Failed to rename theme');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/themes/${themeId}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setDeleteError('Failed to delete theme');
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="bg-void border border-seam px-3 py-1.5 text-sm text-parchment focus:border-gold focus:outline-none transition-colors"
          />
          <button
            onClick={handleRename}
            disabled={saving || !name.trim()}
            className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-3 py-1.5 hover:bg-gold-bright transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => { setName(initialName); setEditing(false); setSaveError(null); }}
            className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors px-2 py-1.5"
          >
            Cancel
          </button>
        </div>
        {saveError && <span className="font-mono text-xs text-red-400">{saveError}</span>}
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <ConfirmDeleteBar
        message="Delete theme? Collections become uncategorized."
        onConfirm={handleDelete}
        onCancel={() => { setConfirmDelete(false); setDeleteError(null); }}
        loading={deleting}
        error={deleteError}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setEditing(true)}
        className="border border-seam font-mono text-xs tracking-widest text-mist uppercase px-3 py-1.5 hover:border-gold/40 hover:text-parchment transition-colors"
      >
        Rename
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
