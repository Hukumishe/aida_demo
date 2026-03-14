/**
 * Creates a demo studio and an OWNER user for it.
 * Run with: npx ts-node scripts/seed-demo-owner.ts
 * Or with Railway: railway run npx ts-node scripts/seed-demo-owner.ts
 *
 * Demo owner: phone +77001234567, password Demo123!
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { generateId, IdPrefix } from '../src/common/id-generator';

const prisma = new PrismaClient();

const DEMO_STUDIO_NAME = 'DEMO studio';
const DEMO_OWNER_PHONE = '+77001234567';
const DEMO_OWNER_PASSWORD = 'Demo123!';

async function main() {
  let studio = await prisma.studio.findFirst({
    where: { name: { contains: 'DEMO', mode: 'insensitive' } },
  });

  if (!studio) {
    studio = await prisma.studio.create({
      data: {
        id: generateId(IdPrefix.Studio),
        name: DEMO_STUDIO_NAME,
        address: null,
        timezone: 'Asia/Almaty',
      },
    });
    console.log('Created studio:', studio.name, studio.id);
  } else {
    console.log('Using existing studio:', studio.name, studio.id);
  }

  const existing = await prisma.user.findFirst({
    where: { phone: DEMO_OWNER_PHONE },
  });

  if (existing) {
    console.log('Demo owner already exists:', existing.id, existing.phone);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_OWNER_PASSWORD, 10);
  const owner = await prisma.user.create({
    data: {
      id: generateId(IdPrefix.User),
      email: 'demo@demo-studio.example',
      phone: DEMO_OWNER_PHONE,
      passwordHash,
      password: DEMO_OWNER_PASSWORD,
      role: 'OWNER',
      studioId: studio.id,
      isActive: true,
    },
  });

  console.log('Created demo owner:', owner.id);
  console.log('Login: phone', DEMO_OWNER_PHONE, 'password', DEMO_OWNER_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
