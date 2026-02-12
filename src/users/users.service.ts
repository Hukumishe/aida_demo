import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { UserRole } from '../common/decorators/roles.decorator';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(studioId: string, userRole: string, userStudioId?: string) {
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    return this.prisma.user.findMany({
      where: {
        studioId,
        role: {
          in: [UserRole.MANAGER, UserRole.MASTER],
        },
      },
      include: {
        staffProfile: true,
        staffServices: {
          include: {
            service: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(
    studioId: string,
    createStaffDto: CreateStaffDto,
    userRole: string,
    userStudioId?: string,
  ) {
    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== studioId) {
      throw new ForbiddenException('Access denied to this studio');
    }

    // Verify studio exists
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
    });
    if (!studio) {
      throw new NotFoundException(`Studio with ID ${studioId} not found`);
    }

    // Validate role
    if (createStaffDto.role === UserRole.OWNER) {
      throw new BadRequestException('Cannot create OWNER role via this endpoint');
    }

    // Check email/phone uniqueness
    if (createStaffDto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: createStaffDto.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    if (createStaffDto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: createStaffDto.phone },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone already exists');
      }
    }

    const passwordHash = await bcrypt.hash(createStaffDto.password, 10);

    return this.prisma.user.create({
      data: {
        email: createStaffDto.email,
        phone: createStaffDto.phone,
        passwordHash,
        role: createStaffDto.role,
        studioId,
        staffProfile: {
          create: {
            firstName: createStaffDto.firstName,
            lastName: createStaffDto.lastName,
            title: createStaffDto.title,
            category: createStaffDto.category,
            providesServices: createStaffDto.providesServices ?? true,
          },
        },
      },
      include: {
        staffProfile: true,
      },
    });
  }

  async update(
    userId: string,
    updateStaffDto: UpdateStaffDto,
    userRole: string,
    userStudioId?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== user.studioId) {
      throw new ForbiddenException('Access denied to this user');
    }

    // Cannot change OWNER role
    if (updateStaffDto.role === UserRole.OWNER && user.role !== UserRole.OWNER) {
      throw new BadRequestException('Cannot change role to OWNER');
    }

    // Check email/phone uniqueness
    if (updateStaffDto.email && updateStaffDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateStaffDto.email },
      });
      if (existingEmail) {
        throw new BadRequestException('Email already exists');
      }
    }

    if (updateStaffDto.phone && updateStaffDto.phone !== user.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: updateStaffDto.phone },
      });
      if (existingPhone) {
        throw new BadRequestException('Phone already exists');
      }
    }

    const updateData: any = {
      email: updateStaffDto.email,
      phone: updateStaffDto.phone,
      role: updateStaffDto.role,
      isActive: updateStaffDto.isActive,
    };

    if (updateStaffDto.password) {
      updateData.passwordHash = await bcrypt.hash(updateStaffDto.password, 10);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...updateData,
        staffProfile: updateStaffDto.firstName ||
          updateStaffDto.lastName !== undefined ||
          updateStaffDto.title !== undefined ||
          updateStaffDto.category !== undefined ||
          updateStaffDto.providesServices !== undefined
          ? {
              update: {
                firstName: updateStaffDto.firstName,
                lastName: updateStaffDto.lastName,
                title: updateStaffDto.title,
                category: updateStaffDto.category,
                providesServices: updateStaffDto.providesServices,
              },
            }
          : undefined,
      },
      include: {
        staffProfile: true,
      },
    });
  }

  async addService(
    staffUserId: string,
    serviceId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
      include: { studio: true },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

    // Verify service exists and belongs to same studio
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      throw new NotFoundException(`Service with ID ${serviceId} not found`);
    }

    if (service.studioId !== staff.studioId) {
      throw new BadRequestException('Service does not belong to the same studio');
    }

    // Check if already exists
    const existing = await this.prisma.staffService.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId: staff.studioId!,
          staffUserId,
          serviceId,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Service is already assigned to this staff member');
    }

    // Create staff service
    return this.prisma.staffService.create({
      data: {
        studioId: staff.studioId!,
        staffUserId,
        serviceId,
      },
      include: {
        service: true,
      },
    });
  }

  async removeService(
    staffUserId: string,
    serviceId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

    // Find and delete staff service
    const staffService = await this.prisma.staffService.findUnique({
      where: {
        studioId_staffUserId_serviceId: {
          studioId: staff.studioId!,
          staffUserId,
          serviceId,
        },
      },
    });

    if (!staffService) {
      throw new NotFoundException('Service is not assigned to this staff member');
    }

    return this.prisma.staffService.delete({
      where: { id: staffService.id },
    });
  }

  async getStaffServices(
    staffUserId: string,
    userRole: string,
    userStudioId?: string,
  ) {
    // Get staff user
    const staff = await this.prisma.user.findUnique({
      where: { id: staffUserId },
    });

    if (!staff) {
      throw new NotFoundException(`Staff member with ID ${staffUserId} not found`);
    }

    // Check access
    if (userRole !== UserRole.OWNER && userStudioId !== staff.studioId) {
      throw new ForbiddenException('Access denied to this staff member');
    }

    return this.prisma.staffService.findMany({
      where: {
        staffUserId,
      },
      include: {
        service: true,
      },
      orderBy: {
        service: {
          name: 'asc',
        },
      },
    });
  }
}




