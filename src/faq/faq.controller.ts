import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { FaqService } from './faq.service';
import { CreateFaqItemDto } from './dto/create-faq-item.dto';
import { UpdateFaqItemDto } from './dto/update-faq-item.dto';
import { ReorderFaqItemsDto } from './dto/reorder-faq-items.dto';

/**
 * FAQ организации.
 *
 * Публичные эндпоинты (для лендинга):
 *   GET /landing/faq?organizationId=...  — список опубликованных элементов.
 *
 * Админские эндпоинты (роли OWNER, DEPUTY_OWNER, MARKETER и DEVELOPER):
 *   GET    /admin/faq                  — все элементы (включая черновики)
 *   POST   /admin/faq                  — создать элемент
 *   PATCH  /admin/faq/:id              — обновить
 *   DELETE /admin/faq/:id              — удалить
 *   PATCH  /admin/faq/reorder          — bulk drag-and-drop
 *
 * DEVELOPER может работать с чужой организацией, передав `?organizationId=`
 * в query. Для других ролей organizationId берётся из JWT.
 */
@ApiTags('faq')
@Controller()
export class FaqController {
  constructor(
    private readonly faqService: FaqService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Достаёт organizationId из JWT без падения, чтобы админка-владелец могла
   * использовать тот же публичный GET (и видеть только свою организацию) не
   * пробрасывая query явно. Повторяем паттерн из LandingController.
   */
  private tryGetOrganizationIdFromBearer(req: Request): string | undefined {
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) return undefined;
    const token = auth.slice(7).trim();
    if (!token) return undefined;
    try {
      const payload = this.jwtService.verify<{ organizationId?: string }>(token);
      const orgId = (payload?.organizationId ?? '').trim();
      return orgId || undefined;
    } catch {
      return undefined;
    }
  }

  // --- PUBLIC ---

  @Public()
  @Get('landing/faq')
  @ApiOperation({
    summary: 'Публичный FAQ организации для лендинга',
    description:
      'Возвращает только опубликованные элементы, отсортированные по sortOrder. ' +
      'Лендинг передаёт `?organizationId=`. Админка с JWT может не передавать — ' +
      'organizationId будет взят из токена.',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description:
      'ID организации. Обязателен для публичных вызовов без JWT. Если пользователь ' +
      'авторизован (Bearer-токен), можно не передавать — возьмём из токена.',
  })
  @ApiResponse({ status: 200, description: 'Список опубликованных FAQ' })
  async listPublic(
    @Query('organizationId') organizationId: string | undefined,
    @Req() req: Request,
  ) {
    let orgId = (organizationId ?? '').trim();
    if (!orgId) {
      orgId = this.tryGetOrganizationIdFromBearer(req) ?? '';
    }
    if (!orgId) {
      throw new BadRequestException(
        'organizationId is required (query parameter or Bearer JWT with organizationId)',
      );
    }
    return this.faqService.listPublic(orgId);
  }

  // --- ADMIN ---

  @Get('admin/faq')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.MARKETER,
    UserRole.DEVELOPER,
  )
  @ApiOperation({
    summary: 'Админский список FAQ (включая черновики)',
    description:
      'Возвращает все элементы FAQ организации, включая неопубликованные. ' +
      'Доступно ролям OWNER, DEPUTY_OWNER, MARKETER, DEVELOPER.',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER — id чужой организации.',
  })
  @ApiResponse({ status: 200, description: 'Полный список FAQ' })
  async listAdmin(
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user: any,
  ) {
    const organizationId = await this.faqService.resolveOrganizationAndAssertCanEdit(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.faqService.listAdmin(organizationId);
  }

  @Post('admin/faq')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.MARKETER,
    UserRole.DEVELOPER,
  )
  @ApiOperation({ summary: 'Создать элемент FAQ' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER — id чужой организации.',
  })
  @ApiResponse({ status: 201, description: 'Элемент создан' })
  async create(
    @Body() dto: CreateFaqItemDto,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user: any,
  ) {
    const organizationId = await this.faqService.resolveOrganizationAndAssertCanEdit(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.faqService.create(organizationId, dto);
  }

  @Patch('admin/faq/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.MARKETER,
    UserRole.DEVELOPER,
  )
  @ApiOperation({
    summary: 'Массово обновить порядок FAQ (drag-and-drop)',
    description:
      'Фронт присылает финальный массив { id, sortOrder } для всех элементов. ' +
      'Бэкенд валидирует принадлежность всех id к организации пользователя, ' +
      'затем обновляет в транзакции. Возвращает полный админский список.',
  })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER — id чужой организации.',
  })
  @ApiResponse({ status: 200, description: 'Порядок обновлён, возвращён новый список' })
  async reorder(
    @Body() dto: ReorderFaqItemsDto,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user: any,
  ) {
    const organizationId = await this.faqService.resolveOrganizationAndAssertCanEdit(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.faqService.reorder(organizationId, dto);
  }

  @Patch('admin/faq/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.MARKETER,
    UserRole.DEVELOPER,
  )
  @ApiOperation({ summary: 'Обновить элемент FAQ' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER — id чужой организации.',
  })
  @ApiResponse({ status: 200, description: 'Элемент обновлён' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFaqItemDto,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user: any,
  ) {
    const organizationId = await this.faqService.resolveOrganizationAndAssertCanEdit(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.faqService.update(organizationId, id, dto);
  }

  @Delete('admin/faq/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(
    UserRole.OWNER,
    UserRole.DEPUTY_OWNER,
    UserRole.MARKETER,
    UserRole.DEVELOPER,
  )
  @ApiOperation({ summary: 'Удалить элемент FAQ' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    description: 'Только DEVELOPER — id чужой организации.',
  })
  @ApiResponse({ status: 200, description: 'Элемент удалён' })
  async delete(
    @Param('id') id: string,
    @Query('organizationId') organizationIdQuery: string | undefined,
    @CurrentUser() user: any,
  ) {
    const organizationId = await this.faqService.resolveOrganizationAndAssertCanEdit(
      user?.role,
      user?.organizationId,
      organizationIdQuery,
    );
    return this.faqService.delete(organizationId, id);
  }
}
