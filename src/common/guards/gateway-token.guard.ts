import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class GatewayTokenGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-gateway-token'] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Missing gateway token');
    }
    const gateway = await this.prisma.gateway.findUnique({ where: { token } });
    if (!gateway || !gateway.paired) {
      throw new UnauthorizedException('Invalid or unpaired gateway token');
    }
    request.gateway = gateway;
    return true;
  }
}
