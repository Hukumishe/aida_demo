import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🚀 Starting blacklist migration...');

    // Read migration SQL file
    const migrationPath = path.join(
      __dirname,
      '../prisma/migrations/20260220200000_add_blacklist/migration.sql',
    );
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`\n⏳ Executing statement ${i + 1}/${statements.length}...`);
          await prisma.$executeRawUnsafe(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
        } catch (error: any) {
          // Ignore errors for IF NOT EXISTS clauses
          if (
            error.message?.includes('already exists') ||
            error.message?.includes('duplicate') ||
            error.message?.includes('IF NOT EXISTS')
          ) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
          } else {
            throw error;
          }
        }
      }
    }

    console.log('\n✅ Migration applied successfully!');
    console.log('\n📋 Summary:');
    console.log('  - Added BLACKLIST_REQUEST to NotificationType enum');
    console.log('  - Added isBlacklisted field to clients table');
    console.log('  - Created blacklist_requests table');
    console.log('  - Created indexes');
    console.log('  - Added foreign key constraints');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
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

