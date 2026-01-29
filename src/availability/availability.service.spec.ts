import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { ConflictException as CustomConflictException } from '../common/exceptions/conflict.exception';

describe('AvailabilityService', () => {
  let service: AvailabilityService;
  let prisma: PrismaService;

  const mockPrismaService = {
    workScheduleDay: {
      findUnique: jest.fn(),
    },
    busySlot: {
      findFirst: jest.fn(),
    },
    appointment: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvailabilityService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AvailabilityService>(AvailabilityService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAppointmentAvailability', () => {
    const studioId = 'studio-1';
    const staffUserId = 'staff-1';
    const startAt = new Date('2024-01-15T10:00:00Z');
    const endAt = new Date('2024-01-15T11:00:00Z');

    it('should throw if no schedule exists', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue(null);

      await expect(
        service.checkAppointmentAvailability(studioId, staffUserId, startAt, endAt),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should throw if day is off', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: true,
        startTime: '09:00',
        endTime: '18:00',
      });

      await expect(
        service.checkAppointmentAvailability(studioId, staffUserId, startAt, endAt),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should throw if appointment is outside work hours', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: false,
        startTime: '09:00',
        endTime: '18:00',
      });

      const earlyStart = new Date('2024-01-15T08:00:00Z');
      const earlyEnd = new Date('2024-01-15T09:00:00Z');

      await expect(
        service.checkAppointmentAvailability(studioId, staffUserId, earlyStart, earlyEnd),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should throw if appointment overlaps with break', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: false,
        startTime: '09:00',
        endTime: '18:00',
        breakStart: '13:00',
        breakEnd: '14:00',
      });

      const breakStart = new Date('2024-01-15T13:00:00Z');
      const breakEnd = new Date('2024-01-15T13:30:00Z');

      await expect(
        service.checkAppointmentAvailability(studioId, staffUserId, breakStart, breakEnd),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should throw if appointment overlaps with busy slot', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: false,
        startTime: '09:00',
        endTime: '18:00',
      });

      mockPrismaService.busySlot.findFirst.mockResolvedValue({
        id: 'busy-1',
        startAt: new Date('2024-01-15T10:00:00Z'),
        endAt: new Date('2024-01-15T11:00:00Z'),
      });

      await expect(
        service.checkAppointmentAvailability(studioId, staffUserId, startAt, endAt),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should throw if appointment overlaps with another appointment', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: false,
        startTime: '09:00',
        endTime: '18:00',
      });

      mockPrismaService.busySlot.findFirst.mockResolvedValue(null);
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        id: 'appointment-1',
        startAt: new Date('2024-01-15T10:00:00Z'),
        endAt: new Date('2024-01-15T11:00:00Z'),
      });

      await expect(
        service.checkAppointmentAvailability(studioId, staffUserId, startAt, endAt),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should pass if appointment is available', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: false,
        startTime: '09:00',
        endTime: '18:00',
      });

      mockPrismaService.busySlot.findFirst.mockResolvedValue(null);
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.checkAppointmentAvailability(studioId, staffUserId, startAt, endAt),
      ).resolves.not.toThrow();
    });
  });

  describe('checkBusySlotAllowed', () => {
    const studioId = 'studio-1';
    const staffUserId = 'staff-1';
    const startAt = new Date('2024-01-15T10:00:00Z');
    const endAt = new Date('2024-01-15T12:00:00Z');

    it('should throw if no schedule exists', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue(null);

      await expect(
        service.checkBusySlotAllowed(studioId, staffUserId, startAt, endAt),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should throw if day is off', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: true,
        startTime: '09:00',
        endTime: '18:00',
      });

      await expect(
        service.checkBusySlotAllowed(studioId, staffUserId, startAt, endAt),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should throw if busy slot is outside work hours', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: false,
        startTime: '09:00',
        endTime: '18:00',
      });

      const earlyStart = new Date('2024-01-15T08:00:00Z');
      const earlyEnd = new Date('2024-01-15T08:30:00Z');

      await expect(
        service.checkBusySlotAllowed(studioId, staffUserId, earlyStart, earlyEnd),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should throw if busy slot overlaps with break', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: false,
        startTime: '09:00',
        endTime: '18:00',
        breakStart: '13:00',
        breakEnd: '14:00',
      });

      const breakStart = new Date('2024-01-15T13:00:00Z');
      const breakEnd = new Date('2024-01-15T13:30:00Z');

      await expect(
        service.checkBusySlotAllowed(studioId, staffUserId, breakStart, breakEnd),
      ).rejects.toThrow(CustomConflictException);
    });

    it('should pass if busy slot is allowed', async () => {
      mockPrismaService.workScheduleDay.findUnique.mockResolvedValue({
        isDayOff: false,
        startTime: '09:00',
        endTime: '18:00',
      });

      await expect(
        service.checkBusySlotAllowed(studioId, staffUserId, startAt, endAt),
      ).resolves.not.toThrow();
    });
  });
});

