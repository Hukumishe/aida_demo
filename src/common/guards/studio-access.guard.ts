import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../decorators/roles.decorator';

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

    // OWNER has access to all studios
    if (user.role === UserRole.OWNER) {
      // Verify studio exists
      const studio = await this.prisma.studio.findUnique({
        where: { id: studioId },
      });
      if (!studio) {
        throw new NotFoundException(`Studio with ID ${studioId} not found`);
      }
      return true;
    }

    // MANAGER and MASTER can only access their own studio
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

