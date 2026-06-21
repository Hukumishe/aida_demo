import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  UserRole,
  isDeveloperRole,
  isMarketerRole,
} from '../common/decorators/roles.decorator';
import { generateId, IdPrefix } from '../common/id-generator';
import { CreateFaqItemDto } from './dto/create-faq-item.dto';
import { UpdateFaqItemDto } from './dto/update-faq-item.dto';
import { ReorderFaqItemsDto } from './dto/reorder-faq-items.dto';

/**
 * CRUD и публичная выдача FAQ организации.
 *
 * Редактировать FAQ могут роли:
 *   - OWNER (владелец сети)
 *   - DEPUTY_OWNER (заместитель владельца)
 *   - MARKETER (маркетолог)
 *   - DEVELOPER (платформенный разработчик, кросс-тенант)
 * Остальные роли (ADMIN, MANAGER, MASTER, SERVICE) на запись не имеют доступа.
 * DEVELOPER, как и везде в системе, может работать с чужой организацией через
 * query-параметр `?organizationId=`.
 */
@Injectable()
export class FaqService {
  constructor(private prisma: PrismaService) {}

  /** OWNER, DEPUTY, MARKETER, DEVELOPER — без SERVICE (как было). */
  private canEditFaq(role: string | undefined): boolean {
    return (
      isDeveloperRole(role) ||
      role === UserRole.OWNER ||
      role === UserRole.DEPUTY_OWNER ||
      isMarketerRole(role)
    );
  }

  /** Гарант организационного контекста + кросс-тенант override для DEVELOPER. */
  private async resolveOrganizationId(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    organizationIdQuery: string | undefined,
  ): Promise<string> {
    if (isDeveloperRole(userRole) && organizationIdQuery?.trim()) {
      const organizationId = organizationIdQuery.trim();
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true },
      });
      if (!org) {
        throw new NotFoundException(
          `Organization with ID ${organizationId} not found`,
        );
      }
      return organizationId;
    }
    if (!userOrganizationId?.trim()) {
      throw new BadRequestException('Organization context required');
    }
    return userOrganizationId.trim();
  }

  private assertCanEdit(role: string | undefined) {
    if (!this.canEditFaq(role)) {
      throw new ForbiddenException(
        'Редактировать FAQ могут только владелец, заместитель, маркетолог или разработчик',
      );
    }
  }

  private normalizeCategory(raw: string | null | undefined): string | null | undefined {
    if (raw === undefined) return undefined;
    if (raw === null) return null;
    const trimmed = raw.trim();
    return trimmed === '' ? null : trimmed;
  }

  /** Публичный список (для лендинга): только опубликованные, в своём порядке. */
  async listPublic(organizationId: string) {
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId is required');
    }
    return this.prisma.organizationFaq.findMany({
      where: { organizationId, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        sortOrder: true,
      },
    });
  }

  /** Админский список: все элементы (включая черновики). */
  async listAdmin(organizationId: string) {
    return this.prisma.organizationFaq.findMany({
      where: { organizationId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async create(organizationId: string, dto: CreateFaqItemDto) {
    const question = dto.question.trim();
    const answer = dto.answer.trim();
    if (!question) {
      throw new BadRequestException('question не может быть пустым');
    }
    if (!answer) {
      throw new BadRequestException('answer не может быть пустым');
    }

    const category = this.normalizeCategory(dto.category) ?? null;

    const sortOrder = await this.resolveSortOrder(organizationId, dto.sortOrder);

    return this.prisma.organizationFaq.create({
      data: {
        id: generateId(IdPrefix.OrganizationFaq),
        organizationId,
        question,
        answer,
        category,
        isPublished: dto.isPublished ?? true,
        sortOrder,
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateFaqItemDto) {
    const existing = await this.prisma.organizationFaq.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException(`FAQ item ${id} not found`);
    }

    const data: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(dto, 'question')) {
      const q = (dto.question ?? '').trim();
      if (!q) throw new BadRequestException('question не может быть пустым');
      data.question = q;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'answer')) {
      const a = (dto.answer ?? '').trim();
      if (!a) throw new BadRequestException('answer не может быть пустым');
      data.answer = a;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'category')) {
      data.category = this.normalizeCategory(dto.category) ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'isPublished')) {
      data.isPublished = Boolean(dto.isPublished);
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'sortOrder')) {
      data.sortOrder = dto.sortOrder;
    }

    return this.prisma.organizationFaq.update({
      where: { id },
      data,
    });
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.prisma.organizationFaq.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });
    if (!existing || existing.organizationId !== organizationId) {
      throw new NotFoundException(`FAQ item ${id} not found`);
    }
    await this.prisma.organizationFaq.delete({ where: { id } });
    return { ok: true, id };
  }

  async reorder(organizationId: string, dto: ReorderFaqItemsDto) {
    if (!dto.items.length) {
      throw new BadRequestException('items is empty');
    }
    const ids = dto.items.map((i) => i.id);
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new BadRequestException('Повторяющиеся id в items');
    }
    const owned = await this.prisma.organizationFaq.findMany({
      where: { id: { in: ids }, organizationId },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new NotFoundException(
        'Один или несколько FAQ-элементов не найдены в этой организации',
      );
    }

    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.organizationFaq.update({
          where: { id: i.id },
          data: { sortOrder: i.sortOrder },
        }),
      ),
    );

    return this.listAdmin(organizationId);
  }

  /**
   * Публичный метод-обёртка: проверяет роль и кросс-тенант, затем вызывает
   * соответствующий CRUD. Контроллер использует её, чтобы не дублировать
   * проверки на каждом эндпоинте.
   */
  async resolveOrganizationAndAssertCanEdit(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    organizationIdQuery: string | undefined,
  ): Promise<string> {
    this.assertCanEdit(userRole);
    return this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );
  }

  async resolveOrganizationForRead(
    userRole: string | undefined,
    userOrganizationId: string | undefined,
    organizationIdQuery: string | undefined,
  ): Promise<string> {
    // Публичный GET тоже ходит через этот хелпер, но там organizationIdQuery
    // обязателен и не требуется JWT — эту ветку обрабатывает контроллер.
    return this.resolveOrganizationId(
      userRole,
      userOrganizationId,
      organizationIdQuery,
    );
  }

  private async resolveSortOrder(
    organizationId: string,
    requested: number | undefined,
  ): Promise<number> {
    if (requested !== undefined && requested !== null) {
      return requested;
    }
    const last = await this.prisma.organizationFaq.findFirst({
      where: { organizationId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    return last ? last.sortOrder + 10 : 10;
  }
}
