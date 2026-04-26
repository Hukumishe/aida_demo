import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as crypto from 'crypto';
import { ClientGender, ClientLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import { isDeveloperRole } from '../common/decorators/roles.decorator';

export interface ImportClientsOptions {
  dryRun?: boolean;
  defaultRegistrationSource?: string;
  overridePerRowSources?: Record<number, string>;
}

export interface ImportClientRowReport {
  row: number;
  status: 'created' | 'skipped' | 'error';
  phone?: string;
  name?: string;
  reason?: string;
  registrationSourceResolved?: string | null;
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
  patronymic: string | null;
  instagram: string | null;
  phone: string;
  gender: ClientGender | null;
  birthDate: Date | null;
  notes: string | null;
  legacyVisitsCount: number | null;
  legacyLastVisitDate: Date | null;
  registrationSource: string | null;
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
  'имя клиента': 'firstName',

  фамилия: 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',
  'фамилия клиента': 'lastName',

  отчество: 'patronymic',
  patronymic: 'patronymic',
  middlename: 'patronymic',
  'middle name': 'patronymic',

  инстаграм: 'instagram',
  instagram: 'instagram',
  ig: 'instagram',

  телефон: 'phone',
  phone: 'phone',
  номер: 'phone',
  'номер телефона': 'phone',
  mobile: 'phone',
  'мобильный номер': 'phone',
  'номер мобильного': 'phone',
  'телефон клиента': 'phone',

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

  пол: 'gender',
  gender: 'gender',
  sex: 'gender',

  источник: 'registrationSource',
  source: 'registrationSource',
  'registration source': 'registrationSource',

  'количество записей': 'legacyVisitsCount',
  'последний визит': 'legacyLastVisitDate',
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

function normalizeRegistrationSource(value: unknown): string | null | 'invalid' {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.length > 100) return 'invalid';
  return raw;
}

function buildImportMetaNote(visitsCount: number | null, lastVisitDate: Date | null): string | null {
  const parts: string[] = [];
  if (visitsCount !== null) {
    parts.push(`Количество записей (старая база): ${visitsCount}`);
  }
  if (lastVisitDate) {
    parts.push(`Последний визит (старая база): ${lastVisitDate.toISOString().slice(0, 10)}`);
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join('\n');
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

function parseGender(value: unknown): ClientGender | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  if (['-', '—', 'не указано', 'unknown', 'none', 'null'].includes(raw)) return null;
  if (['m', 'male', 'муж', 'мужчина', 'мужской', 'м'].includes(raw)) {
    return ClientGender.MALE;
  }
  if (['f', 'w', 'female', 'жен', 'женщина', 'женский', 'ж'].includes(raw)) {
    return ClientGender.FEMALE;
  }
  return 'invalid';
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

  private resolvePerRowSourceOverrides(
    sourceMap: Record<number, string> | undefined,
  ): Map<number, string> {
    const out = new Map<number, string>();
    if (!sourceMap) {
      return out;
    }
    for (const [rowRaw, value] of Object.entries(sourceMap)) {
      const rowNumber = Number(rowRaw);
      if (!Number.isInteger(rowNumber) || rowNumber < 1) {
        throw new BadRequestException(
          'overridePerRowSources: ключи должны быть номерами строк Excel (целые числа >= 1)',
        );
      }
      const normalized = normalizeRegistrationSource(value);
      if (normalized === 'invalid') {
        throw new BadRequestException(
          `overridePerRowSources[${rowNumber}]: источник длиннее 100 символов`,
        );
      }
      if (normalized) {
        out.set(rowNumber, normalized);
      }
    }
    return out;
  }

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
    const defaultSource = normalizeRegistrationSource(options.defaultRegistrationSource);
    if (defaultSource === 'invalid') {
      throw new BadRequestException('defaultRegistrationSource длиннее 100 символов');
    }
    const sourceOverrides = this.resolvePerRowSourceOverrides(
      options.overridePerRowSources,
    );

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
      const sourceResolved =
        sourceOverrides.get(row.rowNumber) ??
        row.registrationSource ??
        defaultSource ??
        null;
      const importMetaNote = buildImportMetaNote(
        row.legacyVisitsCount,
        row.legacyLastVisitDate,
      );
      const resolvedNotes = [row.notes, importMetaNote].filter(Boolean).join('\n');

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
          registrationSourceResolved: sourceResolved,
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
          registrationSourceResolved: sourceResolved,
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
          patronymic: row.patronymic ?? undefined,
          instagram: row.instagram ?? undefined,
          phone: row.phone,
          gender: row.gender ?? undefined,
          birthDate: row.birthDate ?? undefined,
          notes: resolvedNotes || undefined,
          bonuses: row.bonuses,
          discount: row.discount,
          balance: row.balance,
          registrationSource: sourceResolved ?? undefined,
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
          registrationSourceResolved: sourceResolved,
        });
      } catch (err) {
        details.push({
          row: row.rowNumber,
          status: 'error',
          phone: row.phone,
          name: [row.firstName, row.lastName].filter(Boolean).join(' '),
          reason: err instanceof Error ? err.message : String(err),
          registrationSourceResolved: sourceResolved,
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
    const patronymic = (() => {
      const v = String(row['patronymic'] ?? '').trim();
      return v === '' ? null : v;
    })();
    const instagram = (() => {
      const v = String(row['instagram'] ?? '').trim();
      return v === '' ? null : v;
    })();
    const phone = normalizePhone(row['phone']);
    const notes = (() => {
      const v = String(row['notes'] ?? '').trim();
      return v === '' ? null : v;
    })();
    const legacyVisitsCount = parseInteger(row['legacyVisitsCount']);
    const legacyLastVisitDateResult = parseBirthDate(row['legacyLastVisitDate']);
    const registrationSource = (() => {
      const parsed = normalizeRegistrationSource(row['registrationSource']);
      if (parsed === 'invalid') return 'invalid' as const;
      return parsed;
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
    if (registrationSource === 'invalid') {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: [firstName, lastName].filter(Boolean).join(' '),
          reason: 'Источник длиннее 100 символов',
        },
      };
    }
    if (legacyVisitsCount !== null && legacyVisitsCount < 0) {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: [firstName, lastName].filter(Boolean).join(' '),
          reason: 'Количество записей не может быть отрицательным',
        },
      };
    }
    if (legacyLastVisitDateResult === 'invalid') {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: [firstName, lastName].filter(Boolean).join(' '),
          reason: `Некорректная дата последнего визита: "${row['legacyLastVisitDate']}"`,
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

    const gender = parseGender(row['gender']);
    if (gender === 'invalid') {
      return {
        error: {
          row: rowNumber,
          status: 'error',
          phone,
          name: firstName,
          reason: `Некорректный пол: "${row['gender']}". Доступные: MALE, FEMALE (или "мужчина"/"женщина", пусто = не указано)`,
        },
      };
    }

    return {
      row: {
        rowNumber,
        firstName,
        lastName,
        patronymic,
        instagram,
        phone,
        gender,
        birthDate: birthDateResult ?? null,
        notes,
        legacyVisitsCount,
        legacyLastVisitDate: legacyLastVisitDateResult ?? null,
        registrationSource,
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
