/**
 * Service account credentials -> OAuth access token, on WebCrypto alone.
 *
 * `googleapis` would do this in one call and cost ~80 MB in node_modules.
 * WebCrypto ships in both Node and Workers, so this one module serves the
 * GitHub Action and the cron Worker without anything in between — no bundler
 * shim, no second implementation to keep in step.
 *
 * Deliberately free of `node:*` imports for that reason. Reading the key off
 * disk is a Node concern and lives in `env.mjs`.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer'
const RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }

const utf8 = new TextEncoder()

/** base64url without padding — what JWT wants, and what `btoa` does not give. */
function base64url(input) {
  const bytes = typeof input === 'string' ? utf8.encode(input) : new Uint8Array(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** PEM (as it sits in the key JSON) -> the DER bytes `importKey` expects. */
function pkcs8(pem) {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  const binary = atob(body)
  const der = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) der[i] = binary.charCodeAt(i)
  return der
}

/**
 * Sign a JWT with the service account key and trade it for an access token.
 *
 * Returns the expiry too, so a long-running caller can reuse the token
 * instead of signing once per request; Google issues them for an hour.
 */
export async function accessToken(credentials, scope) {
  const { client_email: iss, private_key: pem } = credentials
  if (!iss || !pem)
    throw new Error('Service account credentials are missing client_email or private_key')

  const iat = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({ iss, scope, aud: TOKEN_URL, iat, exp: iat + 3600 }),
  )

  const key = await crypto.subtle.importKey('pkcs8', pkcs8(pem), RS256, false, ['sign'])
  const signature = await crypto.subtle.sign(
    RS256.name,
    key,
    utf8.encode(`${header}.${claims}`),
  )
  const assertion = `${header}.${claims}.${base64url(signature)}`

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: JWT_BEARER, assertion }),
  })
  if (!res.ok) {
    // The body carries the actual cause (clock skew, disabled key, API not
    // enabled); the status alone sends you looking in the wrong place.
    throw new Error(
      `Google rejected the token request (${res.status}): ${await res.text()}`,
    )
  }

  const { access_token: token, expires_in: ttl } = await res.json()
  return { token, expiresAt: (iat + ttl) * 1000 }
}
