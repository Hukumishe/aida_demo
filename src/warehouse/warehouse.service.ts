import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserRole, isOwnerLevelRole } from '../common/decorators/roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CreateReceiptDto, CreateWriteOffDto } from './dto/create-movement.dto';
import { WarehouseType, ProductUnit, StockMovementType } from '@prisma/client';

@Injectable()
export class WarehouseService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateCentralWarehouse() {
    let wh = await this.prisma.warehouse.findFirst({
      where: { type: WarehouseType.CENTRAL },
    });
    if (!wh) {
      wh = await this.prisma.warehouse.create({
        data: { type: WarehouseType.CENTRAL },
      });
    }
    return wh;
  }

  private async getOrCreateBranchWarehouse(studioId: string) {
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      include: { warehouse: true },
    });
    if (!studio) throw new NotFoundException('Studio not found');
    if (studio.warehouse) return studio.warehouse;
    return this.prisma.warehouse.create({
      data: { type: WarehouseType.BRANCH, studioId },
    });
  }

  private ensureCentralAccess(userRole?: string) {
    if (!isOwnerLevelRole(userRole)) {
      throw new ForbiddenException('Only owner and deputy owner can access central warehouse');
    }
  }

  private ensureBranchAccess(studioId: string, userRole?: string, userStudioId?: string) {
    if (isOwnerLevelRole(userRole)) return;
    if (userRole === UserRole.MANAGER) return;
    if (userRole === UserRole.ADMIN && userStudioId === studioId) return;
    throw new ForbiddenException('Access denied to this warehouse');
  }

  async listBranchWarehouses(userRole?: string) {
    this.ensureCentralAccess(userRole);
    return this.prisma.warehouse.findMany({
      where: { type: WarehouseType.BRANCH },
      include: { studio: { select: { id: true, name: true } } },
      orderBy: { studio: { name: 'asc' } },
    });
  }

  async getCentralWarehouse(userRole?: string) {
    this.ensureCentralAccess(userRole);
    const warehouse = await this.getOrCreateCentralWarehouse();
    const stocks = await this.prisma.stock.findMany({
      where: { warehouseId: warehouse.id },
      include: { product: true },
    });
    return {
      id: warehouse.id,
      type: warehouse.type,
      stocks: stocks.map((s) => ({
        productId: s.productId,
        product: s.product,
        quantity: s.quantity,
      })),
    };
  }

  async getBranchWarehouse(
    studioId: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureBranchAccess(studioId, userRole, userStudioId);
    const warehouse = await this.getOrCreateBranchWarehouse(studioId);
    const stocks = await this.prisma.stock.findMany({
      where: { warehouseId: warehouse.id },
      include: { product: true },
    });
    return {
      id: warehouse.id,
      type: warehouse.type,
      studioId: warehouse.studioId,
      stocks: stocks.map((s) => ({
        productId: s.productId,
        product: s.product,
        quantity: s.quantity,
      })),
    };
  }

  async listProducts(userRole?: string) {
    this.ensureCentralAccess(userRole);
    return this.prisma.product.findMany({ orderBy: { name: 'asc' } });
  }

  async createProduct(
    dto: CreateProductDto,
    warehouseId: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    if (warehouse.type === WarehouseType.CENTRAL) {
      this.ensureCentralAccess(userRole);
    } else {
      this.ensureBranchAccess(warehouse.studioId!, userRole, userStudioId);
    }

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        article: dto.article,
        unit: dto.unit,
      },
    });

    const qty = dto.initialQuantity ?? 0;
    if (qty > 0) {
      await this.prisma.stock.upsert({
        where: {
          warehouseId_productId: { warehouseId, productId: product.id },
        },
        create: { warehouseId, productId: product.id, quantity: qty },
        update: { quantity: { increment: qty } },
      });
    }

    return product;
  }

  async updateProduct(
    productId: string,
    dto: UpdateProductDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');
    this.ensureCentralAccess(userRole);

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.article !== undefined && { article: dto.article }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
      },
    });
  }

  async deleteProduct(
    productId: string,
    userRole?: string,
  ) {
    this.ensureCentralAccess(userRole);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { stocks: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const hasStock = product.stocks.some((s) => s.quantity > 0);
    if (hasStock) {
      throw new BadRequestException(
        'Cannot delete product with remaining stock. Write off or transfer first.',
      );
    }
    await this.prisma.stock.deleteMany({ where: { productId } });
    await this.prisma.product.delete({ where: { id: productId } });
    return { success: true };
  }

  async createTransferFromCentral(
    dto: CreateTransferDto,
    userRole?: string,
    userStudioId?: string,
    userId?: string,
  ) {
    this.ensureCentralAccess(userRole);
    if (!userId) throw new ForbiddenException('User required');

    const central = await this.getOrCreateCentralWarehouse();
    const toWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.toWarehouseId },
      include: { studio: true },
    });
    if (!toWarehouse || toWarehouse.type !== WarehouseType.BRANCH) {
      throw new BadRequestException('Destination must be a branch warehouse');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const fromStock = await this.prisma.stock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: central.id, productId: dto.productId },
      },
    });
    const available = fromStock?.quantity ?? 0;
    if (available < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${available}, requested: ${dto.quantity}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stock.update({
        where: {
          warehouseId_productId: { warehouseId: central.id, productId: dto.productId },
        },
        data: { quantity: { decrement: dto.quantity } },
      });
      await tx.stock.upsert({
        where: {
          warehouseId_productId: { warehouseId: dto.toWarehouseId, productId: dto.productId },
        },
        create: { warehouseId: dto.toWarehouseId, productId: dto.productId, quantity: dto.quantity },
        update: { quantity: { increment: dto.quantity } },
      });
      await tx.transfer.create({
        data: {
          fromWarehouseId: central.id,
          toWarehouseId: dto.toWarehouseId,
          productId: dto.productId,
          quantity: dto.quantity,
          createdByUserId: userId,
        },
      });
    });

    return { success: true, message: 'Transfer completed' };
  }

  async createTransferToBranch(
    studioId: string,
    dto: { productId: string; quantity: number },
    userRole?: string,
    userStudioId?: string,
    userId?: string,
  ) {
    this.ensureBranchAccess(studioId, userRole, userStudioId);
    if (!userId) throw new ForbiddenException('User required');

    const central = await this.getOrCreateCentralWarehouse();
    const branch = await this.getOrCreateBranchWarehouse(studioId);

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const fromStock = await this.prisma.stock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: central.id, productId: dto.productId },
      },
    });
    const available = fromStock?.quantity ?? 0;
    if (available < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock at central. Available: ${available}, requested: ${dto.quantity}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stock.update({
        where: {
          warehouseId_productId: { warehouseId: central.id, productId: dto.productId },
        },
        data: { quantity: { decrement: dto.quantity } },
      });
      await tx.stock.upsert({
        where: {
          warehouseId_productId: { warehouseId: branch.id, productId: dto.productId },
        },
        create: { warehouseId: branch.id, productId: dto.productId, quantity: dto.quantity },
        update: { quantity: { increment: dto.quantity } },
      });
      await tx.transfer.create({
        data: {
          fromWarehouseId: central.id,
          toWarehouseId: branch.id,
          productId: dto.productId,
          quantity: dto.quantity,
          createdByUserId: userId,
        },
      });
    });

    return { success: true, message: 'Transfer completed' };
  }

  async receipt(
    studioId: string,
    dto: CreateReceiptDto,
    userRole?: string,
    userStudioId?: string,
    userId?: string,
  ) {
    this.ensureBranchAccess(studioId, userRole, userStudioId);
    if (!userId) throw new ForbiddenException('User required');

    const warehouse = await this.getOrCreateBranchWarehouse(studioId);
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.stock.upsert({
        where: {
          warehouseId_productId: { warehouseId: warehouse.id, productId: dto.productId },
        },
        create: { warehouseId: warehouse.id, productId: dto.productId, quantity: dto.quantity },
        update: { quantity: { increment: dto.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          warehouseId: warehouse.id,
          productId: dto.productId,
          quantityDelta: dto.quantity,
          type: StockMovementType.RECEIPT,
          createdByUserId: userId,
        },
      });
    });

    return { success: true, message: 'Receipt recorded' };
  }

  async writeOff(
    studioId: string,
    dto: CreateWriteOffDto,
    userRole?: string,
    userStudioId?: string,
    userId?: string,
  ) {
    this.ensureBranchAccess(studioId, userRole, userStudioId);
    if (!userId) throw new ForbiddenException('User required');

    const warehouse = await this.getOrCreateBranchWarehouse(studioId);
    const stock = await this.prisma.stock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: warehouse.id, productId: dto.productId },
      },
    });
    const available = stock?.quantity ?? 0;
    if (available < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${available}, requested write-off: ${dto.quantity}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.stock.update({
        where: {
          warehouseId_productId: { warehouseId: warehouse.id, productId: dto.productId },
        },
        data: { quantity: { decrement: dto.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          warehouseId: warehouse.id,
          productId: dto.productId,
          quantityDelta: -dto.quantity,
          type: StockMovementType.WRITE_OFF,
          createdByUserId: userId,
        },
      });
    });

    return { success: true, message: 'Write-off recorded' };
  }

  async getProductsForBranch(studioId: string, userRole?: string, userStudioId?: string) {
    this.ensureBranchAccess(studioId, userRole, userStudioId);
    return this.prisma.product.findMany({ orderBy: { name: 'asc' } });
  }

  async updateProductAtBranch(
    studioId: string,
    productId: string,
    dto: UpdateProductDto,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureBranchAccess(studioId, userRole, userStudioId);
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.product.update({
      where: { id: productId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.article !== undefined && { article: dto.article }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
      },
    });
  }

  async deleteProductAtBranch(
    studioId: string,
    productId: string,
    userRole?: string,
    userStudioId?: string,
  ) {
    this.ensureBranchAccess(studioId, userRole, userStudioId);
    const warehouse = await this.getOrCreateBranchWarehouse(studioId);
    const stock = await this.prisma.stock.findUnique({
      where: {
        warehouseId_productId: { warehouseId: warehouse.id, productId },
      },
    });
    if (stock && stock.quantity > 0) {
      throw new BadRequestException(
        'Cannot delete product with remaining stock. Write off first.',
      );
    }
    await this.prisma.stock.deleteMany({
      where: { warehouseId: warehouse.id, productId },
    });
    await this.prisma.product.delete({ where: { id: productId } });
    return { success: true };
  }
}
