import type { PrismaService } from '../prisma/prisma.service';

export function leadLandingPage(source: unknown): string | null {
  if (source === 'landing_quick_match') return 'quick-match';
  if (typeof source === 'string' && (/^landing_wedding_mc(?:_v\d+)?$/.test(source) || source === 'freetiful-mc-wedding-v3')) return 'wedding-mc';
  if (source === 'freetiful-corporate-mc') return 'corporate-mc';
  return null;
}

/** Only server-created leads can attach request IDs; the public conversion beacon cannot. */
export async function attributeLandingLead(prisma: PrismaService, input: {
  sessionKey: unknown; page: string | null; userId?: string; matchRequestId?: string; inquiryId?: string;
}) {
  if (!input.page || typeof input.sessionKey !== 'string' || !/^[\w-]{16,80}$/.test(input.sessionKey)) return;
  await prisma.$transaction(async (tx) => {
    const visit = await tx.landingVisit.upsert({
      where: { sessionKey_page: { sessionKey: input.sessionKey as string, page: input.page! } },
      create: { sessionKey: input.sessionKey as string, page: input.page!, userId: input.userId },
      update: {},
      select: { id: true, userId: true },
    });
    // A tab reused by a different account must not overwrite the original visitor.
    if (input.userId && visit.userId && visit.userId !== input.userId) return;
    await tx.landingVisit.update({ where: { id: visit.id }, data: { userId: input.userId, converted: true, convertedAt: new Date() } });
    if (input.matchRequestId) await tx.matchRequest.update({ where: { id: input.matchRequestId }, data: { landingVisitId: visit.id } });
    if (input.inquiryId) await tx.businessInquiry.update({ where: { id: input.inquiryId }, data: { landingVisitId: visit.id } });
  });
}
