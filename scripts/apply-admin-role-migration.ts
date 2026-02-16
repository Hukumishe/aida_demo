import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyAdminRoleMigration() {
  try {
    console.log('Applying ADMIN role migration...');
    
    // Execute the migration SQL directly
    await prisma.$executeRawUnsafe(`
      ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';
    `);
    
    console.log('✅ Migration applied successfully!');
    console.log('ADMIN role has been added to UserRole enum.');
    
    // Verify the migration
    const result = await prisma.$queryRawUnsafe<Array<{ role: string }>>(`
      SELECT unnest(enum_range(NULL::"UserRole")) AS role;
    `);
    
    console.log('\nCurrent roles in UserRole enum:');
    result.forEach((row) => {
      console.log(`  - ${row.role}`);
    });
    
  } catch (error: any) {
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      console.log('✅ ADMIN role already exists in the enum. Migration not needed.');
    } else {
      console.error('❌ Error applying migration:', error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

applyAdminRoleMigration()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

