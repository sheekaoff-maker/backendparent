import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType, ControlMethod } from '@prisma/client';

export class CreateDeviceDto {
  @ApiProperty({ description: 'Child ID to assign device to' })
  @IsUUID()
  childId: string;

  @ApiProperty({ example: 'John\'s iPad' })
  @IsString()
  name: string;

  @ApiProperty({ enum: DeviceType })
  @IsEnum(DeviceType)
  type: DeviceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ enum: ControlMethod, default: ControlMethod.MOCK })
  @IsEnum(ControlMethod)
  @IsOptional()
  controlMethod?: ControlMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gatewayId?: string;
}

export class UpdateDeviceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(ControlMethod)
  controlMethod?: ControlMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gatewayId?: string;
}
