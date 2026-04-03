import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles, UserRole } from '../common/decorators/roles.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Список всех организаций (только DEVELOPER)' })
  @ApiResponse({ status: 200 })
  findAll() {
    return this.organizationsService.findAll();
  }

  @Get(':organizationId')
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Организация по id (только DEVELOPER)' })
  @ApiResponse({ status: 404 })
  findOne(@Param('organizationId') organizationId: string) {
    return this.organizationsService.findOne(organizationId);
  }

  @Post()
  @Roles(UserRole.DEVELOPER)
  @ApiOperation({ summary: 'Создать организацию (только DEVELOPER)' })
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }
}
