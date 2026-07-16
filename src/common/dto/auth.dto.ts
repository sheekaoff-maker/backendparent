import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  // NOTE: `role` is intentionally NOT accepted here. Public self-registration
  // always creates a PARENT account. Accepting a client-supplied role would be a
  // privilege-escalation vector (mass assignment). Elevated roles are provisioned
  // out-of-band only.
  @ApiProperty({ example: 'StrongP@ss123' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'parent@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongP@ss123' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: Role })
  role: Role;
}
