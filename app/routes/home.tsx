import type { MetaFunction } from 'react-router'
import { Header, SECTIONS } from '~/components/Header'
import { Footer } from '~/components/Footer'
import { SectionBreak } from '~/components/SectionBreak'
import { Hero } from '~/sections/Hero'
import { Gallery } from '~/sections/Gallery'
import { About } from '~/sections/About'
import { Contact } from '~/sections/Contact'
import { useScrollSpy } from '~/hooks/useScrollSpy'
import { useReveal } from '~/hooks/useReveal'
import { SITE } from '~/lib/site'

export const meta: MetaFunction = () => [
  { title: `${SITE.name} — ${SITE.owner}, ${SITE.role}` },
  {
    name: 'description',
    content:
      'Vjenčanja, lifestyle, događaji i studio. Fotografiram ljude onakve kakvi jesu kad zaborave na objektiv.',
  },
  { property: 'og:title', content: `${SITE.name} — ${SITE.owner}` },
  { property: 'og:type', content: 'website' },
  { property: 'og:locale', content: 'hr_HR' },
  { property: 'og:url', content: SITE.url },
]

const SECTION_IDS = SECTIONS.map((s) => s.id)

/**
 * The whole site.
 *
 * One page, four sections, anchors in the menu. Categories are a filter
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
        <Gallery />
        <SectionBreak />
        <About />
        <SectionBreak />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
