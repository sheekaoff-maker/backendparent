import { IsUUID, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartSessionDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;

  @ApiProperty({ description: 'Duration in minutes' })
  @IsInt()
  @Min(1)
  durationMinutes: number;
}

export class ExtendSessionDto {
  @ApiProperty({ description: 'Extra minutes to add' })
  @IsInt()
  @Min(1)
  extraMinutes: number;
}
