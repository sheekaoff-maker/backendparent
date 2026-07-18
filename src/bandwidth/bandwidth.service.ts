import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateBandwidthLimitDto, UpdateBandwidthLimitDto } from './dto/bandwidth.dto';

@Injectable()
export class BandwidthService {
  constructor(private prisma: PrismaService) {}

  async create(parentId: string, dto: CreateBandwidthLimitDto) {
    if (!dto.childId && !dto.deviceId) {
      throw new BadRequestException('One of childId or deviceId is required');
    }
    if (dto.childId && dto.deviceId) {
      throw new BadRequestException('Provide only one of childId or deviceId, not both');
    }
    if (dto.downloadKbps === undefined && dto.uploadKbps === undefined) {
      throw new BadRequestException('At least one of downloadKbps or uploadKbps is required');
    }

    if (dto.deviceId) {
      const device = await this.prisma.device.findUnique({ where: { id: dto.deviceId } });
      if (!device) throw new NotFoundException('Device not found');
      if (device.parentId !== parentId) throw new ForbiddenException('Not your device');
    }
    if (dto.childId) {
      const child = await this.prisma.child.findUnique({ where: { id: dto.childId } });
      if (!child) throw new NotFoundException('Child not found');
      if (child.parentId !== parentId) throw new ForbiddenException('Not your child');
    }

    return this.prisma.bandwidthLimit.create({
      data: {
        parentId,
        childId: dto.childId,
        deviceId: dto.deviceId,
        category: dto.category,
        downloadKbps: dto.downloadKbps,
        uploadKbps: dto.uploadKbps,
      },
    });
  }

  async findAll(parentId: string) {
    return this.prisma.bandwidthLimit.findMany({ where: { parentId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(parentId: string, id: string) {
    const limit = await this.prisma.bandwidthLimit.findUnique({ where: { id } });
    if (!limit) throw new NotFoundException('Bandwidth limit not found');
    if (limit.parentId !== parentId) throw new ForbiddenException('Not yours');
    return limit;
  }

  async update(parentId: string, id: string, dto: UpdateBandwidthLimitDto) {
    await this.findOne(parentId, id);
    return this.prisma.bandwidthLimit.update({ where: { id }, data: dto });
  }

  async remove(parentId: string, id: string) {
    await this.findOne(parentId, id);
    await this.prisma.bandwidthLimit.delete({ where: { id } });
  }
}
