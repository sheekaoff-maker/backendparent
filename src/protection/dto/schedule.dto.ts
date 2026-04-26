import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpsertScheduleDto {
  @ApiProperty({ required: false, minimum: 0, maximum: 1440, description: 'Daily screen-time limit in minutes (null to disable)' })
  @IsOptional() @IsInt() @Min(0) @Max(1440)
  dailyLimitMinutes?: number | null;

  @ApiProperty({ required: false, example: '21:00', description: 'HH:MM 24h start of bedtime' })
  @IsOptional() @IsString() @Matches(HHMM)
  bedtimeStart?: string | null;

  @ApiProperty({ required: false, example: '07:00', description: 'HH:MM 24h end of bedtime' })
  @IsOptional() @IsString() @Matches(HHMM)
  bedtimeEnd?: string | null;

  @ApiProperty({ required: false, description: 'Enable automatic enforcement of the schedule' })
  @IsOptional() @IsBoolean()
  autoBlockEnabled?: boolean;
}
