import {
  StaffPayrollBaseMode,
  StaffPayrollLineType,
  StaffPayrollRateMode,
} from '@prisma/client';

export const PAYROLL_RATE_MODE_LABELS: Record<StaffPayrollRateMode, string> = {
  [StaffPayrollRateMode.UNIFIED]: 'Единый процент',
  [StaffPayrollRateMode.BY_CATEGORY]: 'По категориям услуг',
  [StaffPayrollRateMode.BY_SERVICE]: 'По услугам',
};

export const PAYROLL_BASE_MODE_LABELS: Record<StaffPayrollBaseMode, string> = {
  [StaffPayrollBaseMode.WITH_DISCOUNTS]: 'С учётом скидок и акций',
  [StaffPayrollBaseMode.WITHOUT_DISCOUNTS]: 'Без учёта скидок и акций',
};

export const PAYROLL_LINE_TYPE_LABELS: Record<StaffPayrollLineType, string> = {
  [StaffPayrollLineType.PRIMARY_SERVICE]: 'Основная услуга',
  [StaffPayrollLineType.UPSELL]: 'Допродажа',
};
