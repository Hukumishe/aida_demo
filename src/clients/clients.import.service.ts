import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';
import { ClientLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { isDeveloperRole } from '../common/decorators/roles.decorator';

export interface ImportClientsOptions {
  dryRun?: boolean;
}

export interface ImportClientRowReport {
  row: number;
  status: 'created' | 'skipped' | 'error';
  phone?: string;
  name?: string;
  reason?: string;
}

export interface ImportClientsResult {
  dryRun: boolean;
  totalRows: number;
  created: number;
  skipped: number;
  errors: number;
  details: ImportClientRowReport[];
}

type NormalizedRow = {
  rowNumber: number;
  firstName: string;
  lastName: string | null;
  phone: string;
  birthDate: Date | null;
  notes: string | null;
  bonuses: number;
  discount: number;
  balance: number;
  level: ClientLevel | null;
};

const HEADER_ALIASES: Record<string, string> = {
  имя: 'firstName',
  firstname: 'firstName',
  'first name': 'firstName',
  name: 'firstName',

  фамилия: 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',

  телефон: 'phone',
  phone: 'phone',
  номер: 'phone',
  'номер телефона': 'phone',
  mobile: 'phone',

  'дата рождения': 'birthDate',
  'день рождения': 'birthDate',
  др: 'birthDate',
  birthdate: 'birthDate',
  'birth date': 'birthDate',
  dob: 'birthDate',
  birthday: 'birthDate',

  заметки: 'notes',
  заметка: 'notes',
  комментарий: 'notes',
  notes: 'notes',
  note: 'notes',
  comment: 'notes',

  бонусы: 'bonuses',
  баллы: 'bonuses',
  bonuses: 'bonuses',
  bonus: 'bonuses',

  скидка: 'discount',
  discount: 'discount',

  баланс: 'balance',
  balance: 'balance',

  уровень: 'level',
  level: 'level',
  статус: 'level',
};

const REFERRAL_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const REFERRAL_CODE_LENGTH = 8;

function normalizeHeader(raw: string): string | null {
  if (!raw) return null;
  const key = raw.toString().trim().toLowerCase();
  return HEADER_ALIASES[key] ?? null;
}

/** Убирает всё, кроме цифр и ведущего «+». Возвращает пустую строку, если номера нет. */
function normalizePhone(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return (hasPlus ? '+' : '') + digits;
}

function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
  const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(/\s+/g, '').replace(',', '.');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num) : null;
}

/**
 * Принимает: ISO-строку YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, Excel-serial number (cellDates отключены).
 * Возвращает Date (UTC-полночь) либо null.
 */
function parseBirthDate(value: unknown): Date | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date: days since 1899-12-30
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + value * 86400000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
    return 'invalid';
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const y = +m[1]; const mo = +m[2]; const d = +m[3];
    if (isValidDateParts(y, mo, d)) return new Date(Date.UTC(y, mo - 1, d));
    return 'invalid';
  }
  m = raw.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m) {
    const d = +m[1]; const mo = +m[2]; const y = +m[3];
    if (isValidDateParts(y, mo, d)) return new Date(Date.UTC(y, mo - 1, d));
    return 'invalid';
  }
  return 'invalid';
}

function isValidDateParts(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parseLevel(value: unknown): ClientLevel | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toUpperCase();
  if (!raw) return null;
  const map: Record<string, ClientLevel> = {
    BRONZE: ClientLevel.BRONZE,
    БРОНЗА: ClientLevel.BRONZE,
    SILVER: ClientLevel.SILVER,
    СЕРЕБРО: ClientLevel.SILVER,
    GOLD: ClientLevel.GOLD,
    ЗОЛОТО: ClientLevel.GOLD,
    DIAMOND: ClientLevel.DIAMOND,
    БРИЛЛИАНТ: ClientLevel.DIAMOND,
    АЛМАЗ: ClientLevel.DIAMOND,
  };
  return map[raw] ?? 'invalid';
}

@Injectable()
export class ClientsImportService {
  constructor(private prisma: PrismaService) {}

  async importFromFile(
    file: Express.Multer.File,
    userRole: string | undefined,
    organizationId: string,
    options: ImportClientsOptions = {},
  ): Promise<ImportClientsResult> {
    if (!isDeveloperRole(userRole)) {
      throw new BadRequestException('Импорт клиентов доступен только разработчику');
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
        'В файле не найдено ни одной строки. Проверьте заголовки: Имя, Фамилия, Телефон, Дата рождения...',
      );
    }

    const normalized: NormalizedRow[] = [];
    const details: ImportClientRowReport[] = [];

    for (const row of rows) {
      const result = this.normalizeRow(row);
      if ('error' in result) {
        details.push(result.error);
      } else {
        normalized.push(result.row);
      }
    }

    // Preload existing phones to detect duplicates cheaply.
    const existing = await this.prisma.client.findMany({
      where: { organizationId },
      select: { phone: true },
    });
    const existingPhones = new Set<string>();
    for (const e of existing) {
      existingPhones.add(normalizePhone(e.phone));
    }

    // Watch for duplicates inside the uploaded file itself.
    const seenInFile = new Set<string>();
    const isDryRun = !!options.dryRun;

    let created = 0;
    let skipped = 0;

