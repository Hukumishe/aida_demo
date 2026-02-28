import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WarehouseService } from './warehouse.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateTransferDto, TransferToBranchDto } from './dto/create-transfer.dto';
import { CreateReceiptDto, CreateWriteOffDto } from './dto/create-movement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('warehouse')
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  // ---------- Центральный склад (только OWNER, DEPUTY_OWNER) ----------
  @Get('warehouse/central')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Get central warehouse and stock' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  getCentral(@CurrentUser() user?: any) {
    return this.warehouseService.getCentralWarehouse(user?.role);
  }

  @Get('warehouse/central/branches')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'List branch warehouses (for transfer destination)' })
  @ApiResponse({ status: 200 })
  listBranches(@CurrentUser() user?: any) {
    return this.warehouseService.listBranchWarehouses(user?.role);
  }

  @Get('warehouse/central/history')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Movement history: all transfers from central warehouse' })
  @ApiResponse({ status: 200 })
  getCentralHistory(@CurrentUser() user?: any) {
    return this.warehouseService.getCentralMovementHistory(user?.role);
  }

  @Get('warehouse/central/products')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'List all products (catalog)' })
  @ApiResponse({ status: 200 })
  listProducts(@CurrentUser() user?: any) {
    return this.warehouseService.listProducts(user?.role);
  }

  @Post('warehouse/central/products')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Add product (optional initial quantity on central)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403 })
  async createProductCentral(
    @Body() dto: CreateProductDto,
    @CurrentUser() user?: any,
  ) {
    const central = await this.warehouseService.getCentralWarehouse(user?.role);
    return this.warehouseService.createProduct(
      dto,
      central.id,
      user?.role,
      user?.studioId,
    );
  }

  @Patch('warehouse/central/products/:id')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  updateProductCentral(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.updateProduct(id, dto, user?.role, user?.studioId);
  }

  @Delete('warehouse/central/products/:id')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Delete product (only if no stock anywhere)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  deleteProductCentral(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.deleteProduct(id, user?.role);
  }

  @Post('warehouse/central/transfer')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Transfer from central to branch warehouse' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  transferFromCentral(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.createTransferFromCentral(
      dto,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Post('warehouse/central/receipt')
  @Roles(UserRole.OWNER, UserRole.DEPUTY_OWNER)
  @ApiOperation({ summary: 'Record receipt (приход) on central warehouse only' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404 })
  receiptCentral(
    @Body() dto: CreateReceiptDto,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.receiptAtCentral(
      dto,
      user?.role,
      user?.userId,
    );
  }

  // ---------- Склад филиала ----------
  @Get('studios/:studioId/warehouse')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Get branch warehouse and stock' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  @ApiResponse({ status: 404 })
  getBranch(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.getBranchWarehouse(
      studioId,
      user?.role,
      user?.studioId,
    );
  }

  @Get('studios/:studioId/warehouse/history')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Movement history: transfers in, receipts, write-offs for this branch' })
  @ApiResponse({ status: 200 })
  getBranchHistory(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.getBranchMovementHistory(
      studioId,
      user?.role,
      user?.studioId,
    );
  }

  @Get('studios/:studioId/warehouse/products')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'List products (for dropdowns)' })
  @ApiResponse({ status: 200 })
  getBranchProducts(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.getProductsForBranch(
      studioId,
      user?.role,
      user?.studioId,
    );
  }

  @Post('studios/:studioId/warehouse/products')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Add product (optional initial quantity on branch)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403 })
  async createProductBranch(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() dto: CreateProductDto,
    @CurrentUser() user?: any,
  ) {
    const branch = await this.warehouseService.getBranchWarehouse(
      studioId,
      user?.role,
      user?.studioId,
    );
    return this.warehouseService.createProduct(
      dto,
      branch.id,
      user?.role,
      user?.studioId,
    );
  }

  @Patch('studios/:studioId/warehouse/products/:productId')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Update product' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  updateProductBranch(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.updateProductAtBranch(
      studioId,
      productId,
      dto,
      user?.role,
      user?.studioId,
    );
  }

  @Delete('studios/:studioId/warehouse/products/:productId')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Delete product (only if no stock at this branch)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  deleteProductBranch(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.deleteProductAtBranch(
      studioId,
      productId,
      user?.role,
      user?.studioId,
    );
  }

  @Post('studios/:studioId/warehouse/transfer')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Transfer from central to this branch' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  transferToBranch(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() dto: TransferToBranchDto,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.createTransferToBranch(
      studioId,
      dto,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Post('studios/:studioId/warehouse/receipt')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Record receipt (приход)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404 })
  receipt(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() dto: CreateReceiptDto,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.receipt(
      studioId,
      dto,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }

  @Post('studios/:studioId/warehouse/write-off')
  @UseGuards(StudioAccessGuard)
  @ApiOperation({ summary: 'Record write-off (списание)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400 })
  @ApiResponse({ status: 404 })
  writeOff(
    @Param('studioId', ParseUUIDPipe) studioId: string,
    @Body() dto: CreateWriteOffDto,
    @CurrentUser() user?: any,
  ) {
    return this.warehouseService.writeOff(
      studioId,
      dto,
      user?.role,
      user?.studioId,
      user?.userId,
    );
  }
}
