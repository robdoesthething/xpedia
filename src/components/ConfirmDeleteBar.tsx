'use client';

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  error?: string | null;
}

export default function ConfirmDeleteBar({ message, onConfirm, onCancel, loading, error }: Props) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-red-400">{message}</span>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="border border-red-700 bg-red-900/50 font-mono text-xs tracking-widest text-red-300 uppercase px-3 py-1.5 hover:bg-red-900 transition-colors disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={onCancel}
          className="font-mono text-xs tracking-widest text-shadow uppercase hover:text-mist transition-colors px-2 py-1.5"
        >
          Cancel
        </button>
      </div>
      {error && <span className="font-mono text-xs text-red-400">{error}</span>}
    </div>
  );
}
