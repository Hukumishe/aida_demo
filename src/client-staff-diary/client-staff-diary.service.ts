import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateId, IdPrefix } from '../common/id-generator';
import {
  UserRole,
  canUseClientStaffDiary,
  canViewAllClientStaffDiaryEntries,
} from '../common/decorators/roles.decorator';
import { assertUserOrganizationMatchesStudio } from '../common/organization-scope';
import { CreateClientStaffDiaryEntryDto } from './dto/create-client-staff-diary-entry.dto';
import { UpdateClientStaffDiaryEntryDto } from './dto/update-client-staff-diary-entry.dto';
import { mapClientStaffDiaryEntry } from './client-staff-diary.util';

const diaryInclude = {
  staff: {
    select: {
      id: true,
      staffProfile: {
        select: { firstName: true, lastName: true },
      },
    },
  },
} as const;

@Injectable()
export class ClientStaffDiaryService {
  constructor(private readonly prisma: PrismaService) {}

  private assertDiaryRole(userRole?: string) {
    if (!canUseClientStaffDiary(userRole)) {
      throw new ForbiddenException('Access denied to client staff diary');
    }
  }

  private async loadAppointmentForDiary(appointmentId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        studioId: true,
        clientId: true,
        staffUserId: true,
        studio: { select: { organizationId: true } },
      },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${appointmentId} not found`);
    }
    return appointment;
  }

  private async assertAppointmentDiaryReadAccess(
    appointment: {
      studioId: string;
      staffUserId: string;
      studio: { organizationId: string };
    },
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
    userOrganizationId?: string,
  ) {
    this.assertDiaryRole(userRole);
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      appointment.studioId,
      userOrganizationId,
      userRole,
    );

    if (canViewAllClientStaffDiaryEntries(userRole)) {
      return;
    }

    if (userRole !== UserRole.MASTER) {
      throw new ForbiddenException('Access denied to this appointment diary');
    }
    if (userStudioId !== appointment.studioId) {
      throw new ForbiddenException('Access denied to this appointment');
    }
    if (!userStaffId || userStaffId !== appointment.staffUserId) {
      throw new ForbiddenException('Masters can read diary only for their own appointments');
    }
  }

  async listForAppointment(
    appointmentId: string,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
    userOrganizationId?: string,
  ) {
    const appointment = await this.loadAppointmentForDiary(appointmentId);
    await this.assertAppointmentDiaryReadAccess(
      appointment,
      userRole,
      userStudioId,
      userStaffId,
      userOrganizationId,
    );

    const where = {
      clientId: appointment.clientId,
      organizationId: appointment.studio.organizationId,
      ...(canViewAllClientStaffDiaryEntries(userRole)
        ? {}
        : { staffUserId: userStaffId! }),
    };

    const [items, myNotesCount] = await Promise.all([
      this.prisma.clientStaffDiaryEntry.findMany({
        where,
        include: diaryInclude,
        orderBy: { createdAt: 'desc' },
      }),
      userRole === UserRole.MASTER && userStaffId
        ? this.prisma.clientStaffDiaryEntry.count({
            where: {
              clientId: appointment.clientId,
              organizationId: appointment.studio.organizationId,
              staffUserId: userStaffId,
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      items: items.map((entry) =>
        mapClientStaffDiaryEntry(entry, canViewAllClientStaffDiaryEntries(userRole)),
      ),
      myNotesCount,
    };
  }

  async createForAppointment(
    appointmentId: string,
    dto: CreateClientStaffDiaryEntryDto,
    userRole?: string,
    userStudioId?: string,
    userStaffId?: string,
    userOrganizationId?: string,
  ) {
    if (userRole !== UserRole.MASTER) {
      throw new ForbiddenException('Only masters can create diary entries');
    }
    if (!userStaffId) {
      throw new ForbiddenException('Staff context required');
    }

    const appointment = await this.loadAppointmentForDiary(appointmentId);
    await this.assertAppointmentDiaryReadAccess(
      appointment,
      userRole,
      userStudioId,
      userStaffId,
      userOrganizationId,
    );

    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException('Diary entry body is required');
    }

    const entry = await this.prisma.clientStaffDiaryEntry.create({
      data: {
        id: generateId(IdPrefix.ClientStaffDiaryEntry),
        organizationId: appointment.studio.organizationId,
        clientId: appointment.clientId,
        staffUserId: userStaffId,
        appointmentId: appointment.id,
        body,
      },
      include: diaryInclude,
    });

    return mapClientStaffDiaryEntry(entry, false);
  }

  async listForClient(
    clientId: string,
    userRole?: string,
    userOrganizationId?: string,
    organizationIdQuery?: string,
  ) {
    if (!canViewAllClientStaffDiaryEntries(userRole)) {
      throw new ForbiddenException('Only owner or deputy can view all diary entries');
    }

    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, organizationId: true },
    });
    if (!client) {
      throw new NotFoundException(`Client with ID ${clientId} not found`);
    }

    if (userRole === UserRole.DEVELOPER && organizationIdQuery?.trim()) {
      if (client.organizationId !== organizationIdQuery.trim()) {
        throw new NotFoundException(`Client with ID ${clientId} not found`);
      }
    } else if (
      userOrganizationId?.trim() &&
      client.organizationId !== userOrganizationId.trim()
    ) {
      throw new ForbiddenException('Access denied to this client');
    }

    const items = await this.prisma.clientStaffDiaryEntry.findMany({
      where: {
        clientId: client.id,
        organizationId: client.organizationId,
      },
      include: diaryInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      items: items.map((entry) => mapClientStaffDiaryEntry(entry, true)),
    };
  }

  async update(
    id: string,
    dto: UpdateClientStaffDiaryEntryDto,
    userRole?: string,
    userStaffId?: string,
  ) {
    if (userRole !== UserRole.MASTER) {
      throw new ForbiddenException('Only masters can edit their diary entries');
    }
    if (!userStaffId) {
      throw new ForbiddenException('Staff context required');
    }

    const existing = await this.prisma.clientStaffDiaryEntry.findUnique({
      where: { id },
      include: diaryInclude,
    });
    if (!existing) {
      throw new NotFoundException('Diary entry not found');
    }
    if (existing.staffUserId !== userStaffId) {
      throw new ForbiddenException('You can edit only your own diary entries');
    }

    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException('Diary entry body is required');
    }

    const entry = await this.prisma.clientStaffDiaryEntry.update({
      where: { id },
      data: { body },
      include: diaryInclude,
    });

    return mapClientStaffDiaryEntry(entry, false);
  }

  async remove(id: string, userRole?: string, userStaffId?: string) {
    if (userRole !== UserRole.MASTER) {
      throw new ForbiddenException('Only masters can delete their diary entries');
    }
    if (!userStaffId) {
      throw new ForbiddenException('Staff context required');
    }

    const existing = await this.prisma.clientStaffDiaryEntry.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Diary entry not found');
    }
    if (existing.staffUserId !== userStaffId) {
      throw new ForbiddenException('You can delete only your own diary entries');
    }

    await this.prisma.clientStaffDiaryEntry.delete({ where: { id } });
    return { success: true };
  }
}
