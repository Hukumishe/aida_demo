import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  RemotePaymentMethod,
  ServiceAudience,
  TaskStatus,
} from '@prisma/client';
import { generateId, IdPrefix } from '../common/id-generator';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestManagerInvoiceDto } from './dto/request-manager-invoice.dto';
import { VerifyReceiptNighttimeDto } from './dto/verify-receipt-nighttime.dto';
import { CreateEscalationTicketDto } from './dto/create-escalation-ticket.dto';
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
import { LinkNextbotDialogDto } from './dto/link-nextbot-dialog.dto';
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
import {
  DEFAULT_IANA_TIMEZONE,
  organizationTimezone,
} from '../common/effective-timezone';

/** Фолбэк-промпт для get_service_categories, если в таблице prompts нет записи. */
export const NEXTBOT_GET_SERVICE_CATEGORIES_PROMPT = [
  'СИСТЕМНОЕ СООБЩЕНИЕ: Категории услуг успешно загружены в массиве "categories". Включай режим подбора процедур.',
  '',
  'ТВОИ ДЕЙСТВИЯ:',
  'ГЕНДЕРНАЯ ИДЕНТИФИКАЦИЯ (КРИТИЧНО): Студия обслуживает как женщин, так и мужчин, но расчет стоимости производится по разным прайсам. Если к тебе обращается новый клиент и его пол неочевиден, ты обязана напрямую, но максимально деликатно уточнить этот момент до начала подбора окон и озвучивания цен. Используй строго следующие формулировки:',
  '"Подскажите, вас интересует мужской или женский прайс?"',
  '"Вы планируете запись для себя или для мужчины?"',
  'ПРЕЗЕНТАЦИЯ КАТЕГОРИЙ: Озвучь клиенту доступные направления услуг, используя их названия из поля "name" в массиве "categories".',
  'ПРОВЕРКА ДОСТУПНОСТИ (КРИТИЧНО): В массиве "categories" у каждой услуги есть параметры "available_in" (ID филиалов) и "available_in_studios" (объекты с id и name). Если клиент выбрал услугу, которая доступна НЕ во всех студиях (например, только в одной), ты ОБЯЗАН предупредить его об этом и предложить только доступные варианты.',
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

export const NEXTBOT_CREATE_ESCALATION_TICKET_PROMPT = [
  'СИСТЕМНОЕ СООБЩЕНИЕ: сложный кейс клиента зафиксирован и передан менеджерам.',
  '',
  'ТВОИ ДЕЙСТВИЯ:',
  'Прояви эмпатию и поблагодари за обращение.',
  'Подтверди, что обращение передано ответственным менеджерам.',
  'Сообщи, что менеджер вернётся с ответом в ближайшее рабочее время.',
  'Вежливо предложи написать дополнительные детали в этом чате.',
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

/**
 * Безопасные дефолты таймингов Nextbot-потока оплаты на случай,
 * если в Organization соответствующие поля ещё не заполнены.
 * Значения можно переопределять в CRM (вкладка «Маркетинг», настройки студии).
 */
export const NEXTBOT_DEFAULT_NIGHT_HOLD_MINUTES = 30;
export const NEXTBOT_DEFAULT_DAY_INVOICE_TASK_DEADLINE_HOURS = 2;
export const NEXTBOT_DEFAULT_NIGHT_RECEIPT_TASK_DEADLINE_HOURS = 12;

/**
 * Обрезает значение в разумный диапазон. Возвращает fallback, если значение не число,
 * не конечное, вне [min, max] или null/undefined. Используется для чтения настроек
 * таймингов из Organization, чтобы ни при каких условиях не выставить некорректный дедлайн.
 */
function clampOrDefault(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value == null || !Number.isFinite(value)) return fallback;
  if (value < min) return fallback;
  if (value > max) return fallback;
  return Math.floor(value);
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
    private readonly notificationsService: NotificationsService,
  ) {}

  private formatClientName(client: {
    firstName?: string | null;
    lastName?: string | null;
    patronymic?: string | null;
  }): string {
    const fullName = [client.firstName, client.lastName, client.patronymic]
      .map((v) => (v ?? '').trim())
      .filter(Boolean)
      .join(' ');
    return fullName || 'Имя не указано';
  }

  private formatAppointmentServices(appointment: {
    service?: { name?: string | null } | null;
    serviceItems?: Array<{ service?: { name?: string | null } | null }> | null;
  }): string {
    const names = new Set<string>();
    for (const item of appointment.serviceItems ?? []) {
      const name = item.service?.name?.trim();
      if (name) names.add(name);
    }
    const fallbackServiceName = appointment.service?.name?.trim();
    if (names.size === 0 && fallbackServiceName) {
      names.add(fallbackServiceName);
    }
    return Array.from(names).join(', ') || 'Услуга не указана';
  }

  /**
   * Добавляет в ответ текст промпта с портала (таблица prompts) под ключом имени функции xmind.
   * Приоритет: промпт организации → глобальный (organizationId null) → fallback.
   * @param promptLookupKey — если задан, искать промпт по этому ключу в БД, а в JSON положить в `responseFieldKey`.
   */
  /** Текст промпта из панели (prompts.key) → fallback. */
  private async resolveNextbotPrompt(
    organizationId: string | undefined,
    lookupKey: string,
    fallback?: string,
  ): Promise<string> {
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
    return text;
  }

  private async withNextbotPrompt<T extends Record<string, unknown>>(
    organizationId: string | undefined,
    responseFieldKey: string,
    data: T,
    fallback?: string,
    promptLookupKey?: string,
  ): Promise<T & Record<string, string>> {
    const lookupKey = promptLookupKey ?? responseFieldKey;
    const text = await this.resolveNextbotPrompt(
      organizationId,
      lookupKey,
      fallback,
    );
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

  /** Убираем поля, которые не должны уходить в Nextbot-контекст. */
  private sanitizeClientForNextbot(client: Record<string, unknown>): Record<string, unknown> {
    const { discount, ...safeClient } = client;
    return safeClient;
  }

  private parseNextbotDialogId(raw: string | number | undefined): number | undefined {
    if (raw == null || raw === '') return undefined;
    const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
    if (!Number.isFinite(n) || n < 1) return undefined;
    return Math.trunc(n);
  }

  private async saveNextbotDialogId(
    clientId: string,
    organizationId: string,
    dialogId: number,
  ): Promise<void> {
    await this.prisma.client.updateMany({
      where: { id: clientId, organizationId },
      data: { nextbotDialogId: dialogId },
    });
  }

  private normalizePhoneDigits(raw: string | undefined): string {
    const src = String(raw ?? '').trim();
    if (!src) return '';
    return src.replace(/\D/g, '');
  }

  /**
   * Пул активных менеджеров организации для общих задач Nextbot.
   * Первый менеджер становится assignee, остальные — controllers.
   */
  private async getOrganizationManagerPool(organizationId: string) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        role: UserRole.MANAGER,
        isActive: true,
      },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, studioId: true },
    });
  }

  /** Кандидаты формата телефона для быстрого exact-поиска (без тяжёлого contains). */
  private phoneLookupCandidates(raw: string | undefined): string[] {
    const original = String(raw ?? '').trim();
    const digits = this.normalizePhoneDigits(raw);
    if (!original && !digits) return [];
    const out: string[] = [];
    const push = (v: string) => {
      const t = v.trim();
      if (t && !out.includes(t)) out.push(t);
    };

    if (digits) {
      push(digits);
      push(`+${digits}`);
      if (digits.startsWith('8') && digits.length === 11) {
        const d7 = `7${digits.slice(1)}`;
        push(d7);
        push(`+${d7}`);
      }
      if (digits.startsWith('7') && digits.length === 11) {
        push(`8${digits.slice(1)}`);
      }
    }
    push(original);
    return out;
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

  /**
   * create_escalation_ticket.
   *
   * Создаёт ОДНУ задачу уровня организации для всех менеджеров:
   * - назначается одному менеджеру (assignee),
   * - остальные менеджеры добавляются как контролёры,
   * - любой менеджер организации может завершить задачу на своей стороне задач.
   */
  async createEscalationTicket(
    dto: CreateEscalationTicketDto,
    user: CurrentUserPayload,
  ) {
    const issueSummary = (dto.issueSummary ?? '').trim();
    if (!issueSummary) {
      throw new BadRequestException('issueSummary is required');
    }

    const managers = await this.getOrganizationManagerPool(user.organizationId);
    if (managers.length === 0) {
      throw new BadRequestException('No active MANAGER in organization');
    }

    const assignee = managers[0]!;
    const phone = (dto.phone ?? '').trim();
    const description = [
      issueSummary,
      phone ? `Телефон клиента: ${phone}` : null,
      'Источник: Nextbot escalation ticket',
    ]
      .filter(Boolean)
      .join('\n\n');

    const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const task = await this.prisma.studioTask.create({
      data: {
        id: generateId(IdPrefix.StudioTask),
        organizationId: user.organizationId,
        title: 'Эскалация клиента: требуется менеджер',
        description,
        assigneeUserId: assignee.id,
        createdByUserId: assignee.id,
        deadlineAt,
        status: TaskStatus.OPEN,
        controllers: {
          create: managers
            .filter((m) => m.id !== assignee.id)
            .map((m) => ({
              id: generateId(IdPrefix.StudioTaskController),
              userId: m.id,
            })),
        },
      },
    });

    // Уведомляем назначенного менеджера, если у него есть studioId для контекста уведомления.
    if (assignee.studioId) {
      try {
        await this.notificationsService.createNewTaskNotification(
          assignee.studioId,
          task.id,
          assignee.id,
          task.title,
          deadlineAt,
        );
      } catch {
        // Не прерываем основной поток при сбое уведомлений.
      }
    }

    return this.withNextbotPrompt(
      user.organizationId,
      'create_escalation_ticket',
      {
        taskId: task.id,
        sharedForManagers: true,
      },
      NEXTBOT_CREATE_ESCALATION_TICKET_PROMPT,
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
      studios,
    });
  }

  /** Без промпта — общая логика для verify / loyalty / referral. */
  private async resolveClientProfile(phone: string | undefined, user: CurrentUserPayload) {
    const candidates = this.phoneLookupCandidates(phone);
    for (const candidate of candidates) {
      const quick = await this.prisma.client.findFirst({
        where: {
          organizationId: user.organizationId,
          isBlacklisted: false,
          phone: candidate,
        },
        select: { id: true },
      });
      if (quick?.id) {
        return this.clientsService.findOne(
          quick.id,
          user.role,
          user.studioId,
          user.organizationId,
        );
      }
    }

    // Fallback на legacy contains-поиск для совместимости со старыми данными.
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
  async verifyClient(
    phone: string | undefined,
    user: CurrentUserPayload,
    dialogIdRaw?: string | number,
  ) {
    let profile = await this.resolveClientProfile(phone, user);
    const dialogId = this.parseNextbotDialogId(dialogIdRaw);
    if (profile && dialogId) {
      const clientId = String((profile as Record<string, unknown>)['id'] ?? '');
      if (clientId) {
        await this.saveNextbotDialogId(clientId, user.organizationId, dialogId);
        profile = await this.clientsService.findOne(
          clientId,
          user.role,
          user.studioId,
          user.organizationId,
        );
      }
    }
    if (!profile) {
      return this.withNextbotPrompt(
        user.organizationId,
        'prompt',
        {
          found: false,
          firstName: null as unknown as null,
          patronymic: null as unknown as null,
          level: null as unknown as null,
          bonuses: null as unknown as null,
          cashbackPercent: null as unknown as null,
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
      'prompt',
      {
        found: true,
        firstName: c['firstName'] ?? null,
        patronymic: c['patronymic'] ?? null,
        level: c['level'] ?? null,
        bonuses: c['bonuses'] ?? null,
        cashbackPercent: c['cashbackPercent'] ?? null,
        nextbotDialogId: c['nextbotDialogId'] ?? null,
        dialogId: c['nextbotDialogId'] ?? null,
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
    const safeClient = this.sanitizeClientForNextbot(c);
    return this.withNextbotPrompt(user.organizationId, 'check_loyalty_status', {
      found: true,
      clientId: c['id'],
      level: c['level'] ?? null,
      loyaltyTierName,
      bonuses: c['bonuses'] ?? null,
      rawClient: safeClient,
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

  /** Привязка dialog_id Nextbot к клиенту по телефону (первый контакт / смена диалога). */
  async linkNextbotDialog(dto: LinkNextbotDialogDto, user: CurrentUserPayload) {
    const dialogId = dto.dialogId ?? dto.nextbotDialogId;
    if (!dialogId) {
      throw new BadRequestException('Укажите dialogId');
    }
    const profile = await this.resolveClientProfile(dto.phone, user);
    if (!profile) {
      throw new NotFoundException('Клиент с таким телефоном не найден');
    }
    const clientId = String((profile as Record<string, unknown>)['id'] ?? '');
    await this.saveNextbotDialogId(clientId, user.organizationId, dialogId);
    const updated = await this.clientsService.findOne(
      clientId,
      user.role,
      user.studioId,
      user.organizationId,
    );
    const c = updated as Record<string, unknown>;
    return {
      clientId: c['id'],
      phone: c['phone'],
      nextbotDialogId: c['nextbotDialogId'] ?? dialogId,
      dialogId: c['nextbotDialogId'] ?? dialogId,
    };
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
        description: true,
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
        select: {
          id: true,
          name: true,
          description: true,
          subcategories: {
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.studio.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, name: true },
      }),
      this.prisma.studioDisabledCategory.findMany({
        where: { studio: { organizationId: user.organizationId } },
        select: { studioId: true, categoryId: true },
      }),
    ]);

    const allStudios = studios.map((s) => ({ id: s.id, name: s.name }));
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
        const availableStudios = allStudios.filter((s) => !disabledSet.has(s.id));
        return {
          id: c.id,
          name: c.name,
          description: c.description,
          subcategories: c.subcategories,
          available_in: availableStudios.map((s) => s.id),
          available_in_studios: availableStudios,
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
      /** Список услуг (одна или несколько). Приоритет над legacy `serviceId` в compute. */
      serviceIds?: string[];
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

    const promptText = await this.resolveNextbotPrompt(
      user.organizationId,
      'check_availability',
      NEXTBOT_CHECK_AVAILABILITY_PROMPT,
    );

    try {
      const slots = await this.availabilityService.computeNextbotFreeSlots(studioId, date, {
        staffUserId: effectiveStaffId ?? undefined,
        serviceIds: options?.serviceIds,
        durationMinutes: options?.durationMinutes,
        slotStepMinutes: options?.slotStepMinutes,
      });
      return {
        ...(slots as unknown as Record<string, unknown>),
        check_availability: promptText,
      };
    } catch (err) {
      if (err instanceof BadRequestException) {
        const resp = err.getResponse();
        const message =
          typeof resp === 'string'
            ? resp
            : Array.isArray((resp as { message?: unknown }).message)
              ? ((resp as { message: string[] }).message).join('; ')
              : String((resp as { message?: string }).message ?? err.message);
        throw new BadRequestException({
          message,
          check_availability: promptText,
        });
      }
      throw err;
    }
  }

  /**
   * create_booking_request.
   *
   * Nextbot всегда создаёт предварительную бронь (`status = TENTATIVE`).
   * Слот резервируется в расписании (блокируется для других записей), но ждёт
   * последующего вызова `request_manager_invoice`:
   *   • дневной путь → задача менеджеру на выставление счёта; бронь остаётся TENTATIVE
   *     до ручного перевода в BOOKED/PENDING_CONFIRMATION менеджером в CRM;
   *   • ночной путь → активируется 30-минутный таймер автоотмены (`holdExpiresAt`),
   *     клиент присылает чек → verify_receipt_nighttime переводит в PENDING_CONFIRMATION
   *     и очищает таймер.
   *
   * При занятом слоте appointmentsService.create бросит 409 Conflict — автоочереди нет,
   * клиента в лист ожидания ставит отдельная функция add_to_waitlist.
   */
  async createAppointment(
    studioId: string,
    dto: CreateAppointmentDto,
    user: CurrentUserPayload,
  ) {
    const created = await this.appointmentsService.create(
      studioId,
      { ...dto, tentative: true },
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

  // ========== request_manager_invoice ==========

  /** Час в локальной таймзоне студии в диапазоне 0..23. */
  private currentHourInStudioTimezone(timezone: string, now: Date): number {
    try {
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone || DEFAULT_IANA_TIMEZONE,
        hour: '2-digit',
        hour12: false,
      });
      const raw = fmt.format(now);
      const h = parseInt(raw, 10);
      return Number.isFinite(h) ? h : now.getHours();
    } catch {
      return now.getHours();
    }
  }

  /**
   * Попадает ли текущее локальное время студии в рабочий интервал ОТДЕЛА МАРКЕТИНГА.
   * Интервал [workStart, workEnd) по локальному времени. Поддерживает «переход через полночь»
   * (например workStart=22, workEnd=6). Если хотя бы одна граница не задана или значения
   * равны — считаем, что часы маркетинга не настроены и Nextbot всегда идёт по дневному пути.
   */
  private isDuringMarketingHours(
    workStart: number | null | undefined,
    workEnd: number | null | undefined,
    studioTimezone: string,
    now: Date,
  ): boolean {
    if (
      workStart == null ||
      workEnd == null ||
      workStart < 0 ||
      workStart > 23 ||
      workEnd < 0 ||
      workEnd > 23 ||
      workStart === workEnd
    ) {
      return true;
    }
    const hour = this.currentHourInStudioTimezone(studioTimezone, now);
    if (workStart < workEnd) {
      return hour >= workStart && hour < workEnd;
    }
    return hour >= workStart || hour < workEnd;
  }

  private buildDayInvoicePrompt(): string {
    return [
      'СИСТЕМНОЕ СООБЩЕНИЕ: Заявка на удалённую оплату передана менеджеру филиала.',
      '',
      'ТВОИ ДЕЙСТВИЯ:',
      'Коротко и спокойно подтверди клиенту: менеджер уже получил заявку и в ближайшее время отправит реквизиты/счёт по выбранному способу оплаты.',
      'Попроси клиента дождаться сообщения от менеджера; присылать чек СЕЙЧАС не нужно — сначала нужно получить корректные реквизиты.',
      'Не называй никаких статичных номеров, карт и внутренних идентификаторов — все реквизиты придут клиенту в счёте.',
      'Если клиент спросит о сроках: «в течение рабочего времени, обычно быстро». Конкретные минуты не обещай.',
    ].join('\n');
  }

  private buildNightInvoicePrompt(params: {
    remotePaymentMethod: RemotePaymentMethod;
    kaspiPhone: string | null;
    kaspiCardHolder: string | null;
    ipRequisites: string | null;
    holdMinutes: number;
  }): string {
    const { remotePaymentMethod, kaspiPhone, kaspiCardHolder, ipRequisites, holdMinutes } = params;
    const isPhoneTransfer = remotePaymentMethod === RemotePaymentMethod.PHONE_TRANSFER;
    const hasRequisites = isPhoneTransfer
      ? !!(kaspiPhone || kaspiCardHolder)
      : !!(ipRequisites && ipRequisites.trim() !== '');
    const requisites = isPhoneTransfer
      ? hasRequisites
        ? [
            'РЕКВИЗИТЫ ДЛЯ ПЕРЕВОДА ПО НОМЕРУ:',
            kaspiPhone ? `• Номер: ${kaspiPhone}` : null,
            kaspiCardHolder ? `• Получатель: ${kaspiCardHolder}` : null,
          ]
            .filter(Boolean)
            .join('\n')
        : 'ВНИМАНИЕ: реквизиты для перевода по номеру не настроены в организации. Сообщи клиенту, что ночная оплата временно недоступна, и предложи записаться на другое время или дождаться утра — менеджер отправит реквизиты.'
      : hasRequisites
        ? ['ССЫЛКА ДЛЯ ОПЛАТЫ НА ИП:', ipRequisites ?? ''].join('\n')
        : 'ВНИМАНИЕ: ссылка оплаты на ИП не настроена в организации. Сообщи клиенту, что ночная оплата временно недоступна, и предложи записаться на другое время или дождаться утра — менеджер отправит ссылку.';

    return [
      `СИСТЕМНОЕ СООБЩЕНИЕ: Сейчас ночной режим оплаты. Выбранный способ: ${
        isPhoneTransfer ? 'перевод по номеру' : 'оплата на ИП'
      }.`,
      '',
      requisites,
      '',
      `ВАЖНО — ТАЙМЕР: Предварительная бронь удерживается ровно ${holdMinutes} минут. Если за это время чек не получен и не проверен, бронь будет автоматически отменена, слот освободится.`,
      '',
      'ТВОИ ДЕЙСТВИЯ:',
      hasRequisites
        ? 'Сообщи клиенту реквизиты точно, без сокращений и искажений.'
        : 'Не выдумывай реквизиты — их нет.',
      `Чётко обозначь правило: в течение ${holdMinutes} минут он присылает чек/скриншот оплаты сюда же, иначе бронь снимется.`,
      'Как только клиент пришлёт чек — вызови функцию verify_receipt_nighttime для визуальной/системной проверки. Не подтверждай оплату до верификации.',
      'Не обещай окончательное подтверждение записи до проверки чека.',
    ].join('\n');
  }

  /**
   * request_manager_invoice.
   *
   * Связующий финансовый узел после создания предварительной брони.
   * По локальному времени филиала и рабочим часам отдела маркетинга организации
   * (`marketingHoursStartHour/EndHour`):
   *   • ДЕНЬ — создаёт `StudioTask` на выставление счёта + уведомление менеджеру;
   *     запись остаётся TENTATIVE; агенту возвращается дневной промпт.
   *   • НОЧЬ — ставит `holdExpiresAt = now + 30 min` на запись,
   *     агенту возвращает промпт со статичными реквизитами Kaspi и инструкцию запросить чек.
   *
   * Ответ всегда 200 с обязательным полем `prompt` (поле `data` — минимальный
   * маршрут без тяжёлых объектов: `mode`, `holdUntilAt?`, `taskId?`).
   */
  async requestManagerInvoice(
    dto: RequestManagerInvoiceDto,
    user: CurrentUserPayload,
  ) {
    const appointmentId = (dto.appointmentId ?? '').trim();
    const kaspiDetails = (dto.kaspiDetails ?? '').trim();
    if (!appointmentId) {
      throw new BadRequestException('appointmentId is required');
    }
    if (!kaspiDetails) {
      throw new BadRequestException('kaspiDetails is required');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        studio: { include: { organization: true } },
        client: {
          select: {
            firstName: true,
            lastName: true,
            patronymic: true,
          },
        },
        service: { select: { name: true } },
        serviceItems: {
          select: { service: { select: { name: true } } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    await assertUserOrganizationMatchesStudio(
      this.prisma,
      appointment.studioId,
      user.organizationId,
      user.role,
    );

    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.DONE
    ) {
      throw new BadRequestException(
        `Cannot request invoice: appointment status is ${appointment.status}`,
      );
    }

    const organization = appointment.studio.organization;
    const marketingLocalTimezone = organizationTimezone(organization);
    const now = new Date();
    const isDay = this.isDuringMarketingHours(
      organization.marketingHoursStartHour,
      organization.marketingHoursEndHour,
      marketingLocalTimezone,
      now,
    );
    const isNight = !isDay;

    const holdMinutes = clampOrDefault(
      organization.nightHoldMinutes,
      1,
      24 * 60,
      NEXTBOT_DEFAULT_NIGHT_HOLD_MINUTES,
    );

    if (isNight) {
      const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60_000);
      await this.prisma.appointment.update({
        where: { id: appointment.id },
        data: { holdExpiresAt },
      });

      const fallback = this.buildNightInvoicePrompt({
        remotePaymentMethod:
          organization.remotePaymentMethod ?? RemotePaymentMethod.PHONE_TRANSFER,
        kaspiPhone: organization.paymentKaspiPhone,
        kaspiCardHolder: organization.paymentKaspiCardHolder,
        ipRequisites: organization.paymentIpRequisites,
        holdMinutes,
      });

      return this.withNextbotPrompt(
        user.organizationId,
        'request_manager_invoice',
        {
          mode: 'night_hold' as const,
          holdUntilAt: holdExpiresAt.toISOString(),
          appointmentId: appointment.id,
        },
        fallback,
        'request_manager_invoice_night',
      );
    }

    // Дневной путь — одна общая задача для всех менеджеров организации.
    const managerPool = await this.getOrganizationManagerPool(
      appointment.studio.organizationId,
    );

    if (managerPool.length === 0) {
      throw new BadRequestException(
        'No active MANAGER in organization to assign invoice task',
      );
    }
    const assignee = managerPool[0]!;

    const dayInvoiceDeadlineHours = clampOrDefault(
      organization.dayInvoiceTaskDeadlineHours,
      1,
      48,
      NEXTBOT_DEFAULT_DAY_INVOICE_TASK_DEADLINE_HOURS,
    );
    const deadlineAt = new Date(now.getTime() + dayInvoiceDeadlineHours * 60 * 60 * 1000);
    const clientName = this.formatClientName(appointment.client);
    const servicesName = this.formatAppointmentServices(appointment);
    const description = [
      `Клиент с именем ${clientName}.`,
      `забронировал услугу/и: ${servicesName}`,
      `необходимо выставить счет на предоплату на номер: ${kaspiDetails}`,
    ]
      .filter(Boolean)
      .join('\n');

    const task = await this.prisma.studioTask.create({
      data: {
        id: generateId(IdPrefix.StudioTask),
        organizationId: appointment.studio.organizationId,
        title: 'выставить счет на предоплату',
        description,
        assigneeUserId: assignee.id,
        createdByUserId: assignee.id, // система / ассистент от имени менеджера
        deadlineAt,
        status: TaskStatus.OPEN,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        controllers: {
          create: managerPool
            .filter((m) => m.id !== assignee.id)
            .map((m) => ({
              id: generateId(IdPrefix.StudioTaskController),
              userId: m.id,
            })),
        },
      },
    });

    try {
      await this.notificationsService.createNewTaskNotification(
        appointment.studioId,
        task.id,
        assignee.id,
        task.title,
        deadlineAt,
      );
    } catch {
      // не блокируем основной ответ при сбое уведомления
    }

    const fallback = this.buildDayInvoicePrompt();

    return this.withNextbotPrompt(
      user.organizationId,
      'request_manager_invoice',
      {
        mode: 'manager_task' as const,
        taskId: task.id,
        appointmentId: appointment.id,
      },
      fallback,
      'request_manager_invoice_day',
    );
  }

  // ========== verify_receipt_nighttime ==========

  private buildVerifyReceiptNighttimePrompt(): string {
    return [
      'СИСТЕМНОЕ СООБЩЕНИЕ: Чек принят. Запись переведена в статус «Ожидает подтверждения».',
      'Менеджер утром сверит поступление с выпиской Kaspi и окончательно подтвердит оплату.',
      '',
      'ТВОИ ДЕЙСТВИЯ:',
      'Коротко и вежливо сообщи клиенту: чек получен, бронь за ним закреплена, таймер автоотмены снят.',
      'Обозначь ожидания: окончательное подтверждение — после утренней сверки менеджером с банковской выпиской, обычно в первой половине рабочего дня.',
      'Попроси сохранить чек на случай рассинхрона; если до сверки будут вопросы — менеджер свяжется сам.',
      'Не называй внутренних идентификаторов и не обещай немедленное подтверждение — финальное решение за менеджером.',
    ].join('\n');
  }

  /**
   * verify_receipt_nighttime.
   *
   * Финал ночной ветки оплаты. Агент вызывает после того, как сам визуально сверил
   * чек клиента (ИП, дата, сумма). Бэкенд:
   *   • переводит запись TENTATIVE → PENDING_CONFIRMATION (холд снимется в
   *     AppointmentsService.update автоматически);
   *   • создаёт утреннюю задачу менеджеру на сверку с выпиской Kaspi;
   *   • шлёт уведомление менеджеру;
   *   • возвращает финальный промпт для экологичного закрытия диалога.
   *
   * Если запись уже в PENDING_CONFIRMATION (повторный вызов) — возвращаем тот же
   * промпт без дубля задачи (идемпотентность для ретраев оркестратора).
   */
  async verifyReceiptNighttime(
    dto: VerifyReceiptNighttimeDto,
    user: CurrentUserPayload,
  ) {
    const appointmentId = (dto.appointmentId ?? '').trim();
    if (!appointmentId) {
      throw new BadRequestException('appointmentId is required');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        studio: {
          select: {
            id: true,
            organizationId: true,
            organization: { select: { nightReceiptTaskDeadlineHours: true } },
          },
        },
        client: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            patronymic: true,
          },
        },
        service: { select: { name: true } },
        serviceItems: {
          select: { service: { select: { name: true } } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment ${appointmentId} not found`);
    }

    await assertUserOrganizationMatchesStudio(
      this.prisma,
      appointment.studioId,
      user.organizationId,
      user.role,
    );

    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.DONE ||
      appointment.status === AppointmentStatus.ARRIVED
    ) {
      throw new BadRequestException(
        `Cannot verify receipt: appointment status is ${appointment.status}`,
      );
    }

    const nightReceiptDeadlineHours = clampOrDefault(
      appointment.studio.organization?.nightReceiptTaskDeadlineHours,
      1,
      48,
      NEXTBOT_DEFAULT_NIGHT_RECEIPT_TASK_DEADLINE_HOURS,
    );

    const fallback = this.buildVerifyReceiptNighttimePrompt();

    // Идемпотентность: если уже на верификации — просто возвращаем промпт.
    if (appointment.status === AppointmentStatus.PENDING_CONFIRMATION) {
      return this.withNextbotPrompt(
        user.organizationId,
        'verify_receipt_nighttime',
        {
          status: AppointmentStatus.PENDING_CONFIRMATION as string,
          appointmentId: appointment.id,
          alreadyProcessed: true as const,
        },
        fallback,
      );
    }

    // Принимаем на верификацию только предварительную бронь (ночной путь).
    if (appointment.status !== AppointmentStatus.TENTATIVE) {
      throw new BadRequestException(
        `Cannot verify receipt: appointment status is ${appointment.status}, expected TENTATIVE`,
      );
    }

    // Перевод статуса → AppointmentsService.update сам сбросит holdExpiresAt.
    const updated = await this.appointmentsService.update(
      appointment.id,
      { status: AppointmentStatus.PENDING_CONFIRMATION },
      user.role,
      user.studioId,
      user.userId,
      user.organizationId,
    );

    // Утренняя общая задача для всех менеджеров организации на сверку чека с выпиской Kaspi.
    const managerPool = await this.getOrganizationManagerPool(
      appointment.studio.organizationId,
    );

    let taskId: string | null = null;
    if (managerPool.length > 0) {
      const assignee = managerPool[0]!;
      const now = new Date();
      const deadlineAt = new Date(now.getTime() + nightReceiptDeadlineHours * 60 * 60 * 1000);
      const clientName = this.formatClientName(appointment.client);
      const servicesName = this.formatAppointmentServices(appointment);
      const description = [
        `Клиент: ${clientName}`,
        `совершил предоплату по услуге/ам: ${servicesName}`,
        'Необходтмо свериться с приложением каспи-пэй.',
        'Если все корректно сменить статус на "забронировано"',
        'Если оплата в системе каспи-пэй не найдена, необходимо связаться с клиентом по данному вопросу',
        'привязка к записи и клиенту',
      ]
        .filter(Boolean)
        .join('\n');

      const task = await this.prisma.studioTask.create({
        data: {
          id: generateId(IdPrefix.StudioTask),
          organizationId: appointment.studio.organizationId,
          title: 'Сверить оплату с каспи-пэй',
          description,
          assigneeUserId: assignee.id,
          createdByUserId: assignee.id,
          deadlineAt,
          status: TaskStatus.OPEN,
          appointmentId: appointment.id,
          clientId: appointment.clientId,
          controllers: {
            create: managerPool
              .filter((m) => m.id !== assignee.id)
              .map((m) => ({
                id: generateId(IdPrefix.StudioTaskController),
                userId: m.id,
              })),
          },
        },
      });
      taskId = task.id;

      try {
        await this.notificationsService.createNewTaskNotification(
          appointment.studioId,
          task.id,
          assignee.id,
          task.title,
          deadlineAt,
        );
      } catch {
        // уведомления — не критично для основного ответа
      }
    }

    return this.withNextbotPrompt(
      user.organizationId,
      'verify_receipt_nighttime',
      {
        status: (updated as { status?: string })?.status ?? AppointmentStatus.PENDING_CONFIRMATION,
        appointmentId: appointment.id,
        taskId,
      },
      fallback,
    );
  }
}
