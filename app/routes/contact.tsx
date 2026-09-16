import type { MetaFunction } from 'react-router'
import { Layout } from '~/components/Layout'
import { ContactBlock } from '~/components/ContactBlock'
import { SITE } from '~/lib/site'

export const meta: MetaFunction = () => [
  { title: `kontakt — ${SITE.name}` },
  {
    name: 'description',
    content: `Za termine, upite i cijene javi se ${SITE.owner}u e-mailom.`,
  },
]

export default function Contact() {
  return (
    <Layout>
      <ContactBlock />
    </Layout>
  )
}
