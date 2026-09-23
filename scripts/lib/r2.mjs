/**
 * The S3 calls the sync needs against an R2 bucket, signed by hand.
 *
 * R2 speaks S3, and S3 wants SigV4. The alternative was shelling out to the
 * AWS CLI, which is preinstalled on GitHub runners but not on a laptop — two
 * code paths for one operation, and a `brew install` standing between a fresh
 * checkout and a working sync. WebCrypto is already here for the Google JWT,
 * exists in Node and in Workers alike, and adds no dependency to either.
 *
 * SigV4 is fiddly but fixed: get it right once, and the bucket itself is the
 * test. Nothing here is R2-specific beyond the endpoint and `region = auto`.
 */

const REGION = 'auto'
const SERVICE = 's3'
const ALGORITHM = 'AWS4-HMAC-SHA256'
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

const utf8 = new TextEncoder()

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(data) {
  return hex(
    await crypto.subtle.digest(
      'SHA-256',
      typeof data === 'string' ? utf8.encode(data) : data,
    ),
  )
}

async function hmac(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, utf8.encode(message))
}

/**
 * Encode one path segment the way S3 canonicalisation expects.
 *
 * `encodeURIComponent` leaves `!'()*` alone; S3 wants them percent-encoded,
 * and a signature computed over a different string than the one sent fails
 * with `SignatureDoesNotMatch` and no hint as to which character did it.
 */
function encodeSegment(segment) {
  return encodeURIComponent(segment).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

function encodeKey(key) {
  return key.split('/').map(encodeSegment).join('/')
}

/** `20260923T111500Z` and `20260923`, the two forms SigV4 asks for. */
function timestamps(date) {
  const amz = date.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amz, day: amz.slice(0, 8) }
}

export class R2 {
  /**
   * @param {{accountId: string, accessKeyId: string, secretAccessKey: string, bucket: string}} config
   */
  constructor({ accountId, accessKeyId, secretAccessKey, bucket }) {
    if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error('R2 needs accountId, accessKeyId, secretAccessKey and bucket')
    }
    this.host = `${accountId}.r2.cloudflarestorage.com`
    this.accessKeyId = accessKeyId
    this.secretAccessKey = secretAccessKey
    this.bucket = bucket
  }

  /**
   * Sign and send one request.
   *
   * Every header passed in is signed. Signing a subset is legal but invites
   * the bug where a header is sent, not signed, and silently ignored.
   */
  async #send(method, key, { body, headers = {}, query = {} } = {}) {
    const url = new URL(
      `https://${this.host}/${this.bucket}${key ? `/${encodeKey(key)}` : ''}`,
    )
    const { amz, day } = timestamps(new Date())
    const payload = body ? await sha256(body) : EMPTY_SHA256

    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${encodeSegment(k)}=${encodeSegment(query[k])}`)
      .join('&')
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)

    const signed = {
      host: this.host,
      'x-amz-content-sha256': payload,
      'x-amz-date': amz,
      ...Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]),
      ),
    }
    const names = Object.keys(signed).sort()
    const canonicalHeaders = names.map((n) => `${n}:${signed[n].trim()}\n`).join('')
    const signedHeaders = names.join(';')

    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payload,
    ].join('\n')

    const scope = `${day}/${REGION}/${SERVICE}/aws4_request`
    const stringToSign = [ALGORITHM, amz, scope, await sha256(canonicalRequest)].join(
      '\n',
    )

    let key4 = utf8.encode(`AWS4${this.secretAccessKey}`)
    for (const part of [day, REGION, SERVICE, 'aws4_request'])
      key4 = await hmac(key4, part)
    const signature = hex(await hmac(key4, stringToSign))

    const res = await fetch(url, {
      method,
      body,
      headers: {
        ...signed,
        authorization: `${ALGORITHM} Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      },
    })
    return res
  }

  /** Bytes of an object, or `null` if it is not there yet. */
  async get(key) {
    const res = await this.#send('GET', key)
    if (res.status === 404) return null
    if (!res.ok)
      throw new Error(`R2 GET ${key} failed (${res.status}): ${await res.text()}`)
    return new Uint8Array(await res.arrayBuffer())
  }

  /** Parsed JSON object, or `null` when absent — the first-run case. */
  async getJson(key) {
    const bytes = await this.get(key)
    if (!bytes) return null
    return JSON.parse(new TextDecoder().decode(bytes))
  }

  async put(key, body, { contentType, cacheControl } = {}) {
    const res = await this.#send('PUT', key, {
      body,
      headers: {
        ...(contentType ? { 'content-type': contentType } : {}),
        ...(cacheControl ? { 'cache-control': cacheControl } : {}),
      },
    })
    if (!res.ok)
      throw new Error(`R2 PUT ${key} failed (${res.status}): ${await res.text()}`)
  }

  async delete(key) {
    const res = await this.#send('DELETE', key)
    // S3 deletes are idempotent: a missing key is a 204, same as a real one.
    if (!res.ok && res.status !== 404) {
      throw new Error(`R2 DELETE ${key} failed (${res.status}): ${await res.text()}`)
    }
  }

  /**
   * Every key under a prefix.
   *
   * Used to delete a photo's renditions without trusting the manifest to say
   * which widths exist: if a previous run died between uploading and writing
   * state, the manifest is the one thing that does not know.
   */
  async list(prefix) {
    const keys = []
    let token

    do {
      const res = await this.#send('GET', '', {
        query: {
          'list-type': '2',
          prefix,
          ...(token ? { 'continuation-token': token } : {}),
        },
      })
      if (!res.ok)
        throw new Error(`R2 LIST ${prefix} failed (${res.status}): ${await res.text()}`)
      const xml = await res.text()

      for (const match of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) {
        keys.push(
          match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
        )
      }
      token = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
    } while (token)

    return keys
  }
}

/** Build a client from the environment, naming whichever value is missing. */
export function r2FromEnv(env = process.env) {
  return new R2({
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  })
}
