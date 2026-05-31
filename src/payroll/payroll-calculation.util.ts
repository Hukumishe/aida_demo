import {
  StaffPayrollBaseMode,
  StaffPayrollLineType,
  StaffPayrollRateMode,
} from '@prisma/client';

export type PayrollLineInput = {
  lineRef: string;
  lineType: StaffPayrollLineType;
  serviceId: string;
  serviceName: string;
  categoryId: string;
  categoryName: string;
  grossAmount: number;
};

export type PayrollSettingsSnapshot = {
  rateMode: StaffPayrollRateMode;
  baseMode: StaffPayrollBaseMode;
  unifiedPercent: number;
  categoryPercents: Map<string, number>;
  servicePercents: Map<string, number>;
};

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function resolvePercentForLine(
  settings: PayrollSettingsSnapshot,
  line: Pick<PayrollLineInput, 'serviceId' | 'categoryId'>,
): number {
  if (settings.rateMode === StaffPayrollRateMode.UNIFIED) {
    return clampPercent(settings.unifiedPercent);
  }
  if (settings.rateMode === StaffPayrollRateMode.BY_CATEGORY) {
    return clampPercent(settings.categoryPercents.get(line.categoryId) ?? 0);
  }
  return clampPercent(settings.servicePercents.get(line.serviceId) ?? 0);
}

/**
 * Распределяет сумму чека после скидок пропорционально прайсу строк.
 */
export function allocateDiscountedBases(
  lines: PayrollLineInput[],
  grossTotal: number,
  discountedTotal: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (lines.length === 0) {
    return result;
  }
  if (grossTotal <= 0) {
    for (const line of lines) {
      result.set(line.lineRef, 0);
    }
    return result;
  }
  if (discountedTotal <= 0) {
    for (const line of lines) {
      result.set(line.lineRef, 0);
    }
    return result;
  }

  let allocated = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === lines.length - 1) {
      result.set(line.lineRef, Math.max(0, discountedTotal - allocated));
    } else {
      const share = Math.round((line.grossAmount * discountedTotal) / grossTotal);
      result.set(line.lineRef, share);
      allocated += share;
    }
  }
  return result;
}

export function buildPayrollAccrualRows(
  settings: PayrollSettingsSnapshot,
  lines: PayrollLineInput[],
  grossTotal: number,
  discountedTotal: number,
): Array<{
  line: PayrollLineInput;
  grossLineAmount: number;
  baseAmount: number;
  percent: number;
  commissionAmount: number;
}> {
  const discountedBases =
    settings.baseMode === StaffPayrollBaseMode.WITH_DISCOUNTS
      ? allocateDiscountedBases(lines, grossTotal, discountedTotal)
      : null;

  return lines.map((line) => {
    const grossLineAmount = line.grossAmount;
    const baseAmount =
      settings.baseMode === StaffPayrollBaseMode.WITHOUT_DISCOUNTS
        ? grossLineAmount
        : (discountedBases?.get(line.lineRef) ?? 0);
    const percent = resolvePercentForLine(settings, line);
    const commissionAmount = Math.round((baseAmount * percent) / 100);
    return { line, grossLineAmount, baseAmount, percent, commissionAmount };
  });
}
