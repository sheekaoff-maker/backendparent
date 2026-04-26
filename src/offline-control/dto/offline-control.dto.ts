import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SetSetupStatusDto {
  @ApiProperty({ description: 'Mark setup as completed (true) or reset (false)' })
  @IsBoolean()
  completed: boolean;

  @ApiProperty({ required: false, description: 'Parent verified the setup is working (e.g. tested PIN)' })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiProperty({
    required: false,
    description:
      'Vendor method used (e.g. XBOX_FAMILY_SAFETY, SONY_PARENTAL_CONTROLS, NINTENDO_PARENTAL_CONTROLS)',
  })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ChecklistDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  pinEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  childAccountLinked?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  playTimeLimitEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  ageRatingEnabled?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  purchasesBlocked?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsBoolean()
  networkSettingsLocked?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  notes?: string;
}
