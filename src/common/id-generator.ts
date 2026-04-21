import { customAlphabet } from 'nanoid';

// Читаемый алфавит: без 0/O, 1/l/I для минимизации путаницы
const alphabet = '23456789abcdefghjkmnpqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 10);

/** Префиксы для типов сущностей (по типу видно сущность в id) */
export const IdPrefix = {
  Organization: 'org',
  OrganizationFaq: 'ofq',
  Studio: 'stu',
  User: 'usr',
  Client: 'cli',
  Prompt: 'prm',
  WorkScheduleDay: 'wsd',
  BusySlot: 'bsy',
  Service: 'srv',
  ServiceCategory: 'sca',
  ServiceSubcategory: 'ssc',
  LandingPromotion: 'lpr',
  LandingPromotionService: 'lps',
  LandingPromotionCode: 'lpc',
  LandingMaster: 'lma',
  LandingServiceCard: 'lsc',
  StaffService: 'sts',
  StaffServiceOverride: 'sso',
  Appointment: 'apt',
  AppointmentServiceItem: 'asi',
  WaitlistEntry: 'wle',
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
  StudioLoyaltyTier: 'slt',
  StudioLoyaltyMilestone: 'slm',
  ClientStudioLoyalty: 'csl',
  StudioTask: 'stk',
  StudioTaskController: 'stc',
  StudioReferralLink: 'srl',
  DevTicket: 'dtk',
  DevTicketMessage: 'dtm',
} as const;

export type IdPrefixType = (typeof IdPrefix)[keyof typeof IdPrefix];

/**
 * Генерирует читаемый id с префиксом типа сущности.
 * Примеры: stu_a1b2c3d4e5, usr_xyz98abc12
 */
export function generateId(prefix: IdPrefixType): string {
  return `${prefix}_${nanoid()}`;
}

/** Регулярка для id из generateId: 3 буквы префикса + _ + nanoid(10) */
export const READABLE_ENTITY_ID_REGEX =
  /^[a-z]{3}_[23456789abcdefghjkmnpqrstuvwxyz]{10}$/;

export const READABLE_ENTITY_ID_MESSAGE =
  'must be a readable entity id (e.g. prd_abc12defgh3), not UUID';
