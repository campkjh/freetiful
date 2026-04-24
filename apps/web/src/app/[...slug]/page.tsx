import { notFound, redirect } from 'next/navigation';

type CatchAllProps = {
  params: { slug?: string[] };
  searchParams?: Record<string, string | string[] | undefined>;
};

function toQueryString(searchParams: CatchAllProps['searchParams']) {
  if (!searchParams) return '';
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (typeof value === 'string') {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : '';
}

export default function CatchAllPage({ params, searchParams }: CatchAllProps) {
  const pathname = `/${params.slug?.join('/') || ''}`.toLowerCase();
  const provider = pathname.includes('kakao')
    ? 'kakao'
    : pathname.includes('naver')
      ? 'naver'
      : null;

  if (provider) {
    const target = pathname.includes('mobile')
      ? `/auth/${provider}/mobile`
      : `/auth/${provider}/callback`;
    redirect(`${target}${toQueryString(searchParams)}`);
  }

  if (
    pathname.includes('oauth') ||
    pathname.includes('callback') ||
    pathname.includes('login') ||
    pathname.includes('signin') ||
    pathname.includes('signup') ||
    pathname.startsWith('/auth')
  ) {
    redirect('/main');
  }

  notFound();
}
