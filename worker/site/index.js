/**
 * The site's Worker. Almost everything it serves is the prerendered build,
 * straight from static assets without this code running at all
 * (`run_worker_first` in wrangler.jsonc sends only `/api/*` here).
 *
 * `/api/*` is the review flow, docs/plan-recenzije.md:
 *
 *   POST /api/recenzije          a visitor sends a review -> pending/{id}.json,
 *                                and Damir gets a mail with two signed links
 *   GET  /api/recenzije/odluka   a link from that mail: shows the review and
 *                                one button. Changes nothing.
 *   POST /api/recenzije/odluka   the button: approved/{id}.json or deleted,
 *                                then the sync workflow publishes
 *
 * Nothing unapproved is ever public. Reviews wait in their own private
 * bucket, and the public media bucket is still written only by the workflow.
 *
 * Logs ids and outcomes, never names or text: Workers logs are not the place
 * for what a client wrote before Damir has even read it.
 */
import { dispatch } from '../../scripts/lib/github.mjs'
import { parseReview } from './review-input.js'
import { REVIEW_ID, signDecision, verifyDecision } from './decision-link.js'
import { confirmPage, donePage, messagePage, reviewMail } from './views.js'

/** Far above any real review, far below anything worth reading into memory. */
const MAX_BODY_BYTES = 16 * 1024

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

const fail = (error, status = 400) => json({ error }, status)

async function readJson(bucket, key) {
  const object = await bucket.get(key)
  return object ? object.json() : null
}

/** Body text, refusing anything larger than a review could be. */
async function boundedText(request) {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return null
  const text = await request.text()
  return new TextEncoder().encode(text).length > MAX_BODY_BYTES ? null : text
}

/** Whether Cloudflare's Turnstile vouches for this token, checked server-side. */
async function human(env, token, ip) {
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  const body = new FormData()
  body.append('secret', env.TURNSTILE_SECRET_KEY)
  body.append('response', token)
  if (ip) body.append('remoteip', ip)
  const res = await fetch(SITEVERIFY, { method: 'POST', body })
  if (!res.ok) return false
  const outcome = await res.json()
  return outcome.success === true
}

