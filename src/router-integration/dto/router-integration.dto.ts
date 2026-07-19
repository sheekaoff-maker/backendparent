import { IsString, IsOptional, IsUUID, IsMACAddress, IsIP } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class RouterSetupDto {
  @ApiPropertyOptional({ description: 'Overrides auto-detection when the parent manually confirms a vendor in the Router Wizard' })
  @IsOptional()
  @IsString()
  vendorPluginId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ description: 'For vendors authenticating via API key/token instead of username+password' })
  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class ChangeDnsDto {
  @ApiProperty({ example: '1.1.1.1' })
  @IsIP()
  dnsServer: string;
}

export class RouterMacActionDto {
  @ApiProperty({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsMACAddress()
  macAddress: string;
}

export class EndGamingSessionDto {
  @ApiProperty()
  @IsUUID()
  deviceId: string;
}
