/**
 * Reading setup values in Node.
 *
 * Kept apart from `google-auth.mjs` so that module stays importable from the
 * Worker, where `node:fs` does not exist and the key arrives as a secret
 * string rather than a file.
 */
import { readFile } from 'node:fs/promises'

/** Fail loudly and by name, rather than sending `undefined` to an API. */
export function required(name, env = process.env) {
  const value = env[name]
  if (!value)
    throw new Error(`Missing ${name}. See docs/plan-drive-sync.md and .env.example`)
  return value
}

/**
 * Service account credentials from either shape.
 *
 * CI passes the key's contents in `GOOGLE_SERVICE_ACCOUNT_JSON`, because a
 * GitHub secret is a string. Locally a path is kinder: the key stays one file
 * outside the repository, and nothing that prints the environment prints it.
 */
export async function serviceAccount(env = process.env) {
  const inline = env.GOOGLE_SERVICE_ACCOUNT_JSON
  const path = env.GOOGLE_SERVICE_ACCOUNT_FILE
  if (!inline && !path) {
    throw new Error(
      'Set GOOGLE_SERVICE_ACCOUNT_FILE (path, local) or GOOGLE_SERVICE_ACCOUNT_JSON (contents, CI)',
    )
  }

  const raw = inline ?? (await readFile(path, 'utf8'))
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(
      inline
        ? 'GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON — paste the whole key file, including the braces'
        : `${path} is not valid JSON`,
    )
  }
}
