import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Request } from 'express';
import { ParentsService } from './parents.service';
import {
  renderPrivacyPolicyHtml,
  renderPrivacyRequestHtml,
} from './legal-pages';

class SubmitPrivacyRequestDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    enum: ['delete_account', 'privacy_question'],
    default: 'delete_account',
  })
  @IsOptional()
  @IsIn(['delete_account', 'privacy_question'])
  requestType?: 'delete_account' | 'privacy_question';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

@ApiTags('Legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly parentsService: ParentsService) {}

  @Get('privacy-policy')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Public privacy policy page for Play Store review' })
  getPrivacyPolicy(@Req() request: Request) {
    return renderPrivacyPolicyHtml(this.getBaseUrl(request));
  }

  @Get('privacy-request')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Public privacy and account deletion request page for Play Store review',
  })
  getPrivacyRequestPage(@Req() request: Request) {
    return renderPrivacyRequestHtml(this.getBaseUrl(request));
  }

  @Post('privacy-request')
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({
    summary: 'Submit a public privacy or account deletion request',
  })
  async submitPrivacyRequest(
    @Body() dto: SubmitPrivacyRequestDto,
    @Req() request: Request,
    @Ip() ipAddress: string,
  ) {
    await this.parentsService.submitPrivacyRequest({
      email: dto.email,
      requestType: dto.requestType,
      message: dto.message,
      ipAddress,
    });

    return renderPrivacyRequestHtml(
      this.getBaseUrl(request),
      'Your request has been received.',
    );
  }

  private getBaseUrl(request: Request) {
    const forwardedProto = request.headers['x-forwarded-proto'];
    const protocol =
      (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto) ||
      request.protocol ||
      'https';
    const host = request.get('host') || 'backendparent-production.up.railway.app';
    return `${protocol}://${host}`;
  }
}