function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function submit(request, env) {
  // Only from the site's own pages. Not a defence against a determined
  // script — Turnstile is that — but it keeps other sites' forms out.
  const origin = request.headers.get('origin')
  if (origin !== new URL(request.url).origin) return fail('Zahtjev nije dopušten.', 403)
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return fail('Neispravan zahtjev.', 415)
  }

  const raw = await boundedText(request)
  if (raw === null) return fail('Recenzija je predugačka.', 413)
  let input
  try {
    input = JSON.parse(raw)
  } catch {
    return fail('Neispravan zahtjev.')
  }

  // The honeypot: a field no person sees. A bot that fills it gets the same
  // answer as a person, so it has nothing to learn from.
  if (input?.website) return json({ ok: true })

  if (!(await human(env, input?.turnstile, request.headers.get('cf-connecting-ip')))) {
    return fail('Provjera nije uspjela. Osvježi stranicu i pokušaj ponovno.', 403)
  }

  const parsed = parseReview(input)
  if (parsed.error) return fail(parsed.error)

  const review = { id: newId(), ...parsed.review, addedAt: new Date().toISOString() }
  const key = `pending/${review.id}.json`
  await env.REVIEWS.put(key, JSON.stringify(review), {
    httpMetadata: { contentType: 'application/json' },
  })

  const base = `${new URL(request.url).origin}/api/recenzije/odluka?`
  const [publish, reject] = await Promise.all(
    ['objavi', 'odbij'].map((decision) =>
      signDecision(env.REVIEW_SIGNING_KEY, { id: review.id, decision }),
    ),
  )
  const mail = reviewMail(review, {
    publishUrl: base + publish,
    rejectUrl: base + reject,
  })

  try {
    await env.EMAIL.send({
      from: { email: env.REVIEW_MAIL_FROM, name: 'capturedwell' },
      to: env.REVIEW_NOTIFY_TO,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  } catch (error) {
    // A review nobody is told about would wait in the bucket forever, so
    // it goes, and the visitor is asked to try again rather than thanked.
    await env.REVIEWS.delete(key)
    console.error(`review ${review.id}: mail failed`, error?.code ?? error?.message)
    return fail('Slanje trenutno ne radi. Pokušaj ponovno kasnije.', 502)
  }

  console.log(`review ${review.id}: pending`)
  return json({ ok: true })
}

/** The signed decision in `params`, or the page that says why there is none. */
async function authorised(env, params) {
  const result = await verifyDecision(env.REVIEW_SIGNING_KEY, params)
  if (result.error === 'expired') {
    return {
      response: messagePage(
        'Link je istekao',
        'Linkovi iz maila vrijede 14 dana. Recenzija nije objavljena i obrisat će se sama.',
        410,
      ),
    }
  }
  if (result.error)
    return { response: messagePage('Neispravan link', 'Ovaj link ne vrijedi.', 403) }
  return result
}

/** When the review is no longer waiting: already decided, one way or the other. */
async function settled(env, id) {
  const approved = await env.REVIEWS.head(`approved/${id}.json`)
  return approved
    ? messagePage('Već objavljeno', 'Ova recenzija je već objavljena.', 409)
    : messagePage('Više ne postoji', 'Ova recenzija je već odbijena.', 410)
}

async function confirm(request, env) {
  const params = new URL(request.url).searchParams
  const { id, response } = await authorised(env, params)
  if (response) return response
  const review = await readJson(env.REVIEWS, `pending/${id}.json`)
  if (!review) return settled(env, id)
  return confirmPage(review, params)
}

async function decide(request, env, ctx) {
  const raw = await boundedText(request)
  if (raw === null) return messagePage('Neispravan zahtjev', 'Zahtjev je prevelik.', 413)
  const params = new URLSearchParams(raw)
  const { id, decision, response } = await authorised(env, params)
  if (response) return response
  if (!REVIEW_ID.test(id))
    return messagePage('Neispravan link', 'Ovaj link ne vrijedi.', 403)

  const pendingKey = `pending/${id}.json`
  const review = await readJson(env.REVIEWS, pendingKey)
  if (!review) return settled(env, id)

  if (decision === 'objavi') {
    // Approved first, pending removed second: a failure between the two
    // leaves the review in both places, which publishes it and is tidied by
    // hand — never in neither, which would lose it.
    await env.REVIEWS.put(`approved/${id}.json`, JSON.stringify(review), {
      httpMetadata: { contentType: 'application/json' },
    })
    await env.REVIEWS.delete(pendingKey)
    // The workflow reads approved/ and rebuilds. If starting it fails, the
    // daily scheduled run publishes the review anyway, a day late.
    ctx.waitUntil(
      dispatch(
        env.GITHUB_TOKEN,
        env.GITHUB_REPO,
        env.GITHUB_WORKFLOW,
        env.GITHUB_REF,
      ).catch((error) => console.error(`review ${id}: dispatch failed`, error?.message)),
    )
  } else {
    await env.REVIEWS.delete(pendingKey)
  }

  console.log(`review ${id}: ${decision}`)
  return donePage(decision)
}

async function api(request, env, ctx) {
  const { pathname } = new URL(request.url)

  if (pathname === '/api/recenzije') {
    if (request.method !== 'POST') return fail('Metoda nije dopuštena.', 405)
    return submit(request, env)
  }

  if (pathname === '/api/recenzije/odluka') {
    if (request.method === 'GET') return confirm(request, env)
    if (request.method === 'POST') return decide(request, env, ctx)
    return fail('Metoda nije dopuštena.', 405)
  }

  return fail('Ne postoji.', 404)
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url)
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      return await api(request, env, ctx)
    } catch (error) {
      console.error(`${request.method} ${pathname} failed`, error?.message)
      return fail('Nešto je pošlo po zlu. Pokušaj ponovno kasnije.', 500)
    }
  },
}
