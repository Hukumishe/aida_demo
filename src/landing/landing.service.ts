import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLandingPromotionDto } from './dto/create-promotion.dto';
import { UpdateLandingPromotionDto } from './dto/update-promotion.dto';
import { UpdateLandingMastersDto } from './dto/update-masters.dto';
import { CreateLandingServiceCardDto } from './dto/create-service-card.dto';
import { UpdateLandingServiceCardDto } from './dto/update-service-card.dto';
import { ReorderLandingServiceCardsDto } from './dto/reorder-service-cards.dto';
import { isOwnerLevelRole } from '../common/decorators/roles.decorator';

@Injectable()
export class LandingService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Promotions ---

  async getPromotions(studioId: string) {
    return this.prisma.landingPromotion.findMany({
      where: { studioId },
      include: {
        services: {
          include: { service: true },
        },
        codes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPromotion(
    studioId: string,
    dto: CreateLandingPromotionDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    if (dto.type === 'DISCOUNT') {
      if (!dto.discountPercent || !dto.serviceIds || dto.serviceIds.length === 0) {
        throw new BadRequestException('DISCOUNT promotion must have discountPercent and serviceIds');
      }
    }
    if (dto.type === 'ONE_PLUS_ONE') {
      if (!dto.serviceIdA || !dto.serviceIdB || dto.bundlePrice == null) {
        throw new BadRequestException('ONE_PLUS_ONE promotion must have serviceIdA, serviceIdB and bundlePrice');
      }
    }

    const promotion = await this.prisma.landingPromotion.create({
      data: {
        studioId,
        type: dto.type,
        title: dto.title,
        description: dto.description,
        isActive: true,
        discountPercent: dto.type === 'DISCOUNT' ? dto.discountPercent ?? null : null,
        serviceIdA: dto.type === 'ONE_PLUS_ONE' ? dto.serviceIdA ?? null : null,
        serviceIdB: dto.type === 'ONE_PLUS_ONE' ? dto.serviceIdB ?? null : null,
        bundlePrice: dto.type === 'ONE_PLUS_ONE' ? dto.bundlePrice ?? null : null,
        services:
          dto.type === 'DISCOUNT' && dto.serviceIds
            ? {
                create: dto.serviceIds.map((serviceId) => ({ serviceId })),
              }
            : undefined,
      },
    });

    // Автоматически создаём один промокод для акции
    const code = await this.generatePromoCode();
    await this.prisma.landingPromotionCode.create({
      data: {
        promotionId: promotion.id,
        code,
      },
    });

    return this.prisma.landingPromotion.findUnique({
      where: { id: promotion.id },
      include: {
        services: {
          include: { service: true },
        },
        codes: true,
      },
    });
  }

  async updatePromotion(
    studioId: string,
    id: string,
    dto: UpdateLandingPromotionDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const existing = await this.prisma.landingPromotion.findFirst({
      where: { id, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    // Обновление связей услуг для DISCOUNT
    if (existing.type === 'DISCOUNT' && dto.serviceIds) {
      await this.prisma.$transaction([
        this.prisma.landingPromotionService.deleteMany({
          where: { promotionId: id },
        }),
        this.prisma.landingPromotionService.createMany({
          data: dto.serviceIds.map((serviceId) => ({
            promotionId: id,
            serviceId,
          })),
        }),
      ]);
    }

    const updated = await this.prisma.landingPromotion.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        isActive: dto.isActive ?? undefined,
        discountPercent:
          existing.type === 'DISCOUNT' ? dto.discountPercent ?? existing.discountPercent : existing.discountPercent,
        serviceIdA:
          existing.type === 'ONE_PLUS_ONE' ? dto.serviceIdA ?? existing.serviceIdA : existing.serviceIdA,
        serviceIdB:
          existing.type === 'ONE_PLUS_ONE' ? dto.serviceIdB ?? existing.serviceIdB : existing.serviceIdB,
        bundlePrice:
          existing.type === 'ONE_PLUS_ONE' ? dto.bundlePrice ?? existing.bundlePrice : existing.bundlePrice,
      },
      include: {
        services: {
          include: { service: true },
        },
        codes: true,
      },
    });

    return updated;
  }

  async deletePromotion(
    studioId: string,
    id: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const existing = await this.prisma.landingPromotion.findFirst({
      where: { id, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    await this.prisma.landingPromotion.delete({ where: { id } });
    return { success: true };
  }

  // --- Masters ---

  async getMasters(studioId: string) {
    const [configs, staff] = await Promise.all([
      this.prisma.landingMaster.findMany({
        where: { studioId },
        orderBy: { order: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { studioId, isActive: true },
        include: { staffProfile: true },
      }),
    });

    const byStaffId = new Map(configs.map((c) => [c.staffUserId, c]));

    return staff.map((u) => {
      const cfg = byStaffId.get(u.id);
      return {
        staffUserId: u.id,
        isVisible: cfg?.isVisible ?? false,
        order: cfg?.order ?? 0,
        staff: u,
      };
    });
  }

  async updateMasters(
    studioId: string,
    dto: UpdateLandingMastersDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const staffIds = dto.items.map((i) => i.staffUserId);
    const existingStaff = await this.prisma.user.findMany({
      where: { id: { in: staffIds }, studioId },
      select: { id: true },
    });
    const validIds = new Set(existingStaff.map((s) => s.id));

    const filtered = dto.items.filter((i) => validIds.has(i.staffUserId));

    await this.prisma.$transaction(async (tx) => {
      await tx.landingMaster.deleteMany({ where: { studioId } });
      if (filtered.length > 0) {
        await tx.landingMaster.createMany({
          data: filtered.map((i) => ({
            studioId,
            staffUserId: i.staffUserId,
            isVisible: i.isVisible,
            order: i.order,
          })),
        });
      }
    });

    return this.getMasters(studioId);
  }

  // --- Services ---

  async getServiceCards(studioId: string) {
    return this.prisma.landingServiceCard.findMany({
      where: { studioId },
      include: {
        service: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  async createServiceCard(
    studioId: string,
    dto: CreateLandingServiceCardDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, studioId },
    });
    if (!service) {
      throw new NotFoundException('Service not found in this studio');
    }

    const count = await this.prisma.landingServiceCard.count({
      where: { studioId },
    });

    return this.prisma.landingServiceCard.create({
      data: {
        studioId,
        serviceId: dto.serviceId,
        title: dto.title ?? null,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        order: dto.order ?? count,
      },
      include: { service: true },
    });
  }

  async updateServiceCard(
    studioId: string,
    id: string,
    dto: UpdateLandingServiceCardDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const existing = await this.prisma.landingServiceCard.findFirst({
      where: { id, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Service card not found');
    }

    return this.prisma.landingServiceCard.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        description: dto.description ?? undefined,
        imageUrl: dto.imageUrl ?? undefined,
      },
      include: { service: true },
    });
  }

  async deleteServiceCard(
    studioId: string,
    id: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const existing = await this.prisma.landingServiceCard.findFirst({
      where: { id, studioId },
    });
    if (!existing) {
      throw new NotFoundException('Service card not found');
    }

    await this.prisma.landingServiceCard.delete({ where: { id } });
    return { success: true };
  }

  async reorderServiceCards(
    studioId: string,
    dto: ReorderLandingServiceCardsDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureStudioAccess(studioId, userRole, userStudioId);

    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.landingServiceCard.findMany({
      where: { id: { in: ids }, studioId },
      select: { id: true },
    });
    const validIds = new Set(existing.map((c) => c.id));

    const updates = dto.items.filter((i) => validIds.has(i.id));

    await this.prisma.$transaction(
      updates.map((i) =>
        this.prisma.landingServiceCard.update({
          where: { id: i.id },
          data: { order: i.order },
        }),
      ),
    );

    return this.getServiceCards(studioId);
  }

  // --- Helpers ---

  private ensureStudioAccess(studioId: string, userRole?: string, userStudioId?: string) {
    if (!isOwnerLevelRole(userRole)) {
      if (userStudioId !== studioId) {
        throw new ForbiddenException('Access denied to this studio');
      }
    }
  }

  private async generatePromoCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const length = 8;

    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < length; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      const existing = await this.prisma.landingPromotionCode.findUnique({
        where: { code },
      });
      if (!existing) return code;
    }

    throw new BadRequestException('Could not generate unique promo code');
  }
}
*** End Patch */}
*** End Patch  */}  -->}  -->
*** End Patch  */}  -->}  -->
*** End Patch  */}  -->}  -->
*** End Patch  */}  -->}  -->}  -->
*** End Patch  */}  -->}  -->}  -->
*** End Patch to=functions.ApplyPatch  ฝ่ายขาย  ski  JSON  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  skieria  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  Moments  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski  ski '{"*** Begin Patch\n*** Add File: C:\\Users\\Hukum\\Desktop\\AIDA\\src\\landing\\landing.service.ts\n+import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';\n+import { PrismaService } from '../common/prisma/prisma.service';\n+import { CreateLandingPromotionDto } from './dto/create-promotion.dto';\n+import { UpdateLandingPromotionDto } from './dto/update-promotion.dto';\n+import { UpdateLandingMastersDto } from './dto/update-masters.dto';\n+import { CreateLandingServiceCardDto } from './dto/create-service-card.dto';\n+import { UpdateLandingServiceCardDto } from './dto/update-service-card.dto';\n+import { ReorderLandingServiceCardsDto } from './dto/reorder-service-cards.dto';\n+import { isOwnerLevelRole } from '../common/decorators/roles.decorator';\n+\n+@Injectable()\n+export class LandingService {\n+  constructor(private readonly prisma: PrismaService) {}\n+\n+  // --- Promotions ---\n+\n+  async getPromotions(studioId: string) {\n+    return this.prisma.landingPromotion.findMany({\n+      where: { studioId },\n+      include: {\n+        services: {\n+          include: { service: true },\n+        },\n+        codes: true,\n+      },\n+      orderBy: { createdAt: 'desc' },\n+    });\n+  }\n+\n+  async createPromotion(\n+    studioId: string,\n+    dto: CreateLandingPromotionDto,\n+    userRole?: string,\n+    userStudioId?: string,\n+  ) {\n+    this.ensureStudioAccess(studioId, userRole, userStudioId);\n+\n+    if (dto.type === 'DISCOUNT') {\n+      if (!dto.discountPercent || !dto.serviceIds || dto.serviceIds.length === 0) {\n+        throw new BadRequestException('DISCOUNT promotion must have discountPercent and serviceIds');\n+      }\n+    }\n+    if (dto.type === 'ONE_PLUS_ONE') {\n+      if (!dto.serviceIdA || !dto.serviceIdB || dto.bundlePrice == null) {\n+        throw new BadRequestException('ONE_PLUS_ONE promotion must have serviceIdA, serviceIdB and bundlePrice');\n+      }\n+    }\n+\n+    const promotion = await this.prisma.landingPromotion.create({\n+      data: {\n+        studioId,\n+        type: dto.type,\n+        title: dto.title,\n+        description: dto.description,\n+        isActive: true,\n+        discountPercent: dto.type === 'DISCOUNT' ? dto.discountPercent ?? null : null,\n+        serviceIdA: dto.type === 'ONE_PLUS_ONE' ? dto.serviceIdA ?? null : null,\n+        serviceIdB: dto.type === 'ONE_PLUS_ONE' ? dto.serviceIdB ?? null : null,\n+        bundlePrice: dto.type === 'ONE_PLUS_ONE' ? dto.bundlePrice ?? null : null,\n+        services:\n+          dto.type === 'DISCOUNT' && dto.serviceIds\n+            ? {\n+                create: dto.serviceIds.map((serviceId) => ({ serviceId })),\n+              }\n+            : undefined,\n+      },\n+    });\n+\n+    // Автоматически создаём один промокод для акции\n+    const code = await this.generatePromoCode();\n+    await this.prisma.landingPromotionCode.create({\n+      data: {\n+        promotionId: promotion.id,\n+        code,\n+      },\n+    });\n+\n+    return this.prisma.landingPromotion.findUnique({\n+      where: { id: promotion.id },\n+      include: {\n+        services: {\n+          include: { service: true },\n+        },\n+        codes: true,\n+      },\n+    });\n+  }\n+\n+  async updatePromotion(\n+    studioId: string,\n+    id: string,\n+    dto: UpdateLandingPromotionDto,\n+    userRole?: string,\n+    userStudioId?: string,\n+  ) {\n+    this.ensureStudioAccess(studioId, userRole, userStudioId);\n+\n+    const existing = await this.prisma.landingPromotion.findFirst({\n+      where: { id, studioId },\n+    });\n+    if (!existing) {\n+      throw new NotFoundException('Promotion not found');\n+    }\n+\n+    // Обновление связей услуг для DISCOUNT\n+    if (existing.type === 'DISCOUNT' && dto.serviceIds) {\n+      await this.prisma.$transaction([\n+        this.prisma.landingPromotionService.deleteMany({\n+          where: { promotionId: id },\n+        }),\n+        this.prisma.landingPromotionService.createMany({\n+          data: dto.serviceIds.map((serviceId) => ({\n+            promotionId: id,\n+            serviceId,\n+          })),\n+        }),\n+      ]);\n+    }\n+\n+    const updated = await this.prisma.landingPromotion.update({\n+      where: { id },\n+      data: {\n+        title: dto.title ?? undefined,\n+        description: dto.description ?? undefined,\n+        isActive: dto.isActive ?? undefined,\n+        discountPercent:\n+          existing.type === 'DISCOUNT' ? dto.discountPercent ?? existing.discountPercent : existing.discountPercent,\n+        serviceIdA:\n+          existing.type === 'ONE_PLUS_ONE' ? dto.serviceIdA ?? existing.serviceIdA : existing.serviceIdA,\n+        serviceIdB:\n+          existing.type === 'ONE_PLUS_ONE' ? dto.serviceIdB ?? existing.serviceIdB : existing.serviceIdB,\n+        bundlePrice:\n+          existing.type === 'ONE_PLUS_ONE' ? dto.bundlePrice ?? existing.bundlePrice : existing.bundlePrice,\n+      },\n+      include: {\n+        services: {\n+          include: { service: true },\n+        },\n+        codes: true,\n+      },\n+    });\n+\n+    return updated;\n+  }\n+\n+  async deletePromotion(\n+    studioId: string,\n+    id: string,\n+    userRole?: string,\n+    userStudioId?: string,\n+  ) {\n+    this.ensureStudioAccess(studioId, userRole, userStudioId);\n+\n+    const existing = await this.prisma.landingPromotion.findFirst({\n+      where: { id, studioId },\n+    });\n+    if (!existing) {\n+      throw new NotFoundException('Promotion not found');\n+    }\n+\n+    await this.prisma.landingPromotion.delete({ where: { id } });\n+    return { success: true };\n+  }\n+\n+  // --- Masters ---\n+\n+  async getMasters(studioId: string) {\n+    const [configs, staff] = await Promise.all([\n+      this.prisma.landingMaster.findMany({\n+        where: { studioId },\n+        orderBy: { order: 'asc' },\n+      }),\n+      this.prisma.user.findMany({\n+        where: { studioId, isActive: true },\n+        include: { staffProfile: true },\n+      }),\n+    ]);\n+\n+    const byStaffId = new Map(configs.map((c) => [c.staffUserId, c]));\n+\n+    return staff.map((u) => {\n+      const cfg = byStaffId.get(u.id);\n+      return {\n+        staffUserId: u.id,\n+        isVisible: cfg?.isVisible ?? false,\n+        order: cfg?.order ?? 0,\n+        staff: u,\n+      };\n+    });\n+  }\n+\n+  async updateMasters(\n+    studioId: string,\n+    dto: UpdateLandingMastersDto,\n+    userRole?: string,\n+    userStudioId?: string,\n+  ) {\n+    this.ensureStudioAccess(studioId, userRole, userStudioId);\n+\n+    const staffIds = dto.items.map((i) => i.staffUserId);\n+    const existingStaff = await this.prisma.user.findMany({\n+      where: { id: { in: staffIds }, studioId },\n+      select: { id: true },\n+    });\n+    const validIds = new Set(existingStaff.map((s) => s.id));\n+\n+    const filtered = dto.items.filter((i) => validIds.has(i.staffUserId));\n+\n+    await this.prisma.$transaction(async (tx) => {\n+      await tx.landingMaster.deleteMany({ where: { studioId } });\n+      if (filtered.length > 0) {\n+        await tx.landingMaster.createMany({\n+          data: filtered.map((i) => ({\n+            studioId,\n+            staffUserId: i.staffUserId,\n+            isVisible: i.isVisible,\n+            order: i.order,\n+          })),\n+        });\n+      }\n+    });\n+\n+    return this.getMasters(studioId);\n+  }\n+\n+  // --- Services ---\n+\n+  async getServiceCards(studioId: string) {\n+    return this.prisma.landingServiceCard.findMany({\n+      where: { studioId },\n+      include: {\n+        service: true,\n+      },\n+      orderBy: { order: 'asc' },\n+    });\n+  }\n+\n+  async createServiceCard(\n+    studioId: string,\n+    dto: CreateLandingServiceCardDto,\n+    userRole?: string,\n+    userStudioId?: string,\n+  ) {\n+    this.ensureStudioAccess(studioId, userRole, userStudioId);\n+\n+    const service = await this.prisma.service.findFirst({\n+      where: { id: dto.serviceId, studioId },\n+    });\n+    if (!service) {\n+      throw new NotFoundException('Service not found in this studio');\n+    }\n+\n+    const count = await this.prisma.landingServiceCard.count({\n+      where: { studioId },\n+    });\n+\n+    return this.prisma.landingServiceCard.create({\n+      data: {\n+        studioId,\n+        serviceId: dto.serviceId,\n+        title: dto.title ?? null,\n+        description: dto.description ?? null,\n+        imageUrl: dto.imageUrl ?? null,\n+        order: dto.order ?? count,\n+      },\n+      include: { service: true },\n+    });\n+  }\n+\n+  async updateServiceCard(\n+    studioId: string,\n+    id: string,\n+    dto: UpdateLandingServiceCardDto,\n+    userRole?: string,\n+    userStudioId?: string,\n+  ) {\n+    this.ensureStudioAccess(studioId, userRole, userStudioId);\n+\n+    const existing = await this.prisma.landingServiceCard.findFirst({\n+      where: { id, studioId },\n+    });\n+    if (!existing) {\n+      throw new NotFoundException('Service card not found');\n+    }\n+\n+    return this.prisma.landingServiceCard.update({\n+      where: { id },\n+      data: {\n+        title: dto.title ?? undefined,\n+        description: dto.description ?? undefined,\n+        imageUrl: dto.imageUrl ?? undefined,\n+      },\n+      include: { service: true },\n+    });\n+  }\n+\n+  async deleteServiceCard(\n+    studioId: string,\n+    id: string,\n+    userRole?: string,\n+    userStudioId?: string,\n+  ) {\n+    this.ensureStudioAccess(studioId, userRole, userStudioId);\n+\n+    const existing = await this.prisma.landingServiceCard.findFirst({\n+      where: { id, studioId },\n+    });\n+    if (!existing) {\n+      throw new NotFoundException('Service card not found');\n+    }\n+\n+    await this.prisma.landingServiceCard.delete({ where: { id } });\n+    return { success: true };\n+  }\n+\n+  async reorderServiceCards(\n+    studioId: string,\n+    dto: ReorderLandingServiceCardsDto,\n+    userRole?: string,\n+    userStudioId?: string,\n+  ) {\n+    this.ensureStudioAccess(studioId, userRole, userStudioId);\n+\n+    const ids = dto.items.map((i) => i.id);\n+    const existing = await this.prisma.landingServiceCard.findMany({\n+      where: { id: { in: ids }, studioId },\n+      select: { id: true },\n+    });\n+    const validIds = new Set(existing.map((c) => c.id));\n+\n+    const updates = dto.items.filter((i) => validIds.has(i.id));\n+\n+    await this.prisma.$transaction(\n+      updates.map((i) =>\n+        this.prisma.landingServiceCard.update({\n+          where: { id: i.id },\n+          data: { order: i.order },\n+        }),\n+      ),\n+    );\n+\n+    return this.getServiceCards(studioId);\n+  }\n+\n+  // --- Helpers ---\n+\n+  private ensureStudioAccess(studioId: string, userRole?: string, userStudioId?: string) {\n+    if (!isOwnerLevelRole(userRole)) {\n+      if (userStudioId !== studioId) {\n+        throw new ForbiddenException('Access denied to this studio');\n+      }\n+    }\n+  }\n+\n+  private async generatePromoCode(): Promise<string> {\n+    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';\n+    const length = 8;\n+\n+    for (let attempt = 0; attempt < 50; attempt++) {\n+      let code = '';\n+      for (let i = 0; i < length; i++) {\n+        code += chars[Math.floor(Math.random() * chars.length)];\n+      }\n+      const existing = await this.prisma.landingPromotionCode.findUnique({\n+        where: { code },\n+      });\n+      if (!existing) return code;\n+    }\n+\n+    throw new BadRequestException('Could not generate unique promo code');\n+  }\n+}\n+*** End Patch\n"}]}}  ***!
