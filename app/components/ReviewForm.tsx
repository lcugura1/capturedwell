import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { REVIEW_LIMITS, TURNSTILE_SITE_KEY } from '~/lib/site'

/** The slice of Turnstile's global API this form uses. */
type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (id: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/**
 * Turnstile's script, loaded once and only when somebody opens the form.
 *
 * Not in the page head: nearly every visitor comes for the photographs, and
 * none of them should pay for a third-party script, or be seen by one, to
 * fill in a form they never open.
 */
let loading: Promise<Turnstile> | null = null
function loadTurnstile(): Promise<Turnstile> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = TURNSTILE_SRC
    script.async = true
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'))
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('turnstile'))
    }
    document.head.append(script)
  })
  return loading
}

/**
 * One field as a ruled row, the way the contact details are set: a hairline
 * above, a small label, then the value. The form reads as more of the same
 * page rather than a panel of boxes dropped into it.
 *
 * The row is what shows focus — the rule turns to full ink — because the
 * input itself has no box for a ring to sit around.
 */
function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-xs border-t border-line-strong pt-sm transition-colors duration-150 ease-out-soft focus-within:border-ink">
      <label
        htmlFor={id}
        className="flex flex-wrap items-baseline justify-between gap-x-sm"
      >
        <span className="text-label text-ink-subtle">{label}</span>
        {hint && <span className="text-caption text-ink-subtle">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT =
  'w-full bg-transparent text-field text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:outline-none'

/**
 * How the form unfolds and folds away. The lightbox's curve, a little
 * quicker: this is a panel making room on the page, not a photograph
 * arriving, and it should be done before anyone waits for it.
 */
const FOLD_MS = 320
const FOLD_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string }

/**
 * The form a client fills in to leave a review.
 *
 * Folded behind one button, because the section is for reading what others
 * said; writing is the rare case. Name, the review, and optionally a link
 * to their profile — Damir decided against photos, and against star ratings,
 * which on a portfolio are always five.
 *
 * Nothing sent here appears on the page until Damir approves it from the
 * mail it sends him, and the form says so: a visitor who sends a review and
 * then cannot find it would otherwise assume it was lost.
 */
