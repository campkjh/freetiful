import { PolicyPage } from '../_components/PolicyPage';

export default function DynamicPolicyPage({ params }: { params: { slug: string } }) {
  return <PolicyPage slug={params.slug} />;
}
