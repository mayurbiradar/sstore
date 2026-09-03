interface CartToolbarProps {
  totalCount: number
  selectedCount: number
  onToggleAll: () => void
  onRemoveSelected: () => void
}

/**
 * Sticky toolbar above the item list — "Select all" + bulk remove.
 */
export default function CartToolbar({
  totalCount,
  selectedCount,
  onToggleAll,
  onRemoveSelected,
}: CartToolbarProps) {
  const allSelected = totalCount > 0 && selectedCount === totalCount
  return (
    <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <label className="flex items-center gap-3 font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={onToggleAll}
          className="h-4 w-4 accent-rose-600"
        />
        Select all
      </label>
      <button
        type="button"
        onClick={onRemoveSelected}
        disabled={!selectedCount}
        className="font-semibold text-slate-400 hover:text-rose-600 disabled:cursor-not-allowed"
      >
        Remove selected
      </button>
    </div>
  )
}
