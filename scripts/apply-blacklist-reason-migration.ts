import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🚀 Starting blacklist reason migration...');

    // Add blacklistReason column to clients table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "blacklistReason" TEXT;
    `);

    console.log('✅ Migration applied successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Added blacklistReason field to clients table');
  } catch (error: any) {
    // Ignore errors for IF NOT EXISTS clauses
    if (
      error.message?.includes('already exists') ||
      error.message?.includes('duplicate') ||
      error.message?.includes('IF NOT EXISTS')
    ) {
      console.log(`⚠️  Migration skipped (already exists): ${error.message}`);
    } else {
      console.error('❌ Error applying migration:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });

