import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

function isValidIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Проверка строки как имени зоны IANA (Intl). Пустая строка — невалидна. */
export function IsIanaTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIanaTimezone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value === undefined || value === null) return true;
          if (typeof value !== 'string') return false;
          if (value.trim() === '') return false;
          return isValidIanaTimeZone(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid IANA time zone identifier`;
        },
      },
    });
  };
}
