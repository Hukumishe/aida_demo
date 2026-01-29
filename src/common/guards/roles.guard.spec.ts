import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY, UserRole } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockExecutionContext = (user: any, requiredRoles?: UserRole[]): ExecutionContext => {
    const mockReflector = {
      getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
    };

    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow access if no roles required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockExecutionContext({ role: UserRole.MANAGER });
    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow access if user has required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER, UserRole.MANAGER]);

    const context = createMockExecutionContext({ role: UserRole.MANAGER });
    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if user does not have required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);

    const context = createMockExecutionContext({ role: UserRole.MANAGER });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user is not authenticated', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.OWNER]);

    const context = createMockExecutionContext(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

