import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ServiceAudience, WaitlistEntrySource } from '@prisma/client';
import {
  assertUserOrganizationMatchesStudio,
} from '../common/organization-scope';
import {
  getDisabledCategoryIdsForStudio,
  getDisabledServiceIdsForStudio,
} from '../common/service-studio-offering';
import { PrismaService } from '../common/prisma/prisma.service';
import { StudiosService } from '../studios/studios.service';
import { ClientsService } from '../clients/clients.service';
import { ServicesService } from '../services/services.service';
import { LandingService } from '../landing/landing.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { CreateClientDto } from '../clients/dto/create-client.dto';
import { UpdateClientDto } from '../clients/dto/update-client.dto';
import { CreateAppointmentDto } from '../appointments/dto/create-appointment.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';
import { NextbotSurveyDto } from './dto/nextbot-survey.dto';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  AvailabilityService,
  NEXTBOT_CHECK_AVAILABILITY_PROMPT,
} from '../availability/availability.service';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { PromptsService } from '../prompts/prompts.service';
import {
  VERIFY_CLIENT_STATUS_PROMPT_KEYS,
  VerifyClientVerificationStatus,
} from './verify-client-status.constants';

/** Фолбэк-промпт для get_service_categories, если в таблице prompts нет записи. */
export const NEXTBOT_GET_SERVICE_CATEGORIES_PROMPT = [
  'СИСТЕМНОЕ СООБЩЕНИЕ: Категории услуг успешно загружены в массиве "categories". Включай режим подбора процедур.',
  '',
  'ТВОИ ДЕЙСТВИЯ:',
  'ГЕНДЕРНАЯ ИДЕНТИФИКАЦИЯ (КРИТИЧНО): Студия обслуживает как женщин, так и мужчин, но расчет стоимости производится по разным прайсам. Если к тебе обращается новый клиент и его пол неочевиден, ты обязана напрямую, но максимально деликатно уточнить этот момент до начала подбора окон и озвучивания цен. Используй строго следующие формулировки:',
  '"Подскажите, вас интересует мужской или женский прайс?"',
  '"Вы планируете запись для себя или для мужчины?"',
  'ПРЕЗЕНТАЦИЯ КАТЕГОРИЙ: Озвучь клиенту доступные направления услуг, используя их названия из поля "name" в массиве "categories".',
  'ПРОВЕРКА ДОСТУПНОСТИ (КРИТИЧНО): В массиве "categories" у каждой услуги есть параметр "available_in" со списком ID филиалов. Если клиент выбрал услугу, которая доступна НЕ во всех студиях (например, только в одной), ты ОБЯЗАН предупредить его об этом и предложить только доступные варианты, опираясь на названия из справочника локаций в твоем базовом контексте.',
  'ПЕРЕХОД К ПРАЙСУ: Как только клиент определится с категорией (зафиксируй её "id") и ты будешь точно знать нужный прайс, вызывай функцию get_services_and_prices для получения конкретных услуг.',
].join('\n');

/**
 * Фолбэк-промпт для get_services_and_prices.
 * Бэкенд уже отдаёт уже отфильтрованный прайс (по студии, категории и полу),
 * поэтому инструкция — короткая и прямая.
 */
export const NEXTBOT_GET_SERVICES_AND_PRICES_PROMPT = [
  'СИСТЕМНОЕ СООБЩЕНИЕ: Отфильтрованный прайс-лист успешно загружен в массиве "data".',
  '',
  'ТВОИ ДЕЙСТВИЯ:',
  'ПРЕЗЕНТАЦИЯ УСЛУГ: Озвучь клиенту названия доступных процедур ("name") и их стоимость ("defaultPrice").',
  'ВЫБОР И ФИКСАЦИЯ: Помоги клиенту выбрать нужные услуги. Обязательно зафиксируй в памяти "id" выбранных услуг и их общую длительность ("defaultDurationMin") для дальнейшего расчета времени.',
  'ПЕРЕХОД К РАСПИСАНИЮ: После утверждения списка услуг, уточни у клиента пожелания по дате и времени визита, после чего вызывай функцию check_availability для проверки свободных окон.',
].join('\n');

/**
 * Фолбэк для update_old_client_profile (обновление данных существующего клиента до анкеты).
 * В панели промптов AIDA задайте свой текст по ключу `update_old_client_profile` для организации.
 */
