import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN = {
  email: 'admin@freetiful.com',
  password: 'Freetiful2026!',
  name: '어드민',
};

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN.email } });
  const passwordHash = await bcrypt.hash(ADMIN.password, 12);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: existing.name || ADMIN.name,
        role: UserRole.admin,
        isActive: true,
        isBanned: false,
        notificationSettings: {
          upsert: {
            create: {},
            update: {},
          },
        },
      },
    });
    await prisma.authProviderRecord.upsert({
      where: {
        provider_providerUserId: {
          provider: 'email',
          providerUserId: ADMIN.email,
        },
      },
      create: {
        userId: existing.id,
        provider: 'email',
        providerUserId: ADMIN.email,
        providerEmail: ADMIN.email,
        accessToken: passwordHash,
      },
      update: {
        userId: existing.id,
        providerEmail: ADMIN.email,
        accessToken: passwordHash,
      },
    });
    console.log(`✅ Admin repaired`);
    console.log(`   id:       ${existing.id}`);
    console.log(`   email:    ${ADMIN.email}`);
    console.log(`   password: ${ADMIN.password}`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: ADMIN.name,
      email: ADMIN.email,
      role: UserRole.admin,
      referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      authProviders: {
        create: {
          provider: 'email',
          providerUserId: ADMIN.email,
          providerEmail: ADMIN.email,
          accessToken: passwordHash,
        },
      },
      notificationSettings: { create: {} },
    },
  });

  console.log(`✅ Admin created`);
  console.log(`   id:       ${user.id}`);
  console.log(`   email:    ${ADMIN.email}`);
  console.log(`   password: ${ADMIN.password}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
