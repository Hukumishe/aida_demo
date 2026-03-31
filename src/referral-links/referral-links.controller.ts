import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ReferralLinksService } from './referral-links.service';
import { CreateStudioReferralLinkDto } from './dto/create-referral-link.dto';
import { UpdateStudioReferralLinkDto } from './dto/update-referral-link.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { StudioAccessGuard } from '../common/guards/studio-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('referral-links')
@Controller()
export class ReferralLinksController {
  constructor(private readonly referralLinksService: ReferralLinksService) {}

  @Public()
  @Get('studios/:studioId/referral-links/resolve/:linkId')
  @ApiOperation({
    summary:
      'Проверка маркетинговой ссылки (лендинг): активна ли, название источника для отображения',
  })
  async resolve(
    @Param('studioId') studioId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.referralLinksService.resolveForLanding(studioId, linkId);
  }

  @Get('studios/:studioId/referral-links')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Список реферальных ссылок филиала' })
  async findAll(
    @Param('studioId') studioId: string,
    @CurrentUser() user: { role: string; studioId?: string },
  ) {
    return this.referralLinksService.findAll(studioId, user.role, user.studioId);
  }

  @Post('studios/:studioId/referral-links')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создать ссылку (только владелец / заместитель)' })
  async create(
    @Param('studioId') studioId: string,
    @Body() dto: CreateStudioReferralLinkDto,
    @CurrentUser() user: { role: string; studioId?: string },
  ) {
    return this.referralLinksService.create(studioId, dto, user.role, user.studioId);
  }

  @Patch('studios/:studioId/referral-links/:linkId')
  @UseGuards(JwtAuthGuard, RolesGuard, StudioAccessGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Обновить ссылку: активность, название источника, кэшбэк (только владелец / заместитель)',
  })
  async update(
    @Param('studioId') studioId: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateStudioReferralLinkDto,
    @CurrentUser() user: { role: string; studioId?: string },
  ) {
    return this.referralLinksService.update(studioId, linkId, dto, user.role, user.studioId);
  }
}
