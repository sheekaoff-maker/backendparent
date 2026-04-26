import { ApiProperty } from '@nestjs/swagger';
import { BlockCategory } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AddDomainDto {
  @ApiProperty({ example: 'roblox.com' })
  @IsString()
  domain: string;

  @ApiProperty({ enum: ['GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM'] })
  @IsEnum(['GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM'])
  category: BlockCategory;

  @ApiProperty({ default: true, required: false })
  @IsOptional()
  @IsBoolean()
  wildcard?: boolean;
}

export class BulkImportItemDto {
  @ApiProperty()
  @IsString()
  domain: string;

  @ApiProperty({ enum: ['GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM'] })
  @IsEnum(['GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM'])
  category: BlockCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  wildcard?: boolean;
}

export class BulkImportDto {
  @ApiProperty({ type: [BulkImportItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportItemDto)
  items: BulkImportItemDto[];
}

export class SetCategoryBlockDto {
  @ApiProperty({ enum: ['GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM'] })
  @IsEnum(['GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM'])
  category: BlockCategory;

  @ApiProperty()
  @IsBoolean()
  active: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ClassifyDomainDto {
  @ApiProperty({ example: 'fortnite-cdn.com' })
  @IsString()
  domain: string;

  @ApiProperty({ enum: ['GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM'] })
  @IsEnum(['GAMING', 'STREAMING', 'SOCIAL', 'ADULT', 'CUSTOM'])
  category: BlockCategory;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  wildcard?: boolean;
}
