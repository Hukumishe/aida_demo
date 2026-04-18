import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ServiceAudience } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { isDeveloperRole } from '../common/decorators/roles.decorator';

export interface ImportServicesOptions {
  dryRun?: boolean;
}

export interface ImportRowReport {
  row: number;
  status: 'created' | 'skipped' | 'error';
  category?: string;
  name?: string;
  serviceId?: string;
  categoryId?: string;
  reason?: string;
}

export interface ImportServicesResult {
  dryRun: boolean;
  totalRows: number;
  createdCategories: { id: string; name: string }[];
  skippedCategories: { id: string; name: string }[];
  /** Список созданных услуг с id, name и categoryId (удобно для фронта) */
  createdServices: { id: string; name: string; categoryId: string }[];
  /** Количество созданных услуг — дубль от createdServices.length для совместимости. */
  createdServicesCount: number;
  skippedServices: number;
  errors: number;
  details: ImportRowReport[];
}

type NormalizedRow = {
  rowNumber: number;
  category: string;
  name: string;
  duration: number;
  price: number;
  audience: ServiceAudience;
};

const HEADER_ALIASES: Record<string, string> = {
  категория: 'category',
  category: 'category',
  'категория услуги': 'category',
  раздел: 'category',

  услуга: 'name',
  название: 'name',
  name: 'name',
  service: 'name',
  'название услуги': 'name',

  цена: 'price',
  price: 'price',
  стоимость: 'price',
  сумма: 'price',

  длительность: 'duration',
  duration: 'duration',
  время: 'duration',
  минуты: 'duration',
  'время (мин)': 'duration',
  'длительность (мин)': 'duration',

  аудитория: 'audience',
  audience: 'audience',
  пол: 'audience',
  gender: 'audience',
};

function normalizeHeader(raw: string): string | null {
  if (!raw) return null;
  const key = raw.toString().trim().toLowerCase();
  return HEADER_ALIASES[key] ?? null;
}

function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
  const cleaned = String(value)
    .replace(/[^\d.,-]/g, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num) : null;
}

