import { ForbiddenException } from '@nestjs/common';
import { UserRole } from './decorators/roles.decorator';

/** Мастер не редактирует графики работы (только просмотр своего). */
export function assertMasterCannotEditWorkSchedule(userRole?: string): void {
  if (userRole === UserRole.MASTER) {
    throw new ForbiddenException('Мастер не может изменять графики работы');
  }
}