export const NEXTBOT_UPDATE_OLD_CLIENT_PROFILE_PROMPT = [
  'СИСТЕМНОЕ СООБЩЕНИЕ: Профиль существующего клиента обновлён в CRM.',
  '',
  'СТРОГО ЗАПРЕЩЕНО: предлагать Welcome-бонус, бонусы за регистрацию или «подарки новому клиенту». Не поздравлять с первой регистрацией.',
  '',
  'ТВОИ ДЕЙСТВИЯ:',
  'Кратко подтверди, что контактные данные учтены.',
  'Переведи диалог к подбору услуги: предложи выбрать направление/услугу или перейти к записи.',
].join('\n');

/** Нормализация пола/аудитории из оркестратора в ServiceAudience (MEN/WOMEN). */
function parseAudience(raw?: string): ServiceAudience | undefined {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return undefined;
  if (['men', 'man', 'male', 'm', 'м', 'муж', 'мужской', 'мужчина'].includes(v)) {
    return ServiceAudience.MEN;
  }
  if (
    ['women', 'woman', 'female', 'f', 'w', 'ж', 'жен', 'женский', 'женщина'].includes(v)
  ) {
    return ServiceAudience.WOMEN;
  }
  return undefined;
}

/** Имена функций из системного промпта xmind (aida_xmind.pdf). */
export type NextbotXmindFunction =
  | 'add_to_waitlist'
  | 'request_manager_invoice'
  | 'generate_payment_link'
  | 'verify_receipt_nighttime'
  | 'purchase_certificate'
  | 'validate_certificate_code'
  | 'create_escalation_ticket'
  | 'dev_error_report'
  | 'process_survey_answers_failed';

