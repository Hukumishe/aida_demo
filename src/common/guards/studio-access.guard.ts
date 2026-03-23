import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, isOwnerLevelRole } from '../decorators/roles.decorator';

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

    // OWNER, DEPUTY_OWNER and MANAGER have access to all studios
    if (isOwnerLevelRole(user.role) || user.role === UserRole.MANAGER) {
      // Verify studio exists
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
      });
      if (!studio) {
        throw new NotFoundException(`Studio with ID ${studioId} not found`);
      }
      return true;
    }

    // ADMIN and MASTER can only access their own studio
    if (user.studioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    // Verify studio exists
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    return true;
  }
}




