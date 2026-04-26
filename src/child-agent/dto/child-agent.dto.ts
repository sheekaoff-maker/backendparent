import { IsUUID, IsString, IsInt, IsOptional, IsBoolean, IsArray, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceType, ControlMethod } from '@prisma/client';

export class RegisterDeviceDto {
  @ApiProperty()
  @IsUUID()
  childId: string;

  @ApiProperty()
  @IsString()
  deviceName: string;

  @ApiProperty({ enum: DeviceType })
  @IsString()
  deviceType: DeviceType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  macAddress?: string;
}

export class CommandAckDto {
  @ApiProperty()
  @IsUUID()
  commandId: string;

  @ApiProperty()
  @IsBoolean()
  success: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resultData?: string;
}

export class UsageLogFromAgentDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;

  @ApiProperty()
  @IsUUID()
  childId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  durationSeconds: number;
}

export class RequestMoreTimeDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  requestedMinutes: number;
}

export class ChildStatusDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  activeApp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  screenTimeRemaining?: string;
}
