import { CmsPage, cmsMetadata } from '@/components/common/CmsPage'

export const revalidate = 3600

export const generateMetadata = () => cmsMetadata('refund')

export default function RefundPage() {
  return <CmsPage slug="refund" />
}
