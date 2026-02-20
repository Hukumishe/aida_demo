import {
  Injectable,
  CanActivate,
  ExecutionContext,
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

    if (!studioId) {
      return true; // No studioId in route, skip check
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




