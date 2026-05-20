import CheckoutClient from './CheckoutClient';

export default function ProCheckoutPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { price?: string; quotationId?: string; plan?: string };
}) {
  return (
    <CheckoutClient
      proId={params.id}
      amount={Number(searchParams.price || 0)}
      quotationId={searchParams.quotationId || ''}
      plan={searchParams.plan || 'premium'}
      clientKey={process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || process.env.TOSS_CLIENT_KEY || ''}
    />
  );
}
