/** Переменные для текста шаблона автосообщения Nextbot (подстановка `{{key}}`). */
export const NEXTBOT_AUTO_MESSAGE_VARIABLES = [
  {
    key: 'name',
    label: 'Имя клиента',
    description: 'firstName клиента',
    example: 'Анна',
  },
  {
    key: 'patronymic',
    label: 'Отчество',
    description: 'patronymic клиента',
    example: 'Петровна',
  },
  {
    key: 'lastName',
    label: 'Фамилия',
    description: 'lastName клиента',
    example: 'Иванова',
  },
  {
    key: 'phone',
    label: 'Телефон',
    description: 'Телефон клиента',
    example: '+77001234567',
  },
  {
    key: 'service',
    label: 'Услуга',
    description: 'Основная услуга записи (первая в списке)',
    example: 'Маникюр классический',
  },
  {
    key: 'services',
    label: 'Услуги',
    description: 'Все услуги записи через запятую',
    example: 'Маникюр, покрытие',
  },
  {
    key: 'category',
    label: 'Категория',
    description: 'Категория услуги записи',
    example: 'Маникюр',
  },
  {
    key: 'studio',
    label: 'Филиал',
    description: 'Название филиала записи',
    example: 'Beauty Lab Абая',
  },
  {
    key: 'appointmentDate',
    label: 'Дата записи',
    description: 'Дата начала записи (локаль филиала)',
    example: '25.05.2026',
  },
  {
    key: 'appointmentTime',
    label: 'Время записи',
    description: 'Время начала записи (локаль филиала)',
    example: '14:30',
  },
  {
    key: 'master',
    label: 'Мастер',
    description: 'Имя мастера записи',
    example: 'Мария',
  },
  {
    key: 'comment',
    label: 'Комментарий к записи',
    description: 'Комментарий из карточки визита (поле comment записи)',
    example: 'Просит мастера Майру',
  },
  {
    key: 'prepayment',
    label: 'Предоплата',
    description: 'Сумма предоплаты в тенге (если указана)',
    example: '4000',
  },
] as const;

export type NextbotAutoMessageVariableKey =
  (typeof NEXTBOT_AUTO_MESSAGE_VARIABLES)[number]['key'];

const VARIABLE_KEYS = new Set<string>(
  NEXTBOT_AUTO_MESSAGE_VARIABLES.map((v) => v.key),
);

/** Подстановка `{{key}}` в текст шаблона. Неизвестные ключи остаются как есть. */
export function renderNextbotAutoMessageTemplate(
  template: string,
  values: Partial<Record<NextbotAutoMessageVariableKey, string | null | undefined>>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (match, key: string) => {
    if (!VARIABLE_KEYS.has(key)) return match;
    const raw = values[key as NextbotAutoMessageVariableKey];
    if (raw == null || String(raw).trim() === '') return '';
    return String(raw);
  });
}
