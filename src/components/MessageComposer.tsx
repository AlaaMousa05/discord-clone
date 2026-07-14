import { useState, type FormEvent } from 'react'
import { useTypingHeartbeat } from '../hooks/useTypingHeartbeat'

type Scope = { scopeType: 'channel' | 'dmThread'; scopeId: string }

interface MessageComposerProps {
  placeholder: string
  typingScope: Scope
  onSend: (content: string) => Promise<unknown>
}

export default function MessageComposer({ placeholder, typingScope, onSend }: MessageComposerProps) {
  const [content, setContent] = useState('')
  const notifyTyping = useTypingHeartbeat(typingScope)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = content.trim()
    if (trimmed === '') return
    setContent('')
    await onSend(trimmed)
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="p-4">
      <input
        value={content}
        onChange={(event) => {
          setContent(event.target.value)
          notifyTyping()
        }}
        placeholder={placeholder}
        className="w-full rounded-lg bg-surface-raised px-4 py-2.5 text-text-primary outline-none placeholder:text-text-faint focus:ring-2 focus:ring-accent"
      />
    </form>
  )
}
