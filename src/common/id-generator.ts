import { customAlphabet } from 'nanoid';

// Читаемый алфавит: без 0/O, 1/l/I для минимизации путаницы
const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 10);

/** Префиксы для типов сущностей (по типу видно сущность в id) */
export const IdPrefix = {
  Studio: 'stu',
  User: 'usr',
  Client: 'cli',
  Prompt: 'prm',
  WorkScheduleDay: 'wsd',
  BusySlot: 'bsy',
  Service: 'srv',
  LandingPromotion: 'lpr',
  LandingPromotionService: 'lps',
  LandingPromotionCode: 'lpc',
  LandingMaster: 'lma',
  LandingServiceCard: 'lsc',
  StaffService: 'sts',
  StaffServiceOverride: 'sso',
  Appointment: 'apt',
  AppointmentUpsell: 'ups',
  Log: 'log',
  NoShowIncome: 'nsi',
  Notification: 'ntf',
  BlacklistRequest: 'blr',
  BonusHistoryEntry: 'bhe',
  Warehouse: 'whs',
  Product: 'prd',
  Transfer: 'trf',
  StockMovement: 'stm',
} as const;

export type IdPrefixType = (typeof IdPrefix)[keyof typeof IdPrefix];

/**
 * Генерирует читаемый id с префиксом типа сущности.
 * Примеры: stu_a1b2c3d4e5, usr_xyz98abc12
 */
export function generateId(prefix: IdPrefixType): string {
  return `${prefix}_${nanoid()}`;
}
