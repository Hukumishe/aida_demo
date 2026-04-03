import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateId, IdPrefix } from '../src/common/id-generator';

const prisma = new PrismaClient();

/** Телефон и пароль для первого входа; можно переопределить через env. */
const DEV_PHONE = process.env.DEVELOPER_PHONE ?? '+77008887766';
const DEV_PASSWORD = process.env.DEVELOPER_PASSWORD ?? 'Developer1!';

async function main() {
  const existing = await prisma.user.findFirst({
    where: { role: UserRole.DEVELOPER },
  });

  if (existing) {
    console.log('Пользователь DEVELOPER уже есть:', existing.phone ?? existing.email, 'id=', existing.id);
    return;
  }

  let org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: generateId(IdPrefix.Organization),
        name: 'Platform (для учётки DEVELOPER)',
      },
    });
    console.log('Создана организация для привязки пользователя (FK):', org.id);
  }

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const user = await prisma.user.create({
    data: {
      id: generateId(IdPrefix.User),
      phone: DEV_PHONE,
      email: 'developer@example.com',
      passwordHash,
      password: DEV_PASSWORD,
      role: UserRole.DEVELOPER,
      organizationId: org.id,
      studioId: null,
      isActive: true,
    },
  });

  console.log('');
  console.log('Создан пользователь DEVELOPER:');
  console.log('  Phone:    ', DEV_PHONE);
  console.log('  Email:    ', 'developer@example.com');
  console.log('  Password: ', DEV_PASSWORD);
  console.log('  User ID:  ', user.id);
  console.log('');
  console.log('Вход: POST /auth/login');
  console.log(JSON.stringify({ phone: DEV_PHONE, password: DEV_PASSWORD }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
