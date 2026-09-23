/**
 * Everything the review flow shows a person: Damir's mail, and the page a
 * link in it opens.
 *
 * Plain strings rather than the React app: these are two small documents
 * outside the site, read by one person, and they must work with the site's
 * build nowhere in sight. Colours repeat the site's tokens (app/styles/
 * theme.css) so the page reads as the same place.
 *
 * Every value that came from a visitor goes through `escape()`. The page is
 * served from the site's own origin, so markup smuggled into a review would
 * run there.
 */

export function escape(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )
}

const STYLE = `
  :root { color-scheme: dark; }
  body { margin: 0; background: #0c0c0c; color: #ededed;
    font: 1.0625rem/1.6 'Jost', 'Futura', 'Century Gothic', system-ui, sans-serif; }
  main { max-width: 36rem; margin: 0 auto; padding: 3rem 1.25rem; display: grid; gap: 1.5rem; }
  h1 { margin: 0; font-size: 1.625rem; line-height: 1.1; }
  p { margin: 0; }
  .muted { color: #a3a3a3; }
  blockquote { margin: 0; padding: 1.25rem; background: #151515; border-radius: 1rem;
    white-space: pre-line; color: rgb(237 237 237 / 0.85); }
  .who { color: #ededed; font-weight: 600; }
  a { color: #a3a3a3; }
  button { font: inherit; font-weight: 600; font-size: 0.875rem; height: 3rem; padding: 0 1.5rem;
    border-radius: 999px; cursor: pointer; border: 1px solid #3a3a3a; background: none; color: #ededed; }
  button.solid { background: #ededed; color: #0c0c0c; border-color: #ededed; }
  form { display: flex; gap: 0.75rem; flex-wrap: wrap; }
`

export function page(title, body, status = 200) {
  const html = `<!doctype html>
<html lang="hr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(title)} — capturedwell</title>
<style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      // Nothing on these pages needs a script, a frame or another origin.
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'referrer-policy': 'no-referrer',
    },
  })
}

function quote(review) {
  const link = review.link
    ? `<p class="muted">${escape(review.link.label)}: ${escape(review.link.href)}</p>`
    : ''
  return `<blockquote>${escape(review.text)}</blockquote>
<p class="who">${escape(review.name)}</p>${link}`
}

/**
 * What a link from the mail opens: the review and one button.
 *
 * The button is what decides. The link carries the same signed parameters
 * into the form, so the POST is exactly as authorised as the link was.
 */
export function confirmPage(review, params) {
  const publish = params.get('d') === 'objavi'
  const hidden = [...params]
    .map(([k, v]) => `<input type="hidden" name="${escape(k)}" value="${escape(v)}">`)
    .join('')
  return page(
    publish ? 'Objavi recenziju' : 'Odbij recenziju',
    `<h1>${publish ? 'Objaviti ovu recenziju?' : 'Odbiti ovu recenziju?'}</h1>
${quote(review)}
<form method="post">${hidden}
<button type="submit" class="solid">${publish ? 'objavi' : 'odbij i obriši'}</button>
</form>
<p class="muted">${
      publish
        ? 'Nakon potvrde stranica se sama osvježi za par minuta.'
        : 'Recenzija se briše i nigdje se ne objavljuje.'
    }</p>`,
  )
}

export function donePage(decision) {
  return decision === 'objavi'
    ? page(
        'Objavljeno',
        `<h1>Objavljeno.</h1><p class="muted">Recenzija će se na stranici pojaviti za par minuta.</p>`,
      )
    : page('Odbijeno', `<h1>Odbijeno.</h1><p class="muted">Recenzija je obrisana.</p>`)
}

export function messagePage(title, text, status) {
  return page(
    title,
    `<h1>${escape(title)}</h1><p class="muted">${escape(text)}</p>`,
    status,
  )
}

/** Damir's mail about one new review. */
export function reviewMail(review, { publishUrl, rejectUrl }) {
  const subject = `Nova recenzija — ${review.name}`
  const text = [
    `${review.name} je ostavio/la recenziju na capturedwell:`,
    '',
    review.text,
    '',
    ...(review.link ? [`${review.link.label}: ${review.link.href}`, ''] : []),
    `Objavi: ${publishUrl}`,
    `Odbij: ${rejectUrl}`,
    '',
    'Linkovi vrijede 14 dana. Dok ne klikneš, recenzija se ne vidi na stranici.',
  ].join('\n')

  const button = (href, label, solid) =>
    `<a href="${escape(href)}" style="display:inline-block;padding:12px 24px;border-radius:999px;` +
    `font-weight:600;text-decoration:none;${
      solid
        ? 'background:#0c0c0c;color:#ededed;'
        : 'border:1px solid #808080;color:#0c0c0c;'
    }">${label}</a>`

  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.6;color:#0c0c0c;max-width:560px">
<p><strong>${escape(review.name)}</strong> je ostavio/la recenziju na capturedwell:</p>
<blockquote style="margin:0;padding:16px;background:#f2f2f2;border-radius:12px;white-space:pre-line">${escape(review.text)}</blockquote>
${review.link ? `<p>${escape(review.link.label)}: ${escape(review.link.href)}</p>` : ''}
<p>${button(publishUrl, 'objavi', true)} &nbsp; ${button(rejectUrl, 'odbij', false)}</p>
<p style="color:#666;font-size:14px">Linkovi vrijede 14 dana. Dok ne klikneš, recenzija se ne vidi na stranici.</p>
</div>`

  return { subject, text, html }
}
