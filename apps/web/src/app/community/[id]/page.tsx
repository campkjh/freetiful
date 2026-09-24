import CommunityPostDetailClient from '@/components/CommunityPostDetailClient';

export default async function CommunityPostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CommunityPostDetailClient postId={id} />;
}
