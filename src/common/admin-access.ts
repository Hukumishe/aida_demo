import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole } from './decorators/roles.decorator';

/** Админ филиала не видит общий список клиентов — только карточку из записи. */
export function assertAdminCannotBrowseClientList(userRole?: string): void {
  if (userRole === UserRole.ADMIN) {
    throw new ForbiddenException(
      'Администратору филиала недоступен общий список клиентов. Откройте карточку клиента из записи.',
    );
  }
}

/** Админ не редактирует профили и привязки мастеров (кроме смены телефона — см. assertAdminMasterStaffUpdate). */
export function assertAdminCannotEditMaster(
  actorRole: string | undefined,
  targetUserRole: string,
): void {
  if (actorRole === UserRole.ADMIN && targetUserRole === UserRole.MASTER) {
    throw new ForbiddenException('Администратор не может редактировать мастеров');
  }
}

/** Кто может менять телефон сотрудника (логин). */
export function assertCanChangeStaffPhone(actorRole: string | undefined): void {
  const allowed: string[] = [
    UserRole.DEVELOPER,
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.SERVICE,
    UserRole.ADMIN,
  ];
  if (!actorRole || !allowed.includes(actorRole)) {
    throw new ForbiddenException('Недостаточно прав для изменения телефона сотрудника');
  }
}

/**
 * Админ может PATCH мастера только с полем `phone`.
 * Владелец / зам / разработчик / SERVICE — без этого ограничения.
 */
export function assertAdminMasterStaffUpdate(
  actorRole: string | undefined,
  targetUserRole: string,
  dto: Record<string, unknown>,
): void {
  if (actorRole !== UserRole.ADMIN || targetUserRole !== UserRole.MASTER) {
    return;
  }
  const keys = Object.keys(dto).filter((k) => dto[k] !== undefined);
  if (keys.length === 0) {
    return;
  }
  if (keys.length === 1 && keys[0] === 'phone') {
    return;
  }
  throw new ForbiddenException('Администратор может изменить у мастера только номер телефона');
}
