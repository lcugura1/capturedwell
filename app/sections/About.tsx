import { Photo } from '~/components/Photo'
import { SectionTitle } from '~/components/SectionTitle'
import pageImages from '~/data/page-images.json'
import { SITE } from '~/lib/site'
import type { Renderable } from '~/lib/images'

const portrait = (pageImages as Record<string, Renderable>)['damir']

export function About() {
  return (
    <section
      id="o-meni"
      className="grid scroll-mt-header grid-cols-1 gap-photo-gap pt-2xl lg:grid-cols-2"
    >
      <div className="relative h-[min(70vh,860px)] bg-surface">
        {portrait ? (
          <Photo
            photo={portrait}
            kind="page"
            fill
            alt={`${SITE.owner} u studiju, sjedi ispred bež pozadine`}
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-label text-ink-subtle">
            [Damirov portret, 4:5]
          </div>
        )}
      </div>
      <div className="flex flex-col justify-end gap-lg px-gutter pb-xs lg:pl-xl">
        <SectionTitle>o meni</SectionTitle>
        <p className="m-0 text-h2 text-ink">{SITE.owner.toLowerCase()}.</p>
        <div className="flex max-w-[520px] flex-col gap-5 text-body text-ink-body">
          <p className="m-0 text-pretty">
            Fotograf sam portreta i lifestylea, sa strašću za autentične trenutke.
            Fotografiram već sedam godina.
          </p>
          <p className="m-0 text-pretty">
            Rodom sam iz Vinkovaca i magistrirao sam grafički dizajn — kreativnost
            spajam s tehničkim znanjem i tako svakom projektu dajem vlastitu
            perspektivu.
          </p>
        </div>
      </div>
    </section>
  )
}
