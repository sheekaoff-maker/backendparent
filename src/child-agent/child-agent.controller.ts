import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChildAgentService } from './child-agent.service';
import {
  RegisterDeviceDto,
  CommandAckDto,
  UsageLogFromAgentDto,
  RequestMoreTimeDto,
  ChildStatusDto,
} from './dto/child-agent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Child Agent')
@Controller('child')
export class ChildAgentController {
  constructor(private childAgentService: ChildAgentService) {}

  @Post('register-device')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register a device from child agent' })
  async registerDevice(@CurrentUser('sub') parentId: string, @Body() dto: RegisterDeviceDto) {
    return this.childAgentService.registerDevice(parentId, dto);
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get rules for child (polled by agent)' })
  async getRules(@Query('childId') childId: string) {
    return this.childAgentService.getRules(childId);
  }

  @Get('commands')
  @ApiOperation({ summary: 'Get pending commands for device (polled by agent)' })
  async getCommands(@Query('deviceId') deviceId: string) {
    return this.childAgentService.getCommands(deviceId);
  }

  @Post('command-ack')
  @ApiOperation({ summary: 'Acknowledge a command from child agent' })
  async acknowledgeCommand(@Body() dto: CommandAckDto) {
    return this.childAgentService.acknowledgeCommand(dto);
  }

  @Post('usage-log')
  @ApiOperation({ summary: 'Report usage from child agent' })
  async reportUsage(@Body() dto: UsageLogFromAgentDto) {
    return this.childAgentService.reportUsage(dto);
  }

  @Post('request-more-time')
  @ApiOperation({ summary: 'Child requests more screen time' })
  async requestMoreTime(@Body() dto: RequestMoreTimeDto) {
    return this.childAgentService.requestMoreTime(dto);
  }

  @Post('status')
  @ApiOperation({ summary: 'Report device status from child agent' })
  async reportStatus(@Body() dto: ChildStatusDto) {
    return this.childAgentService.reportStatus(dto);
  }
}
