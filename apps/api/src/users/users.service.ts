import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        proProfile: true,
        businessProfile: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    data: { name?: string; phone?: string; profileImageUrl?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.profileImageUrl !== undefined && {
          profileImageUrl: data.profileImageUrl,
        }),
      },
    });
  }

  async getPointBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pointBalance: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { balance: user.pointBalance };
  }

  async getPointHistory(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.pointTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.pointTransaction.count({ where: { userId } }),
    ]);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addPoints(
    userId: string,
    amount: number,
    description: string,
    type: string,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { pointBalance: { increment: amount } },
      });

      const transaction = await tx.pointTransaction.create({
        data: {
          userId,
          type,
          amount,
          reason: description,
          balanceAfter: user.pointBalance,
        },
      });

      return transaction;
    });
  }

  async usePoints(userId: string, amount: number, description: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { pointBalance: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.pointBalance < amount) {
        throw new BadRequestException('Insufficient point balance');
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { pointBalance: { decrement: amount } },
      });

      const transaction = await tx.pointTransaction.create({
        data: {
          userId,
          type: 'use',
          amount: -amount,
          reason: description,
          balanceAfter: updatedUser.pointBalance,
        },
      });

      return transaction;
    });
  }

  async switchRole(userId: string, role: UserRole) {
    const allowedRoles: UserRole[] = ['general', 'pro'];
    if (!allowedRoles.includes(role)) {
      throw new BadRequestException(
        'Role must be either "general" or "pro"',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Soft delete — mark inactive and anonymize
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        name: '탈퇴한 회원',
        email: null,
        phone: null,
        profileImageUrl: null,
      },
    });

    // Delete all sessions
    await this.prisma.session.deleteMany({ where: { userId } });

    return { success: true };
  }
}
