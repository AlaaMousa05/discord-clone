import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  maxWidth?: 'sm' | 'md'
}

/**
 * Shared overlay/panel shell for all dialogs, so Escape-to-close and
 * click-outside-to-close (and the overlay/panel look itself) stay in sync
 * across CreateServerModal, ServerSettingsPanel, InviteButton, etc. instead
 * of each re-implementing its own fixed/backdrop markup.
 */
export default function Modal({ title, onClose, children, maxWidth = 'sm' }: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full space-y-4 rounded-xl border border-border bg-surface p-6 shadow-2xl ${
          maxWidth === 'md' ? 'max-w-md' : 'max-w-sm'
        }`}
      >
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {children}
      </div>
    </div>
  )
}
