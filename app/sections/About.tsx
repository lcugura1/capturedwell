import { Photo } from '~/components/Photo'
import { SectionTitle } from '~/components/SectionTitle'
import pageImages from '~/data/page-images.json'
import { SITE } from '~/lib/site'
import type { Renderable } from '~/lib/images'

const portrait = (pageImages as Record<string, Renderable>)['damir']

export function About() {
  return (
    // No top padding. The dot that closes the gallery already owns the gap
    // between the two sections, and adding a step on top of it put 64px
    // above the dot and 136px below — the divider sat off-centre in its own
    // space. Contact keeps its padding because nothing precedes it.
    <section
      id="o-meni"
      className="grid scroll-mt-header grid-cols-1 gap-photo-gap lg:grid-cols-2"
    >
      {/* Phone: shorter than the screen on purpose. At 70vh the portrait
          filled it and pushed everything Damir actually says below the
          fold, so the section read as a photograph with a caption
          somewhere underneath.

          Desktop: no height of its own. Tying it to the viewport while the
          text beside it is sized by its content meant the gap between them
          grew with the screen — 200px of emptiness above the title at
          900px tall, 326px at 1080. The grid stretches this cell to
          whatever the text needs, and the floor keeps the photograph from
          collapsing into a letterbox if that text ever gets short. */}
      <div className="relative h-[min(56svh,53.75rem)] bg-surface lg:h-auto lg:min-h-[34rem]">
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
      <div
        className="flex flex-col justify-center gap-md px-gutter pb-xs pt-lg lg:gap-lg lg:py-2xl lg:pl-xl"
        data-reveal
      >
        <SectionTitle>o meni</SectionTitle>
        {/* Tucked up against the title rather than given its own step of
            air: the two are one unit, and on a phone the gap between them
            was reading as a section break. */}
        <p className="-mt-2 m-0 text-h2 text-ink lg:mt-0">{SITE.owner.toLowerCase()}.</p>
        <div className="flex max-w-[32.5rem] flex-col gap-5 text-body text-ink-body">
          <p className="m-0 text-pretty">
            Fotograf sam portreta i lifestylea, sa strašću za autentične trenutke.
          </p>
          <p className="m-0 text-pretty">
            Radim s parovima, obiteljima i brendovima.
          </p>
        </div>
      </div>
    </section>
  )
}
