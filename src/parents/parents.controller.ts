import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ParentsService } from './parents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;
}

@ApiTags('Parents')
@Controller('parents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ParentsController {
  constructor(private parentsService: ParentsService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get parent profile' })
  async getProfile(@CurrentUser('sub') userId: string) {
    return this.parentsService.getProfile(userId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update parent profile' })
  async updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.parentsService.updateProfile(userId, dto);
  }

  @Get('subscription')
  @ApiOperation({ summary: 'Get subscription status' })
  async getSubscription(@CurrentUser('sub') userId: string) {
    return this.parentsService.getSubscription(userId);
  }
}
