import type { MetaFunction } from 'react-router'
import { Header, SECTIONS } from '~/components/Header'
import { Footer } from '~/components/Footer'
import { SectionBreak } from '~/components/SectionBreak'
import { Hero, hero, heroKind } from '~/sections/Hero'
import { Gallery } from '~/sections/Gallery'
import { About } from '~/sections/About'
import { Reviews } from '~/sections/Reviews'
import { Contact } from '~/sections/Contact'
import { useScrollSpy } from '~/hooks/useScrollSpy'
import { useReveal } from '~/hooks/useReveal'
import { SITE } from '~/lib/site'
import { src } from '~/lib/images'

// What Google shows as the result's headline, and the line under it.
const TITLE = `${SITE.name} — ${SITE.owner} — ${SITE.role}, ${SITE.city}`
const DESCRIPTION = SITE.bio.join(' ')

// The hero, as the picture a shared link shows. 1200px is what Facebook and
// WhatsApp ask for, and the hero is already close to their 1.91:1 frame, so
// their centre crop keeps the couple. Follows the hero when Damir changes it.
const PREVIEW = hero && {
  url: src(hero, 1200, 'jpg', heroKind),
  width: 1200,
  height: Math.round((1200 * hero.height) / hero.width),
  alt: hero.alt,
}

// What search engines and AI assistants read as facts rather than prose: who,
// what, where. ProfessionalService because schema.org has no photographer
// type. No e-mail: the page keeps it out of the HTML on purpose (CLAUDE.md §10).
const BUSINESS = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: SITE.name,
  url: SITE.url,
  description: DESCRIPTION,
  ...(PREVIEW && { image: PREVIEW.url }),
  ...(SITE.phone && { telephone: SITE.phone }),
  address: { '@type': 'PostalAddress', addressLocality: SITE.city, addressCountry: 'HR' },
  areaServed: { '@type': 'City', name: SITE.city },
  founder: { '@type': 'Person', name: SITE.owner, jobTitle: SITE.role },
  sameAs: [SITE.instagram.url],
}

export const meta: MetaFunction = () => [
  { title: TITLE },
  { name: 'description', content: DESCRIPTION },
  { tagName: 'link', rel: 'canonical', href: `${SITE.url}/` },
  { property: 'og:title', content: TITLE },
  { property: 'og:description', content: DESCRIPTION },
  { property: 'og:type', content: 'website' },
  { property: 'og:locale', content: 'hr_HR' },
  { property: 'og:url', content: `${SITE.url}/` },
  ...(PREVIEW
    ? [
        { property: 'og:image', content: PREVIEW.url },
        { property: 'og:image:width', content: String(PREVIEW.width) },
        { property: 'og:image:height', content: String(PREVIEW.height) },
        { property: 'og:image:alt', content: PREVIEW.alt },
        { name: 'twitter:card', content: 'summary_large_image' },
      ]
    : []),
  { 'script:ld+json': BUSINESS },
]

const SECTION_IDS = SECTIONS.map((s) => s.id)

/**
 * The whole site.
 *
 * One page, five sections, anchors in the menu. Categories are a filter
 * inside the gallery section rather than destinations of their own — see
 * sections/Gallery.tsx.
 */
export default function Home() {
  const active = useScrollSpy(SECTION_IDS)
  useReveal()

  return (
    <div className="flex min-h-screen flex-col">
      <Header active={active} />
      <main className="flex-1">
        <Hero />
        <SectionBreak />
        <Gallery />
        <SectionBreak />
        <About />
        <SectionBreak />
        <Reviews />
        <SectionBreak />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
