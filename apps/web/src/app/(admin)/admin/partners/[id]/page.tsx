'use client';

import { useParams } from 'next/navigation';
import PartnerForm from '../_form';

export default function AdminPartnerEditPage() {
  const params = useParams();
  const id = params?.id as string;
  if (!id) return null;
  return <PartnerForm mode="edit" partnerId={id} />;
}
