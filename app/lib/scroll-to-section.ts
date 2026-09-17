/**
 * Scrolls to a section and updates the hash, without a navigation.
 *
 * The plain `href="#id"` this replaces worked in Chrome and did not on iOS
 * Safari, where tapping a nav item from the bottom of the page landed at the
 * top instead. Three things compete for the scroll position there — the
 * browser's own fragment jump, the router's ScrollRestoration reacting to
 * the new history entry, and `inert` pulling focus off the tapped link as
 * the menu closes — and which of them wins is not ours to decide.
 *
 * Doing the scroll ourselves and writing the hash with `replaceState`
 * removes all three from the question: no new history entry, so nothing for
 * ScrollRestoration to restore, and no fragment jump to race.
 *
 * `block: 'start'` lands on the element's scroll-margin, which is where
 * `scroll-mt-header` puts the section clear of the fixed header.
 */
export function scrollToSection(id: string) {
  const target = document.getElementById(id)
  if (!target) return

  const reduce =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })

  // The hash still belongs in the address bar — it is what makes a section
  // shareable — but as a record of where you are, not as a navigation.
  if (`#${id}` !== window.location.hash) {
    window.history.replaceState(null, '', `#${id}`)
  }
}
