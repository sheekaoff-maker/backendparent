import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRuleDto) {
    return this.prisma.rule.create({
      data: {
        childId: dto.childId,
        type: dto.type,
        value: dto.value,
        startTime: dto.startTime,
        endTime: dto.endTime,
        daysOfWeek: dto.daysOfWeek,
        blockedApps: dto.blockedApps || [],
        blockedCategories: dto.blockedCategories || [],
        extraMinutes: dto.extraMinutes,
      },
    });
  }

  async findByChild(childId: string) {
    return this.prisma.rule.findMany({
      where: { childId, active: true },
    });
  }

  async findAll(parentId: string) {
    return this.prisma.rule.findMany({
      where: { child: { parentId } },
      include: { child: { select: { id: true, name: true } } },
    });
  }

  async findOne(id: string) {
    const rule = await this.prisma.rule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  async update(id: string, dto: UpdateRuleDto) {
    await this.findOne(id);
    return this.prisma.rule.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.rule.delete({ where: { id } });
  }

  async getDailyLimit(childId: string): Promise<number | null> {
    const rule = await this.prisma.rule.findFirst({
      where: { childId, type: 'DAILY_LIMIT', active: true },
    });
    if (!rule) return null;
    return parseInt(rule.value, 10);
  }

  async getActiveRulesForChild(childId: string) {
    return this.prisma.rule.findMany({
      where: { childId, active: true },
    });
  }
}
