/** Нормализация телефона сотрудника / входа (KZ +7). */
export function normalizeStaffPhone(raw: string): string | null {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+7${digits}`;
  }
  if (trimmed.startsWith('+')) {
    return trimmed;
  }
  return trimmed;
}
