import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create studio
  const studio = await prisma.studio.create({
    data: {
      name: 'Beauty Studio Moscow',
      address: 'Moscow, Tverskaya st. 1',
      timezone: 'Europe/Moscow',
    },
  });

  console.log('Created studio:', studio.id);

  // Create owner
  const ownerPasswordHash = await bcrypt.hash('owner123', 10);
  const owner = await prisma.user.create({
    data: {
      email: 'owner@example.com',
      phone: '+79991234567',
      passwordHash: ownerPasswordHash,
      role: 'OWNER',
      isActive: true,
    },
  });

  console.log('Created owner:', owner.id);

  // Create manager
  const managerPasswordHash = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.create({
    data: {
      email: 'manager@example.com',
      phone: '+79991234568',
      passwordHash: managerPasswordHash,
      role: 'MANAGER',
      studioId: studio.id,
      isActive: true,
      staffProfile: {
        create: {
          firstName: 'Manager',
          lastName: 'User',
          title: 'Studio Manager',
          providesServices: false,
        },
      },
    },
  });

  console.log('Created manager:', manager.id);

  // Create master
  const masterPasswordHash = await bcrypt.hash('master123', 10);
  const master = await prisma.user.create({
    data: {
      email: 'master@example.com',
      phone: '+79991234569',
      passwordHash: masterPasswordHash,
      role: 'MASTER',
      studioId: studio.id,
      isActive: true,
      staffProfile: {
        create: {
          firstName: 'Master',
          lastName: 'User',
          title: 'Senior Hair Stylist',
          category: 'Hair Stylist',
          providesServices: true,
        },
      },
    },
  });

  console.log('Created master:', master.id);

  // Create client
  const client = await prisma.client.create({
    data: {
      studioId: studio.id,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+79991234570',
      notes: 'Regular client, prefers morning appointments',
    },
  });

  console.log('Created client:', client.id);

  // Create service
  const service = await prisma.service.create({
    data: {
      studioId: studio.id,
      name: 'Haircut',
      defaultDurationMin: 60,
      defaultPrice: 2000,
      isActive: true,
    },
  });

  console.log('Created service:', service.id);

  // Create work schedule for master (5/2 pattern example)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();

    // Monday-Friday work days
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      await prisma.workScheduleDay.create({
        data: {
          studioId: studio.id,
          staffUserId: master.id,
          date,
          startTime: '09:00',
          endTime: '18:00',
          breakStart: '13:00',
          breakEnd: '14:00',
          isDayOff: false,
        },
      });
    }
  }

  console.log('Created work schedule for master');

  console.log('Seeding completed!');
  console.log('\nTest accounts:');
  console.log('Owner: owner@example.com / owner123');
  console.log('Manager: manager@example.com / manager123');
  console.log('Master: master@example.com / master123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

