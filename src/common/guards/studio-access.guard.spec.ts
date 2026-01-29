import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudioAccessGuard } from './studio-access.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '../decorators/roles.decorator';

describe('StudioAccessGuard', () => {
  let guard: StudioAccessGuard;
  let prisma: PrismaService;

  const mockPrismaService = {
    studio: {
      findUnique: jest.fn(),
    },
  };

  const createMockExecutionContext = (params: any, user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          params,
          user,
        }),
      }),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudioAccessGuard,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    guard = module.get<StudioAccessGuard>(StudioAccessGuard);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access if no studioId in route', async () => {
    const context = createMockExecutionContext({}, { role: UserRole.MANAGER, studioId: 'studio-1' });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow OWNER to access any studio', async () => {
    mockPrismaService.studio.findUnique.mockResolvedValue({ id: 'studio-1', name: 'Studio 1' });

    const context = createMockExecutionContext(
      { studioId: 'studio-1' },
      { role: UserRole.OWNER },
    );
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw NotFoundException if studio does not exist (OWNER)', async () => {
    mockPrismaService.studio.findUnique.mockResolvedValue(null);

    const context = createMockExecutionContext(
      { studioId: 'studio-1' },
      { role: UserRole.OWNER },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('should allow MANAGER to access their own studio', async () => {
    mockPrismaService.studio.findUnique.mockResolvedValue({ id: 'studio-1', name: 'Studio 1' });

    const context = createMockExecutionContext(
      { studioId: 'studio-1' },
      { role: UserRole.MANAGER, studioId: 'studio-1' },
    );
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if MANAGER tries to access different studio', async () => {
    const context = createMockExecutionContext(
      { studioId: 'studio-2' },
      { role: UserRole.MANAGER, studioId: 'studio-1' },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow MASTER to access their own studio', async () => {
    mockPrismaService.studio.findUnique.mockResolvedValue({ id: 'studio-1', name: 'Studio 1' });

    const context = createMockExecutionContext(
      { studioId: 'studio-1' },
      { role: UserRole.MASTER, studioId: 'studio-1' },
    );
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if MASTER tries to access different studio', async () => {
    const context = createMockExecutionContext(
      { studioId: 'studio-2' },
      { role: UserRole.MASTER, studioId: 'studio-1' },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException if studio does not exist (MANAGER/MASTER)', async () => {
    mockPrismaService.studio.findUnique.mockResolvedValue(null);

    const context = createMockExecutionContext(
      { studioId: 'studio-1' },
      { role: UserRole.MANAGER, studioId: 'studio-1' },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });
});

