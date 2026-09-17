import { Layout, SectionLabel } from '~/components/Layout'

/**
 * Placeholder for phase 4.
 *
 * The real protection for this route is Cloudflare Access, which rejects
 * unauthenticated requests at the edge before they reach the app — so there
 * is nothing to guard here in React. When the admin lands it must be a
 * dynamic import so visitors never download it with the public bundle.
 */
export default function Admin() {
  return (
    <Layout>
      <section className="flex flex-col gap-lg px-gutter py-3xl">
        <SectionLabel>administracija</SectionLabel>
        <h1 className="m-0 text-h2">još nije spremno.</h1>
        <p className="m-0 max-w-[35rem] text-body text-ink-body">
          Upload galerije dolazi u fazi 4: Cloudflare Access za prijavu, Worker za
          upis u R2, drag &amp; drop iz Findera.
        </p>
      </section>
    </Layout>
  )
}
