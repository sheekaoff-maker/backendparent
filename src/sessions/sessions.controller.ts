import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';
import { StartSessionDto, ExtendSessionDto } from './dto/session.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Sessions')
@Controller('sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionsController {
  constructor(private sessionsService: SessionsService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a new session' })
  async start(@CurrentUser('sub') parentId: string, @Body() dto: StartSessionDto) {
    return this.sessionsService.start(parentId, dto);
  }

  @Post(':id/pause')
  @ApiOperation({ summary: 'Pause an active session' })
  async pause(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.sessionsService.pause(id, parentId);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume a paused session' })
  async resume(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.sessionsService.resume(id, parentId);
  }

  @Post(':id/extend')
  @ApiOperation({ summary: 'Extend session time' })
  async extend(@CurrentUser('sub') parentId: string, @Param('id') id: string, @Body() dto: ExtendSessionDto) {
    return this.sessionsService.extend(id, parentId, dto);
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop a session' })
  async stop(@CurrentUser('sub') parentId: string, @Param('id') id: string) {
    return this.sessionsService.stop(id, parentId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active sessions' })
  async getActive(@CurrentUser('sub') parentId: string) {
    return this.sessionsService.getActiveSessions(parentId);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get session history' })
  async getHistory(@CurrentUser('sub') parentId: string) {
    return this.sessionsService.getHistory(parentId);
  }
}
