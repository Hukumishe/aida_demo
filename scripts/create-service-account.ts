import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SERVICE_PHONE = '+77001234567';
const SERVICE_PASSWORD = 'ServiceAccount1!';

async function createServiceAccount() {
  try {
    const existing = await prisma.user.findFirst({
      where: { role: 'SERVICE' },
    });

    if (existing) {
      console.log('SERVICE user already exists:', existing.phone ?? existing.email);
      return;
    }

    const passwordHash = await bcrypt.hash(SERVICE_PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        phone: SERVICE_PHONE,
        email: null,
        passwordHash,
        role: 'SERVICE',
        studioId: null,
        isActive: true,
      },
    });

    console.log('SERVICE account created:');
    console.log('  Phone:    ', SERVICE_PHONE);
    console.log('  Password: ', SERVICE_PASSWORD);
    console.log('  User ID:  ', user.id);
    console.log('  Login: POST /auth/login with { "phone": "' + SERVICE_PHONE + '", "password": "' + SERVICE_PASSWORD + '" }');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('User with this phone already exists. Use another phone or delete the existing SERVICE user.');
    } else {
      console.error('Error:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

createServiceAccount()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
