import { ForbiddenException } from '@nestjs/common';
import { UserRole } from './decorators/roles.decorator';

/** Телефон входа сотрудника: только владелец, зам, разработчик. */
export function canChangeStaffPhone(actorRole: string | undefined): boolean {
  return (
    actorRole === UserRole.OWNER ||
    actorRole === UserRole.DEPUTY_OWNER ||
    actorRole === UserRole.DEVELOPER
  );
}

export function assertCanChangeStaffPhone(actorRole: string | undefined): void {
  if (!canChangeStaffPhone(actorRole)) {
    throw new ForbiddenException(
      'Изменять телефон сотрудника могут только владелец, заместитель или разработчик',
    );
  }
}
