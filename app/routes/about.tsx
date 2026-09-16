import type { MetaFunction } from 'react-router'
import { Layout, SectionLabel } from '~/components/Layout'
import { Photo } from '~/components/Photo'
import { gallery } from '~/lib/gallery'
import { SITE } from '~/lib/site'
import { ContactBlock } from '~/components/ContactBlock'

export const meta: MetaFunction = () => [
  { title: `o meni — ${SITE.name}` },
  { name: 'description', content: `${SITE.owner}, fotograf iz ${SITE.city}a.` },
]

export default function About() {
  // TODO(Damir): a real portrait, 4:5. Until then the studio photo stands
  // in rather than an empty grey box.
  const portrait = gallery.photos.find((p) => p.category === 'studio')

  return (
    <Layout>
      <section className="grid grid-cols-1 gap-photo-gap pt-md lg:grid-cols-2">
        <div className="h-[min(70vh,860px)] bg-surface">
          {portrait ? (
            <Photo photo={portrait} sizes="(max-width: 1024px) 100vw, 50vw" />
          ) : (
            <div className="flex size-full items-center justify-center text-label text-ink-subtle">
              [Damirov portret, 4:5]
            </div>
          )}
        </div>
        <div className="flex flex-col justify-end gap-lg px-gutter pb-xs lg:pl-xl">
          <SectionLabel>o meni</SectionLabel>
          <h1 className="m-0 text-h1">{SITE.owner.toLowerCase()}.</h1>
          <div className="flex max-w-[520px] flex-col gap-5 text-body text-ink-body">
            <p className="m-0 text-pretty">
              TODO(Damir): kratka biografija, 2–3 rečenice vlastitim riječima — odakle
              si, kako si počeo i kako radiš na snimanju.
            </p>
            <p className="m-0 text-pretty">
              Snimam vjenčanja, lifestyle, događaje i studijske portrete. Radim iz{' '}
              {SITE.city}a i okolice.
            </p>
          </div>
        </div>
      </section>

      <ContactBlock />
    </Layout>
  )
}
