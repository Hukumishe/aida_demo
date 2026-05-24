import { ForbiddenException } from '@nestjs/common';
import { UserRole } from './decorators/roles.decorator';

/** Админ филиала не видит общий список клиентов — только карточку из записи. */
export function assertAdminCannotBrowseClientList(userRole?: string): void {
  if (userRole === UserRole.ADMIN) {
    throw new ForbiddenException(
      'Администратору филиала недоступен общий список клиентов. Откройте карточку клиента из записи.',
    );
  }
}

/** Админ не редактирует профили и привязки мастеров. */
export function assertAdminCannotEditMaster(
  actorRole: string | undefined,
  targetUserRole: string,
): void {
  if (actorRole === UserRole.ADMIN && targetUserRole === UserRole.MASTER) {
    throw new ForbiddenException('Администратор не может редактировать мастеров');
  }
}
