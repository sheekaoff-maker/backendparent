import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BlockCategory } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { SEED_DOMAINS } from './seed-domains';

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultDomainsIfEmpty();
  }

  /**
   * Seed default gaming/streaming/social/adult domains if blocked_domains table is empty.
   * Idempotent: safe to call multiple times.
   */
  async seedDefaultDomainsIfEmpty() {
    try {
      const count = await this.prisma.blockedDomain.count();
      if (count > 0) {
        this.logger.log(`BlockedDomain table has ${count} entries — skipping seed`);
        return;
      }
      this.logger.log(`Seeding ${SEED_DOMAINS.length} default domains...`);
      await this.prisma.blockedDomain.createMany({
        data: SEED_DOMAINS,
        skipDuplicates: true,
      });
      this.logger.log(`Seeded default domains successfully`);
    } catch (err: any) {
      this.logger.warn(`Failed to seed domains: ${err.message}`);
    }
  }

  async listAll() {
    return this.prisma.blockedDomain.findMany({ orderBy: { domain: 'asc' } });
  }

  async listByCategory(category: BlockCategory) {
    return this.prisma.blockedDomain.findMany({
      where: { category },
      orderBy: { domain: 'asc' },
    });
  }

  async addDomain(domain: string, category: BlockCategory, wildcard = true) {
    return this.prisma.blockedDomain.upsert({
      where: { domain: domain.toLowerCase() },
      update: { category, wildcard },
      create: { domain: domain.toLowerCase(), category, wildcard },
    });
  }

  async bulkImport(items: Array<{ domain: string; category: BlockCategory; wildcard?: boolean }>) {
    const data = items.map((i) => ({
      domain: i.domain.toLowerCase(),
      category: i.category,
      wildcard: i.wildcard ?? true,
    }));
    const result = await this.prisma.blockedDomain.createMany({
      data,
      skipDuplicates: true,
    });
    return { imported: result.count, total: items.length };
  }

  async deleteDomain(id: string) {
    return this.prisma.blockedDomain.delete({ where: { id } });
  }

  async setCategoryBlock(childId: string, category: BlockCategory, active: boolean, reason?: string) {
    return this.prisma.categoryBlock.upsert({
      where: { childId_category: { childId, category } },
      update: { active, reason },
      create: { childId, category, active, reason },
    });
  }

  async getCategoryBlocksForChild(childId: string) {
    return this.prisma.categoryBlock.findMany({
      where: { childId, active: true },
    });
  }

  async listCategoryBlocks(childId: string) {
    return this.prisma.categoryBlock.findMany({ where: { childId } });
  }
}
