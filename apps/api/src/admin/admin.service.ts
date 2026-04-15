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
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: { id: true, role: true },
    });
  }

  async updateUserBan(requesterId: string, userId: string, isBanned: boolean) {
    await this.assertAdmin(requesterId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { isBanned },
      select: { id: true, isBanned: true },
    });
  }
}
