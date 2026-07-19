import { IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RouterCommandAckDto {
  @ApiProperty()
  @IsString()
  commandId: string;

  @ApiProperty()
  @IsBoolean()
  success: boolean;

  @ApiPropertyOptional({ description: 'Arbitrary JSON-serializable result payload' })
  @IsOptional()
  resultData?: unknown;
}
