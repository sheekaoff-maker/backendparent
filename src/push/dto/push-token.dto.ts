import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

export class RegisterPushTokenDto {
  @ApiProperty({ description: 'FCM registration token from the device' })
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token: string;

  @ApiProperty({ enum: PUSH_PLATFORMS })
  @IsIn(PUSH_PLATFORMS)
  platform: PushPlatform;
}

export class UnregisterPushTokenDto {
  @ApiProperty({ description: 'FCM registration token to remove' })
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token: string;
}
