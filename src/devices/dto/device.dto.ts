import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsIP,
  IsMACAddress,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType, ControlMethod } from '@prisma/client';

export class CreateDeviceDto {
  @ApiProperty({ description: 'Child ID to assign device to' })
  @IsUUID()
  childId: string;

  @ApiProperty({ example: "John's iPad" })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty({ enum: DeviceType })
  @IsEnum(DeviceType)
  type: DeviceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  platform?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @IsMACAddress()
  macAddress?: string;

  @ApiPropertyOptional({ example: '192.168.1.45' })
  @IsOptional()
  @IsIP()
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
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  childId?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @IsMACAddress()
  macAddress?: string;

  @ApiPropertyOptional({ example: '192.168.1.45' })
  @IsOptional()
  @IsIP()
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
