import { CmsPage, cmsMetadata } from '@/components/common/CmsPage'

export const revalidate = 3600

export const generateMetadata = () => cmsMetadata('privacy')

export default function PrivacyPage() {
  return <CmsPage slug="privacy" />
}
