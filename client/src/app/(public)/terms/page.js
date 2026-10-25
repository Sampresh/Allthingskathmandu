import { CmsPage, cmsMetadata } from '@/components/common/CmsPage'

export const revalidate = 3600

export const generateMetadata = () => cmsMetadata('terms')

export default function TermsPage() {
  return <CmsPage slug="terms" />
}
