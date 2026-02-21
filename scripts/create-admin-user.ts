import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    console.log('Creating ADMIN user...');

    // Check if admin already exists
    const existingAdmin = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
        email: 'admin@example.com',
      },
    });

    if (existingAdmin) {
      console.log('✅ ADMIN user already exists:', existingAdmin.email);
      return;
    }

    // Get first studio (or create one if none exists)
    let studio = await prisma.studio.findFirst();
    
    if (!studio) {
      console.log('No studio found, creating one...');
      studio = await prisma.studio.create({
        data: {
          name: 'Beauty Studio Almaty',
          address: 'Almaty, Abay Ave 150',
          timezone: 'Asia/Almaty',
        },
      });
      console.log('Created studio:', studio.id);
    }

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        phone: '+79991234570',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        studioId: studio.id,
        isActive: true,
        staffProfile: {
          create: {
            firstName: 'Admin',
            lastName: 'User',
            title: 'Studio Administrator',
            providesServices: false,
          },
        },
      },
    });

    console.log('✅ Created ADMIN user:');
    console.log('   Email: admin@example.com');
    console.log('   Password: admin123');
    console.log('   Phone: +79991234570');
    console.log('   Studio ID:', studio.id);
    console.log('   User ID:', admin.id);
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('⚠️  ADMIN user with this email or phone already exists');
    } else {
      console.error('❌ Error creating ADMIN user:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser()
  .catch((error) => {
    console.error('Failed to create ADMIN user:', error);
    process.exit(1);
  });








