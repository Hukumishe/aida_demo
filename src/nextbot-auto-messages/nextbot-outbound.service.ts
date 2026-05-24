import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/** Внутренний вызов AIDA → маппинг в формат входящего JSON Nextbot. */
export type NextbotOutboundPayload = {
  dialogId: number;
  text: string;
  appointmentId?: string;
  clientId?: string;
  templateId?: string;
};

/** Тело webhook Nextbot (snake_case). */
export type NextbotOutboundWebhookBody = {
  dialog_id: number;
  content_type: 'text';
  text: string;
  message_type: 'forwarded_output';
  message_id?: string;
};

@Injectable()
export class NextbotOutboundService {
  private readonly logger = new Logger(NextbotOutboundService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Преобразование во формат API Nextbot. */
  toWebhookBody(payload: NextbotOutboundPayload): NextbotOutboundWebhookBody {
    const dialogId = Number(payload.dialogId);
    if (!Number.isFinite(dialogId) || dialogId < 1) {
      throw new Error('dialogId must be a positive number');
    }
    const text = String(payload.text ?? '').trim();
    if (!text) {
      throw new Error('text is required for outbound message');
    }
    const body: NextbotOutboundWebhookBody = {
      dialog_id: Math.trunc(dialogId),
      content_type: 'text',
      text,
      message_type: 'forwarded_output',
    };
    if (payload.appointmentId?.trim()) {
      body.message_id = payload.appointmentId.trim();
    }
    return body;
  }

  async send(organizationId: string, payload: NextbotOutboundPayload): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        nextbotOutboundWebhookUrl: true,
        nextbotOutboundWebhookApiKey: true,
      },
    });
    const url = org?.nextbotOutboundWebhookUrl?.trim();
    if (!url) {
      throw new Error('nextbotOutboundWebhookUrl is not configured for organization');
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const apiKey = org?.nextbotOutboundWebhookApiKey?.trim();
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const webhookBody = this.toWebhookBody(payload);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(webhookBody),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Nextbot outbound HTTP ${res.status}: ${body.slice(0, 500)}`);
    }
  }

  async trySend(organizationId: string, payload: NextbotOutboundPayload): Promise<boolean> {
    try {
      await this.send(organizationId, payload);
      return true;
    } catch (e) {
      this.logger.warn(`Nextbot outbound failed: ${e}`);
      return false;
    }
  }
}
