import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RouterCommandService } from './router-command.service';
import { RouterCommandAckDto } from './dto/router-command.dto';
import { GatewayTokenGuard } from '../common/guards/gateway-token.guard';

@ApiTags('Router Integration')
@Controller('gateway/router-commands')
@UseGuards(GatewayTokenGuard)
export class RouterCommandController {
  constructor(private routerCommandService: RouterCommandService) {}

  @Get()
  @ApiOperation({ summary: 'Poll pending router commands + connection info (gateway-agent, Router Integration Engine)' })
  async getPending(@Req() req: any) {
    const [commands, routerConnection] = await Promise.all([
      this.routerCommandService.getPendingCommands(req.gateway.id),
      this.routerCommandService.getRouterConnectionInfo(req.gateway.id),
    ]);
    return { commands, routerConnection };
  }

  @Post('ack')
  @ApiOperation({ summary: 'Acknowledge a router command result (gateway-agent, Router Integration Engine)' })
  async ack(@Req() req: any, @Body() dto: RouterCommandAckDto) {
    return this.routerCommandService.acknowledgeCommand(req.gateway.id, dto.commandId, dto.success, dto.resultData);
  }
}
