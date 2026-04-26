import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateChildDto, UpdateChildDto } from './dto/child.dto';

@Injectable()
export class ChildrenService {
  constructor(private prisma: PrismaService) {}

  async create(parentId: string, dto: CreateChildDto) {
    return this.prisma.child.create({
      data: {
        parentId,
        name: dto.name,
        avatar: dto.avatar,
        age: dto.age,
        defaultLimit: dto.defaultLimitMinutes,
      },
    });
  }

  async findAll(parentId: string) {
    return this.prisma.child.findMany({
      where: { parentId },
      include: { devices: true },
    });
  }

  async findOne(parentId: string, id: string) {
    const child = await this.prisma.child.findUnique({
      where: { id },
      include: { devices: true, rules: true },
    });
    if (!child) throw new NotFoundException('Child not found');
    if (child.parentId !== parentId) throw new ForbiddenException('Not your child');
    return child;
  }

  async update(parentId: string, id: string, dto: UpdateChildDto) {
    await this.findOne(parentId, id);
    return this.prisma.child.update({
      where: { id },
      data: dto,
    });
  }

  async remove(parentId: string, id: string) {
    await this.findOne(parentId, id);
    await this.prisma.child.delete({ where: { id } });
  }
}
