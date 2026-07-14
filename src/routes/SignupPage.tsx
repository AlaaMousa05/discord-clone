import { useState, type FormEvent } from 'react'
import { useAuthActions } from '@convex-dev/auth/react'
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom'

export default function SignupPage() {
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    formData.set('flow', 'signUp')
    try {
      await signIn('password', formData)
      const from = (location.state as { from?: Location } | null)?.from
      navigate(from ? `${from.pathname}${from.search}` : '/', { replace: true })
    } catch {
      setError('Could not create your account. Check your details and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-surface-deep px-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-surface p-8 shadow-2xl"
      >
        <h1 className="text-xl font-semibold text-text-primary">Create an account</h1>

        <label className="block text-xs font-semibold uppercase text-text-muted">
          Display name
          <input
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded bg-surface-deep px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="block text-xs font-semibold uppercase text-text-muted">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded bg-surface-deep px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        <label className="block text-xs font-semibold uppercase text-text-muted">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded bg-surface-deep px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-accent"
          />
        </label>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-accent py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>

        <p className="text-sm text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent transition-colors hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  )
}
