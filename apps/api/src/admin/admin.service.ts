import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.admin) {
      throw new ForbiddenException('Admin only');
    }
  }

  async listUsers(requesterId: string, role?: 'general' | 'pro') {
    await this.assertAdmin(requesterId);
    return this.prisma.user.findMany({
      where: role ? { role: role as UserRole } : {},
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isBanned: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async updateUserRole(requesterId: string, userId: string, role: 'general' | 'pro') {
    await this.assertAdmin(requesterId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: { id: true, role: true },
    });

    if (role === 'pro') {
      await this.prisma.proProfile.updateMany({
        where: { userId, status: { in: ['draft', 'pending'] } },
        data: { status: 'approved', approvedAt: new Date() },
      });
    }

    return updated;
  }

  async updateUserBan(requesterId: string, userId: string, isBanned: boolean) {
    await this.assertAdmin(requesterId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { isBanned },
      select: { id: true, isBanned: true },
    });
  }

  async hardDeleteUser(requesterId: string, userId: string) {
    await this.assertAdmin(requesterId);
    if (requesterId === userId) {
      throw new ForbiddenException('자기 자신은 삭제할 수 없습니다');
    }
    // CASCADE FK 가 적용돼 있으면 user 삭제만 해도 관련 데이터 전부 정리됨
    // (schema.prisma 의 onDelete: Cascade + Supabase SQL 로 FK 전환 완료 필요)
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }

  async listProProfiles(requesterId: string, status?: string) {
    await this.assertAdmin(requesterId);
    return this.prisma.proProfile.findMany({
      where: status ? { status: status as any } : {},
      include: {
        user: { select: { id: true, email: true, name: true, phone: true, profileImageUrl: true } },
        images: { orderBy: { displayOrder: 'asc' }, take: 4 },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  async updateProProfileStatus(
    requesterId: string,
    proProfileId: string,
    status: 'approved' | 'rejected' | 'pending' | 'suspended' | 'draft',
    rejectionReason?: string,
  ) {
    await this.assertAdmin(requesterId);
    const data: any = { status };
    if (status === 'approved') {
      data.approvedAt = new Date();
      data.rejectionReason = null;
    }
    if (status === 'rejected') {
      data.rejectionReason = rejectionReason ?? null;
    }
    const updated = await this.prisma.proProfile.update({
      where: { id: proProfileId },
      data,
      select: { id: true, userId: true, status: true },
    });
    if (status === 'approved') {
      await this.prisma.user.update({
        where: { id: updated.userId },
        data: { role: UserRole.pro },
      });
    }
    return updated;
  }
}
