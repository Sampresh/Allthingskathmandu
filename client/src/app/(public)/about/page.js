import { CmsPage, cmsMetadata } from '@/components/common/CmsPage'

export const revalidate = 3600

export const generateMetadata = () => cmsMetadata('about')

export default function AboutPage() {
  return <CmsPage slug="about" />
}
