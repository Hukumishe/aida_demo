import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export type NextbotOutboundPayload = {
  dialogId: number;
  text: string;
  appointmentId?: string;
  clientId?: string;
  templateId?: string;
};

@Injectable()
export class NextbotOutboundService {
  private readonly logger = new Logger(NextbotOutboundService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
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