@Injectable()
export class NextbotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studiosService: StudiosService,
    private readonly clientsService: ClientsService,
    private readonly servicesService: ServicesService,
    private readonly landingService: LandingService,
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
    private readonly promptsService: PromptsService,
  ) {}

  /**
   * Добавляет в ответ текст промпта с портала (таблица prompts) под ключом имени функции xmind.
   * Приоритет: промпт организации → глобальный (organizationId null) → fallback.
   * @param promptLookupKey — если задан, искать промпт по этому ключу в БД, а в JSON положить в `responseFieldKey`.
   */
  private async withNextbotPrompt<T extends Record<string, unknown>>(
    organizationId: string | undefined,
    responseFieldKey: string,
    data: T,
    fallback?: string,
    promptLookupKey?: string,
  ): Promise<T & Record<string, string>> {
    const lookupKey = promptLookupKey ?? responseFieldKey;
    let text = fallback ?? '';
    if (organizationId?.trim()) {
      const custom = await this.promptsService.getDescriptionForOrganization(
        organizationId.trim(),
        lookupKey,
      );
      if (custom != null && custom.trim() !== '') {
        text = custom;
      } else if (fallback !== undefined) {
        text = fallback;
      }
    } else if (fallback !== undefined) {
      text = fallback;
    }
    return { ...data, [responseFieldKey]: text } as T & Record<string, string>;
  }

  /** Есть ли у клиента день рождения в CRM (поле birthDate). */
  private clientHasBirthDate(client: Record<string, unknown>): boolean {
    const bd = client['birthDate'];
    if (bd == null) {
      return false;
    }
    if (typeof bd === 'string' && bd.trim() === '') {
      return false;
    }
    return true;
  }

  /** Заглушка: функция из xmind, в CRM ещё нет реализации. */
  notImplemented(fn: NextbotXmindFunction): never {
    throw new HttpException(
      {
        function: fn,
        code: 'NOT_IMPLEMENTED',
        message:
          'Эндпоинт зарезервирован под сценарий xmind; логика в backend ещё не реализована.',
      },
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  /** get_company_context — явный слой организации + список филиалов (у каждой студии своё organizationId в полях Prisma). */
  async getCompanyContext(user: CurrentUserPayload) {
    const studios = await this.studiosService.findAll(
      user.role,
      user.studioId,
      user.organizationId,
    );
    return this.withNextbotPrompt(user.organizationId, 'get_company_context', {
      organizationId: user.organizationId,
      studios,
    });
  }

  /** Без промпта — общая логика для verify / loyalty / referral. */
  private async resolveClientProfile(phone: string | undefined, user: CurrentUserPayload) {
    const list = await this.clientsService.findAll(
      phone,
      user.role,
      user.organizationId,
    );
    if (!list.length) {
      return null;
    }
    return this.clientsService.findOne(
      list[0].id,
      user.role,
      user.studioId,
      user.organizationId,
    );
  }

  /**
   * verify_client_status — промпт под ключом `verify_client_status` подбирается по сценарию
   * (ключи в БД: verify_client_status_not_found | …_with_birth_date | …_without_birth_date).
   */
  async verifyClient(phone: string | undefined, user: CurrentUserPayload) {
    const profile = await this.resolveClientProfile(phone, user);
    if (!profile) {
      return this.withNextbotPrompt(
        user.organizationId,
        'verify_client_status',
        {
          verificationStatus: VerifyClientVerificationStatus.NOT_FOUND,
          found: false,
          client: null as unknown as null,
        },
        undefined,
        VERIFY_CLIENT_STATUS_PROMPT_KEYS[VerifyClientVerificationStatus.NOT_FOUND],
      );
    }
    const c = profile as Record<string, unknown>;
    const hasBirth = this.clientHasBirthDate(c);
    const status = hasBirth
      ? VerifyClientVerificationStatus.FOUND_WITH_BIRTH_DATE
      : VerifyClientVerificationStatus.FOUND_WITHOUT_BIRTH_DATE;
    return this.withNextbotPrompt(
      user.organizationId,
      'verify_client_status',
      {
        verificationStatus: status,
        found: true,
        client: c,
      },
      undefined,
      VERIFY_CLIENT_STATUS_PROMPT_KEYS[status],
    );
  }

  /** check_loyalty_status */
  async loyaltySummary(phone: string | undefined, user: CurrentUserPayload) {
    const profile = await this.resolveClientProfile(phone, user);
    if (!profile) {
      return this.withNextbotPrompt(user.organizationId, 'check_loyalty_status', {
        found: false,
        clientId: null,
        level: null,
        bonuses: null,
        discount: null,
        rawClient: null,
      });
    }
    const c = profile as Record<string, unknown>;
    const ol = c['organizationLoyalty'] as { currentTier?: { name?: string } } | null | undefined;
    const slLegacy = c['studioLoyalty'] as { currentTier?: { name?: string } } | null | undefined;
    const loyaltyTierName = ol?.currentTier?.name ?? slLegacy?.currentTier?.name ?? null;
    return this.withNextbotPrompt(user.organizationId, 'check_loyalty_status', {
      found: true,
      clientId: c['id'],
      level: c['level'] ?? null,
      loyaltyTierName,
      bonuses: c['bonuses'] ?? null,
      discount: c['discount'] ?? null,
      rawClient: profile,
    });
  }

  /** get_referral_code */
  async referralSummary(phone: string | undefined, user: CurrentUserPayload) {
    const profile = await this.resolveClientProfile(phone, user);
    if (!profile) {
      return this.withNextbotPrompt(user.organizationId, 'get_referral_code', {
        found: false,
        clientId: null,
        referralCode: null,
        rawClient: null,
      });
    }
    const c = profile as Record<string, unknown>;
    return this.withNextbotPrompt(user.organizationId, 'get_referral_code', {
      found: true,
      clientId: c['id'],
      referralCode: c['referralCode'] ?? null,
      rawClient: profile,
    });
  }

  /** register_new_client */
  async registerClient(dto: CreateClientDto, user: CurrentUserPayload) {
    const created = await this.clientsService.create(
      dto,
      user.role,
      user.studioId,
      user.organizationId,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'register_new_client',
      created as unknown as Record<string, unknown>,
    );
  }

  /** update_old_client_profile — то же тело, что PATCH /clients/:id (UpdateClientDto) + промпт под ключом update_old_client_profile */
  async updateOldClientProfile(
    clientId: string,
    dto: UpdateClientDto,
    user: CurrentUserPayload,
    organizationIdQuery?: string,
  ) {
    const updated = await this.clientsService.update(
      clientId.trim(),
      dto,
      user.role,
      user.studioId,
      user.organizationId,
      organizationIdQuery?.trim() || undefined,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'update_old_client_profile',
      updated as unknown as Record<string, unknown>,
      NEXTBOT_UPDATE_OLD_CLIENT_PROFILE_PROMPT,
    );
  }

  /** process_survey_answers */
  async processSurvey(
    clientId: string,
    dto: NextbotSurveyDto,
    user: CurrentUserPayload,
  ) {
    const prefix = dto.surveyPrefix ?? '[NEXTBOT_SURVEY]';
    const block = `${prefix} ${JSON.stringify(dto.answers)}`;
    let newNotes = block;

    if (dto.mergeIntoNotes !== false) {
      const existing = await this.clientsService.findOne(
        clientId,
        user.role,
        user.studioId,
        user.organizationId,
      );
      const old = ((existing as { notes?: string | null }).notes ?? '').trim();
      newNotes = old ? `${old}\n\n${block}`.trim() : block;
    }

    const updated = await this.clientsService.update(
      clientId,
      { notes: newNotes },
      user.role,
      user.studioId,
      user.organizationId,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'process_survey_answers',
      updated as unknown as Record<string, unknown>,
    );
  }

  /**
   * get_services_and_prices — целевой срез прайса конкретной студии.
   *
   * Оркестратор уже собрал фильтры (studioId, organizationId, category, audience) и
   * передаёт их единым пакетом — бэкенд на своей стороне отсекает услуги, которые:
   *   • отключены в выбранном филиале (StudioDisabledService / StudioDisabledCategory);
   *   • помечены `isActive = false` у самой услуги или её категории;
   *   • не совпадают с выбранной категорией (принимается id или имя);
   *   • не совпадают с выбранной аудиторией (MEN / WOMEN).
   *
   * Боту возвращается минимальный набор полей: id, name, defaultPrice, defaultDurationMin.
   */
  async getServices(
    studioId: string,
    user: CurrentUserPayload,
    opts: { category?: string; audience?: string } = {},
  ) {
    await assertUserOrganizationMatchesStudio(
      this.prisma,
      studioId,
      user.organizationId,
      user.role,
    );

    const audience = parseAudience(opts.audience);
    const categoryRaw = (opts.category ?? '').trim();

    let categoryId: string | undefined;
    if (categoryRaw) {
      const byId = await this.prisma.serviceCategory.findFirst({
        where: {
          id: categoryRaw,
          organizationId: user.organizationId,
          isActive: true,
        },
        select: { id: true },
      });
      if (byId) {
        categoryId = byId.id;
      } else {
        const byName = await this.prisma.serviceCategory.findFirst({
          where: {
            organizationId: user.organizationId,
            isActive: true,
            name: { equals: categoryRaw, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (byName) {
          categoryId = byName.id;
        } else {
          // Категория не найдена — возвращаем пустой прайс, а не 404,
          // чтобы бот корректно отработал ответ через свой субпромпт.
          return this.withNextbotPrompt(
            user.organizationId,
            'get_services_and_prices',
            { data: [] },
            NEXTBOT_GET_SERVICES_AND_PRICES_PROMPT,
          );
        }
      }
    }

    const [disabledServiceIds, disabledCategoryIds] = await Promise.all([
      getDisabledServiceIdsForStudio(this.prisma, studioId),
      getDisabledCategoryIdsForStudio(this.prisma, studioId),
    ]);

    const services = await this.prisma.service.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        category: { isActive: true },
        ...(categoryId ? { categoryId } : {}),
        ...(audience ? { audience } : {}),
        ...(disabledServiceIds.size > 0
          ? { id: { notIn: Array.from(disabledServiceIds) } }
          : {}),
        ...(disabledCategoryIds.size > 0
          ? { categoryId: { notIn: Array.from(disabledCategoryIds) } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        defaultPrice: true,
        defaultDurationMin: true,
      },
      orderBy: [{ name: 'asc' }],
    });

    return this.withNextbotPrompt(
      user.organizationId,
      'get_services_and_prices',
      { data: services },
      NEXTBOT_GET_SERVICES_AND_PRICES_PROMPT,
    );
  }

  /** get_active_promotions */
  /**
   * get_service_categories — укрупнённые направления работы (категории услуг).
   * Возвращает активные категории организации + для каждой `available_in`
   * (филиалы сети, где категория НЕ отключена через StudioDisabledCategory).
   */
  async getServiceCategories(user: CurrentUserPayload) {
    const [categories, studios, disabled] = await Promise.all([
      this.prisma.serviceCategory.findMany({
        where: { organizationId: user.organizationId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.studio.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true },
      }),
      this.prisma.studioDisabledCategory.findMany({
        where: { studio: { organizationId: user.organizationId } },
        select: { studioId: true, categoryId: true },
      }),
    ]);

    const allStudioIds = studios.map((s) => s.id);
    const disabledByCategory = new Map<string, Set<string>>();
    for (const row of disabled) {
      if (!disabledByCategory.has(row.categoryId)) {
        disabledByCategory.set(row.categoryId, new Set());
      }
      disabledByCategory.get(row.categoryId)!.add(row.studioId);
    }

    const data = {
      categories: categories.map((c) => {
        const disabledSet = disabledByCategory.get(c.id) ?? new Set<string>();
        const availableIn = allStudioIds.filter((sid) => !disabledSet.has(sid));
        return {
          id: c.id,
          name: c.name,
          available_in: availableIn,
        };
      }),
    };

    return this.withNextbotPrompt(
      user.organizationId,
      'get_service_categories',
      data,
      NEXTBOT_GET_SERVICE_CATEGORIES_PROMPT,
    );
  }

  /**
   * get_active_promotions — акции действуют на всю организацию,
   * поэтому studioId не нужен. Фильтруем по `organizationId` из текущего пользователя / API-ключа.
   */
  async getPromotionsForOrganization(user: CurrentUserPayload) {
    const now = new Date();
    const rows = await this.prisma.landingPromotion.findMany({
      where: {
        organizationId: user.organizationId,
        isActive: true,
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        discountPercent: true,
        bundlePrice: true,
        validUntil: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Возвращаем боту только то, что нужно для диалога:
    // id, название, описание условий, тип, цена/скидка и дата окончания.
    const data = rows.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      type: p.type,
      discountPercent: p.type === 'DISCOUNT' ? p.discountPercent : null,
      bundlePrice:
        p.type === 'ONE_PLUS_ONE' || p.type === 'SERVICE_BUNDLE' ? p.bundlePrice : null,
      endsAt: p.validUntil,
    }));

    return this.withNextbotPrompt(user.organizationId, 'get_active_promotions', { data });
  }

  /**
   * check_availability — только свободные слоты + текст промпта для ИИ (`check_availability`).
   * Сырые расписания/записи не отдаются.
   */
  async availabilityRaw(
    studioId: string,
    date: string,
    staffUserId: string | undefined,
    user: CurrentUserPayload,
    options?: {
      serviceId?: string;
      durationMinutes?: number;
      slotStepMinutes?: number;
    },
  ) {
    if (
      !isOwnerLevelRole(user.role) &&
      user.role !== UserRole.MANAGER &&
      user.studioId !== studioId
    ) {
      throw new HttpException('Access denied to this studio', HttpStatus.FORBIDDEN);
    }
    if (user.role === UserRole.MASTER && staffUserId && staffUserId !== user.userId) {
      throw new HttpException('MASTER can only query own availability', HttpStatus.FORBIDDEN);
    }
    const effectiveStaffId =
      user.role === UserRole.MASTER ? user.userId : staffUserId;

    const slots = await this.availabilityService.computeNextbotFreeSlots(studioId, date, {
      staffUserId: effectiveStaffId ?? undefined,
      serviceId: options?.serviceId,
      durationMinutes: options?.durationMinutes,
      slotStepMinutes: options?.slotStepMinutes,
    });
    return this.withNextbotPrompt(
      user.organizationId,
      'check_availability',
      slots as unknown as Record<string, unknown>,
      NEXTBOT_CHECK_AVAILABILITY_PROMPT,
    );
  }

  /** create_booking_request */
  async createAppointment(
    studioId: string,
    dto: CreateAppointmentDto,
    user: CurrentUserPayload,
  ) {
    const created = await this.appointmentsService.create(
      studioId,
      {
        ...dto,
        preferWaitlist: true,
        waitlistSource: WaitlistEntrySource.NEXTBOT,
      },
      user.role,
      user.studioId,
      user.organizationId,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'create_booking_request',
      created as unknown as Record<string, unknown>,
    );
  }

  /**
   * modify_booking (в т.ч. перенос и отмена: `status: CANCELLED` в теле).
   * В xmind отмена/перенос не выделены отдельными функциями.
   */
  async modifyBooking(
    id: string,
    dto: UpdateAppointmentDto,
    user: CurrentUserPayload,
  ) {
    const updated = await this.appointmentsService.update(
      id,
      dto,
      user.role,
      user.studioId,
      user.userId,
      user.organizationId,
    );
    return this.withNextbotPrompt(
      user.organizationId,
      'modify_booking',
      updated as unknown as Record<string, unknown>,
    );
  }
}