    for (const row of normalized) {
      const phoneKey = row.phone; // уже нормализован

      if (existingPhones.has(phoneKey) || seenInFile.has(phoneKey)) {
        skipped++;
        details.push({
          row: row.rowNumber,
          status: 'skipped',
          phone: row.phone,
          name: [row.firstName, row.lastName].filter(Boolean).join(' '),
          reason: existingPhones.has(phoneKey)
            ? 'Клиент с таким телефоном уже есть в организации'
            : 'Дубликат телефона внутри файла',
        });
        continue;
      }

      if (isDryRun) {
        created++;
        seenInFile.add(phoneKey);
        details.push({
          row: row.rowNumber,
          status: 'created',
          phone: row.phone,
          name: [row.firstName, row.lastName].filter(Boolean).join(' '),
        });
        continue;
      }

      try {
        const referralCode = await this.generateReferralCode(organizationId);
        const data: Prisma.ClientUncheckedCreateInput = {
          id: generateId(IdPrefix.Client),
          organizationId,
          firstName: row.firstName,
          lastName: row.lastName ?? undefined,
          phone: row.phone,
          birthDate: row.birthDate ?? undefined,
          notes: row.notes ?? undefined,
          bonuses: row.bonuses,
          discount: row.discount,
          balance: row.balance,
          referralCode,
          ...(row.level && {
            level: row.level,
            levelSetManually: row.level === ClientLevel.DIAMOND,
          }),
        };
        await this.prisma.client.create({ data });
        existingPhones.add(phoneKey);
        seenInFile.add(phoneKey);
        created++;
        details.push({
          row: row.rowNumber,
          status: 'created',
          phone: row.phone,
          name: [row.firstName, row.lastName].filter(Boolean).join(' '),
        });
      } catch (err) {
        details.push({
          row: row.rowNumber,
          status: 'error',
          phone: row.phone,
          name: [row.firstName, row.lastName].filter(Boolean).join(' '),
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      dryRun: isDryRun,
      totalRows: rows.length,
      created,
      skipped,
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
    if (!sheetName) throw new BadRequestException('В файле нет листов');
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
      if (normalized) headerMap[key] = normalized;
    }

    return rawRows.map((row) => {
      const out: Record<string, unknown> = {};
      if (typeof (row as any).__rowNum__ === 'number') {
        (out as any).__rowNum__ = (row as any).__rowNum__;
      }
      for (const [orig, norm] of Object.entries(headerMap)) {
        out[norm] = row[orig];
      }
      return out;
    });
  }

  private normalizeRow(
    row: Record<string, unknown>,
  ): { row: NormalizedRow } | { error: ImportClientRowReport } {
    const rowNumber =
      typeof (row as any).__rowNum__ === 'number'
        ? ((row as any).__rowNum__ as number) + 1
        : 0;

    const firstName = String(row['firstName'] ?? '').trim();
    const lastName = (() => {
      const v = String(row['lastName'] ?? '').trim();
      return v === '' ? null : v;
    })();
    const phone = normalizePhone(row['phone']);
    const notes = (() => {
      const v = String(row['notes'] ?? '').trim();
      return v === '' ? null : v;
    })();

    if (!firstName && !phone) {
      return { error: { row: rowNumber, status: 'error', reason: 'Строка пустая' } };
    }
    if (!firstName) {
      return {
        error: { row: rowNumber, status: 'error', phone, reason: 'Не указано имя' },
      };
    }
    if (!phone) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          name: [firstName, lastName].filter(Boolean).join(' '),
          reason: 'Не указан телефон',
        },
      };
    }

    const birthDateResult = parseBirthDate(row['birthDate']);
    if (birthDateResult === 'invalid') {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: firstName,
          reason: `Некорректная дата рождения: "${row['birthDate']}"`,
        },
      };
    }

    const bonuses = parseInteger(row['bonuses']);
    const discount = parseInteger(row['discount']);
    const balance = parseInteger(row['balance']);

    if (bonuses !== null && bonuses < 0) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: firstName,
          reason: 'Бонусы не могут быть отрицательными',
        },
      };
    }
    if (discount !== null && (discount < 0 || discount > 100)) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: firstName,
          reason: 'Скидка должна быть в диапазоне 0-100',
        },
      };
    }
    if (balance !== null && balance < 0) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: firstName,
          reason: 'Баланс не может быть отрицательным',
        },
      };
    }

    const level = parseLevel(row['level']);
    if (level === 'invalid') {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: firstName,
          reason: `Некорректный уровень: "${row['level']}". Доступные: BRONZE, SILVER, GOLD, DIAMOND`,
        },
      };
    }

    return {
      row: {
        rowNumber,
        firstName,
        lastName,
        phone,
        birthDate: birthDateResult ?? null,
        notes,
        bonuses: bonuses ?? 0,
        discount: discount ?? 0,
        balance: balance ?? 0,
        level,
      },
    };
  }

  private async generateReferralCode(organizationId: string): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
      for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        code += REFERRAL_CODE_CHARS[bytes[i]! % REFERRAL_CODE_CHARS.length];
      }
      const existing = await this.prisma.client.findUnique({
        where: {
          organizationId_referralCode: { organizationId, referralCode: code },
        },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Не удалось сгенерировать уникальный реферальный код');
  }
}
