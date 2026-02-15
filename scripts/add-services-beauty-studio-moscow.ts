import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Скрипт для добавления услуг в салон "Beauty Studio Moscow"
 * 
 * Услуги из каталога:
 * - Мужское глубкое бикини - 1 час - 10 000
 * - Мужские подмышки - 15 минут - 5 000
 * - Подмышки воск муж - 30 минут - 5 000 (2 сотрудника)
 * - Подмышки муж skins - 30 минут - 7 000 (2 сотрудника)
 * - Грудь муж skins - 30 минут - 8 000 (2 сотрудника)
 * - Живот муж skins - 40 минут - 8 000
 * - Руки до локтя - 40 минут - 4 000
 * - Руки полностью воск - 1 час - 5 000
 * - Ноги до колен воск - 1 час - 5 000
 * - Ноги полностью воск - 1 час - 7 500
 * - Муж глубокое бикини skins - 40 минут - 14 000
 */

const services = [
  {
    name: 'Мужское глубкое бикини',
    defaultDurationMin: 60, // 1 час
    defaultPrice: 10000, // 10 000 тенге (API работает в тенге)
    requiredStaffCount: 1,
  },
  {
    name: 'Мужские подмышки',
    defaultDurationMin: 15,
    defaultPrice: 5000, // 5 000 тенге
    requiredStaffCount: 1,
  },
  {
    name: 'Подмышки воск муж',
    defaultDurationMin: 30,
    defaultPrice: 5000, // 5 000 тенге
    requiredStaffCount: 2,
  },
  {
    name: 'Подмышки муж skins',
    defaultDurationMin: 30,
    defaultPrice: 7000, // 7 000 тенге
    requiredStaffCount: 2,
  },
  {
    name: 'Грудь муж skins',
    defaultDurationMin: 30,
    defaultPrice: 8000, // 8 000 тенге
    requiredStaffCount: 2,
  },
  {
    name: 'Живот муж skins',
    defaultDurationMin: 40,
    defaultPrice: 8000, // 8 000 тенге
    requiredStaffCount: 1,
  },
  {
    name: 'Руки до локтя',
    defaultDurationMin: 40,
    defaultPrice: 4000, // 4 000 тенге
    requiredStaffCount: 1,
  },
  {
    name: 'Руки полностью воск',
    defaultDurationMin: 60, // 1 час
    defaultPrice: 5000, // 5 000 тенге
    requiredStaffCount: 1,
  },
  {
    name: 'Ноги до колен воск',
    defaultDurationMin: 60, // 1 час
    defaultPrice: 5000, // 5 000 тенге
    requiredStaffCount: 1,
  },
  {
    name: 'Ноги полностью воск',
    defaultDurationMin: 60, // 1 час
    defaultPrice: 7500, // 7 500 тенге
    requiredStaffCount: 1,
  },
  {
    name: 'Муж глубокое бикини skins',
    defaultDurationMin: 40,
    defaultPrice: 14000, // 14 000 тенге
    requiredStaffCount: 1,
  },
];

async function main() {
  try {
    // Найти студию "Beauty Studio Moscow"
    const studio = await prisma.studio.findFirst({
      where: {
        name: {
          contains: 'Beauty Studio Moscow',
          mode: 'insensitive',
        },
      },
    });

    if (!studio) {
      console.error('❌ Студия "Beauty Studio Moscow" не найдена!');
      console.log('Доступные студии:');
      const allStudios = await prisma.studio.findMany({
        select: { id: true, name: true },
      });
      allStudios.forEach((s) => console.log(`  - ${s.name} (${s.id})`));
      process.exit(1);
    }

    console.log(`✅ Найдена студия: ${studio.name} (${studio.id})`);

    // Проверить, какие услуги уже существуют
    const existingServices = await prisma.service.findMany({
      where: { studioId: studio.id },
      select: { name: true },
    });

    const existingNames = new Set(existingServices.map((s) => s.name));
    console.log(`\n📋 Существующие услуги: ${existingServices.length}`);

    // Добавить услуги
    let added = 0;
    let skipped = 0;

    for (const service of services) {
      if (existingNames.has(service.name)) {
        console.log(`⏭️  Пропущено (уже существует): ${service.name}`);
        skipped++;
        continue;
      }

      await prisma.service.create({
        data: {
          studioId: studio.id,
          name: service.name,
          defaultDurationMin: service.defaultDurationMin,
          defaultPrice: service.defaultPrice,
          requiredStaffCount: service.requiredStaffCount,
          isActive: true,
        },
      });

      console.log(`✅ Добавлено: ${service.name} (${service.defaultDurationMin} мин, ${service.defaultPrice} ₸)`);
      added++;
    }

    console.log(`\n✨ Готово! Добавлено: ${added}, Пропущено: ${skipped}`);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

