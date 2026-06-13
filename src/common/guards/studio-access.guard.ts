import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, isDeveloperRole, isOwnerLevelRole } from '../decorators/roles.decorator';
import { staffWorksAtStudio } from '../staff-studio-membership';

@Injectable()
export class StudioAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const studioId = request.params.studioId;

    // If no studioId in route params, skip studio access check
    // The service layer will handle access control based on the resource (client, appointment, etc.)
    if (!studioId) {
      return true;
    }

    // Документация использует {studioId}; Nextbot иногда шлёт шаблон буквально (подстановка не сработала)
    let decodedStudioParam = studioId;
    try {
      if (studioId.includes('%')) decodedStudioParam = decodeURIComponent(studioId);
    } catch {
      /* ignore */
    }
    const literalDoubleBrace = /^\{\{[^{}]+\}\}$/.test(decodedStudioParam);
    if (
      studioId.includes('{') ||
      studioId.includes('}') ||
      /^STUDIO_ID$/i.test(studioId) ||
      /^your[_-]?studio/i.test(studioId)
    ) {
      const templateHint = literalDoubleBrace
        ? ' В запрос ушло буквально «{{…}}»: переменная Nextbot не подставилась (пустое значение, другое имя переменной или в этой версии Nextbot другой синтаксис в URL — см. справку платформы). Заполните переменную до вызова или используйте способ подстановки, который реально обрабатывает ваш конструктор.'
        : '';
      throw new BadRequestException(
        'В URL попал плейсхолдер вместо реального id студии (например "{studioId}" или "{{studioId}}"). ' +
          'Сначала вызовите GET /nextbot/context, возьмите поле id нужной студии и подставьте в путь.' +
          templateHint,
      );
    }

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // DEVELOPER: любой существующий филиал (кросс-тенантный доступ)
    if (isDeveloperRole(user.role)) {
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
        select: { id: true },
      });
      if (!studio) {
        throw new NotFoundException(`Studio with ID ${studioId} not found`);
      }
      return true;
    }

    // OWNER, DEPUTY_OWNER and MANAGER: студии только своей организации
    if (isOwnerLevelRole(user.role) || user.role === UserRole.MANAGER) {
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
        select: { id: true, organizationId: true },
      });
      if (!studio) {
        throw new NotFoundException(`Studio with ID ${studioId} not found`);
      }
      if (studio.organizationId !== user.organizationId) {
        throw new ForbiddenException('Access denied to this studio');
      }
      return true;
    }

    // ADMIN and MASTER: основной филиал или user_studio_memberships (мульти-филиал)
    if (user.role === UserRole.ADMIN || user.role === UserRole.MASTER) {
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
        select: { id: true, organizationId: true },
      });
      if (!studio) {
        throw new NotFoundException(`Studio with ID ${studioId} not found`);
      }
      if (studio.organizationId !== user.organizationId) {
        throw new ForbiddenException('Access denied to this studio');
      }

      const userId = user.userId ?? user.sub;
      if (!userId) {
        throw new ForbiddenException('User not authenticated');
      }
      if (user.studioId === studioId) {
        return true;
      }
      const worksAtStudio = await staffWorksAtStudio(this.prisma, userId, studioId);
      if (!worksAtStudio) {
        throw new ForbiddenException('Access denied to this studio');
      }
      return true;
    }

    throw new ForbiddenException('Access denied to this studio');
  }
}




