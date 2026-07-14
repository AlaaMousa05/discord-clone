import { useState, type FormEvent } from 'react'

interface MessageItemProps {
  authorDisplayName: string
  authorAvatarUrl?: string
  content: string
  createdAt: number
  editedAt?: number
  isOwn: boolean
  onEdit: (content: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
}

export default function MessageItem({
  authorDisplayName,
  authorAvatarUrl,
  content,
  createdAt,
  editedAt,
  isOwn,
  onEdit,
  onDelete,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(content)

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (trimmed === '') return
    await onEdit(trimmed)
    setIsEditing(false)
  }

  return (
    <div className="group flex gap-3 rounded px-2 py-1 transition-colors hover:bg-surface-raised/40">
      <div className="mt-0.5 h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-surface-raised">
        {authorAvatarUrl ? (
          <img src={authorAvatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-text-muted">
            {authorDisplayName.slice(0, 1).toUpperCase()}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-text-primary">{authorDisplayName}</span>
          <span className="text-xs text-text-faint">
            {new Date(createdAt).toLocaleString()}
            {editedAt !== undefined && ' (edited)'}
          </span>
        </div>

        {isEditing ? (
          <form onSubmit={(event) => void handleEditSubmit(event)} className="flex gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-w-0 flex-1 rounded bg-surface-deep px-2 py-1 text-text-primary outline-none focus:ring-2 focus:ring-accent"
            />
            <button type="submit" className="text-xs text-accent transition-colors hover:underline">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(content)
                setIsEditing(false)
              }}
              className="text-xs text-text-muted transition-colors hover:underline"
            >
              Cancel
            </button>
          </form>
        ) : (
          <p className="whitespace-pre-wrap break-words text-text-primary">{content}</p>
        )}
      </div>

      {isOwn && !isEditing && (
        <div className="hidden flex-shrink-0 gap-2 text-xs text-text-muted group-hover:flex">
          <button
            onClick={() => setIsEditing(true)}
            className="transition-colors hover:text-text-primary"
          >
            Edit
          </button>
          <button onClick={() => void onDelete()} className="transition-colors hover:text-danger">
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
