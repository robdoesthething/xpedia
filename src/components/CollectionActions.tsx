'use client';

import { useReducer, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDeleteBar from '@/components/ConfirmDeleteBar';

type Mode = 'idle' | 'editing' | 'confirming-delete';

interface State {
  mode: Mode;
  name: string;
  type: 'topic' | 'project';
  themeId: string | null;
  themes: { id: string; name: string }[];
  saving: boolean;
  deleting: boolean;
  regenerating: boolean;
}

type Action =
  | { type: 'START_EDIT' }
  | { type: 'CANCEL_EDIT'; initialName: string; initialType: 'topic' | 'project'; initialThemeId: string | null }
  | { type: 'SET_NAME'; name: string }
  | { type: 'SET_TYPE'; collectionType: 'topic' | 'project' }
  | { type: 'SET_THEME_ID'; themeId: string | null }
  | { type: 'SET_THEMES'; themes: { id: string; name: string }[] }
  | { type: 'SAVING'; value: boolean }
  | { type: 'SAVE_DONE' }
  | { type: 'START_CONFIRM_DELETE' }
  | { type: 'CANCEL_DELETE' }
  | { type: 'DELETING'; value: boolean }
  | { type: 'REGENERATING'; value: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_EDIT':
      return { ...state, mode: 'editing' };
    case 'CANCEL_EDIT':
      return { ...state, mode: 'idle', name: action.initialName, type: action.initialType, themeId: action.initialThemeId };
    case 'SET_NAME':
      return { ...state, name: action.name };
    case 'SET_TYPE':
      return { ...state, type: action.collectionType };
    case 'SET_THEME_ID':
      return { ...state, themeId: action.themeId };
    case 'SET_THEMES':
      return { ...state, themes: action.themes };
    case 'SAVING':
      return { ...state, saving: action.value };
    case 'SAVE_DONE':
      return { ...state, mode: 'idle', saving: false };
    case 'START_CONFIRM_DELETE':
      return { ...state, mode: 'confirming-delete' };
    case 'CANCEL_DELETE':
      return { ...state, mode: 'idle' };
    case 'DELETING':
      return { ...state, deleting: action.value };
    case 'REGENERATING':
      return { ...state, regenerating: action.value };
    default:
      return state;
  }
}

export default function CollectionActions({
  collectionId,
  initialName,
  initialType,
  initialThemeId,
}: {
  collectionId: string;
  initialName: string;
  initialType: 'topic' | 'project';
  initialThemeId: string | null;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, {
    mode: 'idle',
    name: initialName,
    type: initialType,
    themeId: initialThemeId,
    themes: [],
    saving: false,
    deleting: false,
    regenerating: false,
  });

  useEffect(() => {
    if (state.mode !== 'editing') return;
    fetch('/api/themes')
      .then((r) => r.json())
      .then((data) => dispatch({ type: 'SET_THEMES', themes: data.themes ?? [] }))
      .catch(() => {});
  }, [state.mode]);

  async function handleSave() {
    dispatch({ type: 'SAVING', value: true });
    const res = await fetch(`/api/collections/${collectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: state.name.trim(), type: state.type, theme_id: state.themeId }),
    });
    dispatch({ type: 'SAVING', value: false });
    if (res.ok) {
      dispatch({ type: 'SAVE_DONE' });
      router.refresh();
    }
  }

  async function handleDelete() {
    dispatch({ type: 'DELETING', value: true });
    const res = await fetch(`/api/collections/${collectionId}`, { method: 'DELETE' });
    dispatch({ type: 'DELETING', value: false });
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    }
  }

  async function handleRegenerate() {
    dispatch({ type: 'REGENERATING', value: true });
    await fetch(`/api/collections/${collectionId}/regenerate`, { method: 'POST' });
    dispatch({ type: 'REGENERATING', value: false });
    router.refresh();
  }

  if (state.mode === 'editing') {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={state.name}
          onChange={(e) => dispatch({ type: 'SET_NAME', name: e.target.value })}
          maxLength={100}
          className="bg-void border border-seam px-3 py-1.5 text-sm text-parchment focus:border-gold focus:outline-none transition-colors"
        />
        <select
          value={state.type}
          onChange={(e) => dispatch({ type: 'SET_TYPE', collectionType: e.target.value as 'topic' | 'project' })}
          className="bg-void border border-seam px-2 py-1.5 text-sm text-parchment focus:border-gold focus:outline-none transition-colors"
        >
          <option value="topic">Topic</option>
          <option value="project">Project</option>
        </select>
        <select
          value={state.themeId ?? ''}
          onChange={(e) => dispatch({ type: 'SET_THEME_ID', themeId: e.target.value || null })}
          className="bg-void border border-seam px-2 py-1.5 text-sm text-parchment focus:border-gold focus:outline-none transition-colors"
        >
          <option value="">No theme</option>
          {state.themes.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={state.saving || !state.name.trim()}
          className="bg-gold text-void font-mono text-xs tracking-widest uppercase px-3 py-1.5 hover:bg-gold-bright transition-colors disabled:opacity-50"
        >
          {state.saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={() => dispatch({ type: 'CANCEL_EDIT', initialName, initialType, initialThemeId })}
          className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (state.mode === 'confirming-delete') {
    return (
      <ConfirmDeleteBar
        message="Delete? Items will become uncategorized."
        onConfirm={handleDelete}
        onCancel={() => dispatch({ type: 'CANCEL_DELETE' })}
        loading={state.deleting}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRegenerate}
        disabled={state.regenerating}
        className="border border-seam font-mono text-xs tracking-widest text-mist uppercase px-3 py-1.5 hover:border-gold/40 hover:text-parchment transition-colors disabled:opacity-50"
      >
        {state.regenerating ? 'Regenerating...' : 'Regenerate'}
      </button>
      <button
        onClick={() => dispatch({ type: 'START_EDIT' })}
        className="border border-seam font-mono text-xs tracking-widest text-mist uppercase px-3 py-1.5 hover:border-gold/40 hover:text-parchment transition-colors"
      >
        Edit
      </button>
      <button
        onClick={() => dispatch({ type: 'START_CONFIRM_DELETE' })}
        className="border border-red-900/50 font-mono text-xs tracking-widest text-red-400 uppercase px-3 py-1.5 hover:border-red-700 transition-colors"
      >
        Delete
      </button>
    </div>
  );
}