function parseDuration(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
  const str = String(value).trim().toLowerCase();
  // e.g. "1 час 30 минут", "30 мин", "60"
  const hoursMatch = str.match(/(\d+)\s*(?:ч|час)/);
  const minutesMatch = str.match(/(\d+)\s*(?:м|мин)/);
  if (hoursMatch || minutesMatch) {
    const h = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
    const m = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
    const total = h * 60 + m;
    return total > 0 ? total : null;
  }
  const num = parseInt(str.replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseAudience(value: unknown, fallback: ServiceAudience): ServiceAudience {
  if (value === null || value === undefined || value === '') return fallback;
  const str = String(value).trim().toLowerCase();
  if (['m', 'men', 'муж', 'мужской', 'мужчины', 'мужчина'].includes(str)) {
    return ServiceAudience.MEN;
  }
  if (['w', 'women', 'f', 'female', 'жен', 'женский', 'женщины', 'женщина'].includes(str)) {
    return ServiceAudience.WOMEN;
  }
  return fallback;
}

@Injectable()
export class ServicesImportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Импорт категорий + услуг из CSV/XLSX. Только для DEVELOPER.
   *
   * Ожидаемые колонки (русские/английские заголовки, регистронезависимо):
   *   - Категория / category
   *   - Услуга / name
   *   - Цена / price (целое число, допускается "3 000тг")
   *   - Длительность / duration (минуты, допускается "1 час 30 мин")
   *   - Аудитория / audience (MEN / WOMEN, по умолчанию WOMEN)
   *
   * Категории создаются по мере необходимости. Услуги с тем же именем и аудиторией
   * пропускаются (идемпотентно).
   */
  async importFromFile(
    file: Express.Multer.File,
    userRole: string | undefined,
    organizationId: string,
    options: ImportServicesOptions = {},
  ): Promise<ImportServicesResult> {
    if (!isDeveloperRole(userRole)) {
      throw new BadRequestException('Импорт услуг доступен только разработчику');
    }
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Файл пустой или не передан');
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${organizationId} not found`);
    }

    const rows = this.parseFile(file);
    if (rows.length === 0) {
      throw new BadRequestException(
        'В файле не найдено ни одной строки с услугой. Проверьте заголовки: Категория, Услуга, Цена, Длительность.',
      );
    }

    const normalized: NormalizedRow[] = [];
    const errors: ImportRowReport[] = [];

    for (const row of rows) {
      const result = this.normalizeRow(row);
      if ('error' in result) {
        errors.push(result.error);
      } else {
        normalized.push(result.row);
      }
    }

    const existingCategories = await this.prisma.serviceCategory.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const catByName = new Map<string, { id: string; name: string }>();
    for (const c of existingCategories) {
      catByName.set(c.name.trim().toLowerCase(), c);
    }

    const existingServices = await this.prisma.service.findMany({
      where: { organizationId },
      select: { id: true, name: true, audience: true },
    });
    const serviceKey = (name: string, audience: ServiceAudience) =>
      `${name.trim().toLowerCase()}|${audience}`;
    const existingSvcSet = new Set(
      existingServices.map((s) => serviceKey(s.name, s.audience)),
    );

    const createdCategories: { id: string; name: string }[] = [];
    const skippedCategories: { id: string; name: string }[] = [];
    const createdServiceList: { id: string; name: string; categoryId: string }[] = [];
    const details: ImportRowReport[] = [...errors];

    let skippedServices = 0;

    const isDryRun = !!options.dryRun;

    for (const row of normalized) {
      const catKey = row.category.trim().toLowerCase();
      let cat = catByName.get(catKey);
      if (!cat) {
        if (isDryRun) {
          const placeholder = { id: `DRY_${catKey}`, name: row.category };
          cat = placeholder;
          catByName.set(catKey, placeholder);
          createdCategories.push(placeholder);
        } else {
          try {
            const created = await this.prisma.serviceCategory.create({
              data: {
                id: generateId(IdPrefix.ServiceCategory),
                organizationId,
                name: row.category.trim(),
                sortOrder: 0,
                isActive: true,
              },
              select: { id: true, name: true },
            });
            cat = created;
            catByName.set(catKey, created);
            createdCategories.push(created);
          } catch (err) {
            details.push({
              row: row.rowNumber,
              status: 'error',
              category: row.category,
              name: row.name,
              reason: `Не удалось создать категорию: ${
                err instanceof Error ? err.message : String(err)
              }`,
            });
            continue;
          }
        }
      } else if (!createdCategories.some((c) => c.id === cat!.id) &&
                 !skippedCategories.some((c) => c.id === cat!.id)) {
        skippedCategories.push(cat);
      }

      const svcKey = serviceKey(row.name, row.audience);
      if (existingSvcSet.has(svcKey)) {
        skippedServices++;
        details.push({
          row: row.rowNumber,
          status: 'skipped',
          category: row.category,
          name: row.name,
          reason: 'Услуга уже существует (имя + аудитория)',
        });
        continue;
      }

      if (isDryRun) {
        const fakeId = `DRY_${generateId(IdPrefix.Service)}`;
        createdServiceList.push({ id: fakeId, name: row.name, categoryId: cat.id });
        existingSvcSet.add(svcKey);
        details.push({
          row: row.rowNumber,
          status: 'created',
          category: cat.name,
          name: row.name,
          serviceId: fakeId,
          categoryId: cat.id,
        });
        continue;
      }

      try {
        const created = await this.prisma.service.create({
          data: {
            id: generateId(IdPrefix.Service),
            organizationId,
            name: row.name,
            defaultDurationMin: row.duration,
            defaultPrice: row.price,
            requiredStaffCount: 1,
            categoryId: cat.id,
            audience: row.audience,
          },
          select: { id: true, name: true, categoryId: true },
        });
        existingSvcSet.add(svcKey);
        createdServiceList.push(created);
        details.push({
          row: row.rowNumber,
          status: 'created',
          category: cat.name,
          name: row.name,
          serviceId: created.id,
          categoryId: created.categoryId,
        });
      } catch (err) {
        details.push({
          row: row.rowNumber,
          status: 'error',
          category: row.category,
          name: row.name,
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      dryRun: isDryRun,
      totalRows: rows.length,
      createdCategories,
      skippedCategories,
      createdServices: createdServiceList,
      createdServicesCount: createdServiceList.length,
      skippedServices,
      errors: details.filter((d) => d.status === 'error').length,
      details,
    };
  }

  private parseFile(file: Express.Multer.File): Record<string, unknown>[] {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, {
        type: 'buffer',
        raw: false,
        cellDates: false,
        codepage: 65001,
      });
    } catch (err) {
      throw new BadRequestException(
        `Не удалось прочитать файл как CSV/XLSX: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('В файле нет листов');
    }
    const sheet = workbook.Sheets[sheetName];

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
      blankrows: false,
    });

    if (rawRows.length === 0) return [];

    const firstRow = rawRows[0];
    const headerMap: Record<string, string> = {};
    for (const key of Object.keys(firstRow)) {
      const normalized = normalizeHeader(key);
      if (normalized) {
        headerMap[key] = normalized;
      }
    }

    const mapped = rawRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [orig, norm] of Object.entries(headerMap)) {
        out[norm] = row[orig];
      }
      return out;
    });

    return mapped;
  }

  private normalizeRow(
    row: Record<string, unknown>,
  ): { row: NormalizedRow } | { error: ImportRowReport } {
    // sheet_to_json does not expose row index; we reconstruct it from creation order (+2 for header).
    const rowNumber =
      typeof (row as any).__rowNum__ === 'number'
        ? ((row as any).__rowNum__ as number) + 1
        : 0;

    const category = String(row['category'] ?? '').trim();
    const name = String(row['name'] ?? '').trim();
    const priceRaw = row['price'];
    const durationRaw = row['duration'];
    const audienceRaw = row['audience'];

    if (!category && !name) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          reason: 'Строка пустая',
        },
      };
    }
    if (!category) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          name,
          reason: 'Не указана категория',
        },
      };
    }
    if (!name) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          category,
          reason: 'Не указано название услуги',
        },
      };
    }

    const price = parsePrice(priceRaw);
    if (price === null || price < 0) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          category,
          name,
          reason: `Некорректная цена: "${priceRaw}"`,
        },
      };
    }

    const duration = parseDuration(durationRaw);
    if (duration === null || duration <= 0) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          category,
          name,
          reason: `Некорректная длительность: "${durationRaw}"`,
        },
      };
    }

    const audience = parseAudience(audienceRaw, ServiceAudience.WOMEN);

    return {
      row: {
        rowNumber,
        category,
        name,
        price,
        duration,
        audience,
      },
    };
  }
}