export function ReviewForm() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [text, setText] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const widgetRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const firstField = useRef<HTMLInputElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const openerRow = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  // The closed row's height, measured as it goes. The form grows out of
  // exactly that and shrinks back into it, so neither direction ends in a
  // jump when one element is swapped for the other.
  const openerHeight = useRef(0)
  const closing = useRef(false)
  // Set by `cancel`, so focus goes back to the button only when the visitor
  // closed the form themselves — never on the first render of the page.
  const closedByVisitor = useRef(false)
  const ids = useId()

  // Render the invisible check once the form is on screen. It usually
  // decides without asking anything; when it does want a click, it appears
  // in its slot above the button.
  useEffect(() => {
    if (!open || status.kind === 'sent') return
    let cancelled = false
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !widgetRef.current || widgetId.current) return
        widgetId.current = turnstile.render(widgetRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          language: 'hr',
          appearance: 'interaction-only',
          callback: (value: string) => setToken(value),
          'expired-callback': () => setToken(null),
          'error-callback': () => setToken(null),
        })
      })
      .catch(() =>
        setStatus({
          kind: 'error',
          message: 'Zaštita od spama se nije učitala. Provjeri vezu i osvježi stranicu.',
        }),
      )
    return () => {
      cancelled = true
      if (widgetId.current) window.turnstile?.remove(widgetId.current)
      widgetId.current = null
    }
  }, [open, status.kind])

  useEffect(() => {
    if (open) {
      firstField.current?.focus()
      const form = formRef.current
      if (!form || still()) return
      form.style.overflow = 'hidden'
      const grow = form.animate(
        [
          { height: `${openerHeight.current}px`, opacity: 0 },
          { height: `${form.offsetHeight}px`, opacity: 1 },
        ],
        { duration: FOLD_MS, easing: FOLD_EASE },
      )
      grow.onfinish = grow.oncancel = () => form.style.removeProperty('overflow')
    } else if (closedByVisitor.current) {
      opener.current?.focus()
      if (!still()) {
        openerRow.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: FOLD_MS / 2,
          easing: FOLD_EASE,
        })
      }
    }
  }, [open])

  /**
   * Fold the form away and forget what was typed.
   *
   * Refused while sending: the request is already on its way, and a form
   * that closes as if nothing happened would hide a review that arrives.
   */
  function cancel() {
    if (status.kind === 'sending' || closing.current) return
    const close = () => {
      closing.current = false
      closedByVisitor.current = true
      setText('')
      setToken(null)
      setStatus({ kind: 'idle' })
      setOpen(false)
    }

    const form = formRef.current
    if (!form || still()) return close()
    closing.current = true
    form.style.overflow = 'hidden'
    const shrink = form.animate(
      [
        { height: `${form.offsetHeight}px`, opacity: 1 },
        { height: `${openerHeight.current}px`, opacity: 0 },
      ],
      { duration: FOLD_MS, easing: FOLD_EASE, fill: 'forwards' },
    )
    // `oncancel` too: a dropped animation (a background tab) must still close.
    shrink.onfinish = shrink.oncancel = close
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status.kind === 'sending') return
    if (!token) {
      setStatus({
        kind: 'error',
        message: 'Još provjeravamo da nisi robot. Pričekaj trenutak.',
      })
      return
    }

    const data = new FormData(event.currentTarget)
    setStatus({ kind: 'sending' })
    try {
      const res = await fetch('/api/recenzije', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          text: data.get('text'),
          link: data.get('link'),
          website: data.get('website'),
          turnstile: token,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Slanje nije uspjelo. Pokušaj ponovno.')
      setStatus({ kind: 'sent' })
    } catch (error) {
      // A token is single-use whether or not the review got through.
      setToken(null)
      if (widgetId.current) window.turnstile?.reset(widgetId.current)
      setStatus({
        kind: 'error',
        message:
          error instanceof Error && error.message !== 'Failed to fetch'
            ? error.message
            : 'Slanje nije uspjelo. Provjeri vezu i pokušaj ponovno.',
      })
    }
  }

  if (!open) {
    return (
      <div
        ref={openerRow}
        className="flex flex-wrap items-center gap-x-md gap-y-sm px-gutter"
      >
        <p className="m-0 text-body text-ink-muted">Radili smo zajedno?</p>
        <button
          ref={opener}
          type="button"
          onClick={() => {
            openerHeight.current = openerRow.current?.offsetHeight ?? 0
            setOpen(true)
          }}
          aria-expanded={false}
          className="inline-flex h-12 items-center gap-xs rounded-pill bg-solid px-md text-label text-bg transition-colors duration-150 ease-out-soft hover:bg-solid-hover"
        >
          napiši recenziju
        </button>
      </div>
    )
  }

  if (status.kind === 'sent') {
    return (
      <div className="flex max-w-[36rem] flex-col gap-xs px-gutter" role="status">
        <p className="m-0 text-lead text-ink">Hvala, recenzija je poslana.</p>
        <p className="m-0 text-body text-ink-muted">
          Damir je pročita pa objavi. Na stranici će se pojaviti nakon toga.
        </p>
      </div>
    )
  }

  const sending = status.kind === 'sending'
  const nearLimit = text.length > REVIEW_LIMITS.text - 200

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') cancel()
      }}
      aria-label="Napiši recenziju"
      className="flex max-w-[36rem] flex-col gap-md px-gutter"
    >
      <Field id={`${ids}-name`} label="ime i prezime">
        <input
          ref={firstField}
          id={`${ids}-name`}
          name="name"
          required
          minLength={2}
          maxLength={REVIEW_LIMITS.name}
          autoComplete="name"
          className={INPUT}
        />
      </Field>

      <Field
        id={`${ids}-text`}
        label="recenzija"
        hint={nearLimit ? `${text.length} / ${REVIEW_LIMITS.text}` : undefined}
      >
        <div className="flex gap-xs">
          {/* The same opening quote each published review carries: what is
              typed here is what will stand after it. */}
          <span
            aria-hidden="true"
            className="h-[0.55em] font-display text-h2 leading-[0.3] text-retro-mustard"
          >
            „
          </span>
          <textarea
            id={`${ids}-text`}
            name="text"
            required
            minLength={10}
            maxLength={REVIEW_LIMITS.text}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${INPUT} min-h-[5lh] resize-y [field-sizing:content]`}
          />
        </div>
      </Field>

      <Field
        id={`${ids}-link`}
        label="link na profil"
        hint="neobavezno: Instagram, Facebook ili LinkedIn"
      >
        {/* Text, not `type="url"`: people type `instagram.com/ime` without
            the scheme, and the browser would refuse it. The Worker accepts
            both. */}
        <input
          id={`${ids}-link`}
          name="link"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={REVIEW_LIMITS.link}
          placeholder="instagram.com/tvojprofil"
          className={INPUT}
        />
      </Field>

      {/* The honeypot. Hidden from people and from screen readers; a bot
          filling every field fills this one too. */}
      <div aria-hidden="true" className="sr-only">
        <label>
          web stranica
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div ref={widgetRef} className="empty:hidden" />

      <div className="flex flex-col items-start gap-sm border-t border-line pt-md">
        <div className="flex flex-wrap gap-sm">
          <button
            type="submit"
            disabled={sending}
            className="inline-flex h-12 items-center rounded-pill bg-solid px-md text-label text-bg transition-colors duration-150 ease-out-soft hover:bg-solid-hover active:bg-solid-active disabled:opacity-40"
          >
            {sending ? 'šaljem…' : 'pošalji recenziju'}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={sending}
            className="inline-flex h-12 items-center rounded-pill border border-line-strong px-md text-label text-ink transition-colors duration-150 ease-out-soft hover:border-ink active:bg-surface disabled:opacity-40"
          >
            odustani
          </button>
        </div>
        <p className="m-0 text-caption text-ink-subtle">
          Recenzija se objavljuje tek kad je Damir pročita.
        </p>
        {status.kind === 'error' && (
          <p role="alert" className="m-0 text-body text-ink">
            {status.message}
          </p>
        )}
      </div>
    </form>
  )
}
