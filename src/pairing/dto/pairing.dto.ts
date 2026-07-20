import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIP, IsOptional, IsString, IsUUID } from 'class-validator';

export class StartPairingResponseDto {
  @ApiProperty() sessionId: string;
  @ApiProperty({ description: 'DNS resolver hostname/IP the device (or parent, for probing) should use' })
  dnsServer: string;
  @ApiProperty({ description: 'One-time pairing token, embedded in the QR code' }) token: string;
  @ApiProperty({ description: 'ISO timestamp the token expires' }) expiresAt: string;
  @ApiProperty({ description: 'Contents to encode as a QR code' }) qrPayload: string;
}

export class PairingStatusResponseDto {
  @ApiProperty({ enum: ['WAITING', 'PAIRED', 'EXPIRED', 'FAILED'] }) pairStatus: string;
  @ApiProperty() paired: boolean;
  @ApiPropertyOptional() pairedAt?: string | null;
  @ApiPropertyOptional() dnsSourceIp?: string | null;
  @ApiPropertyOptional() publicIp?: string | null;
  @ApiPropertyOptional() resolverRegion?: string | null;
  @ApiPropertyOptional() lastDnsSeenAt?: string | null;
  @ApiProperty({ enum: ['EXCELLENT', 'GOOD', 'POOR', 'OFFLINE'] }) connectionQuality: string;
  @ApiPropertyOptional({
    description:
      'Long-lived token for silent background IP-reaffirmation probes (see pairing_probe_service.dart). ' +
      'Only present once paired — store it on-device, never re-fetch over an untrusted network.',
  })
  beaconToken?: string | null;
}

/** Internal-only — called by dns-service, not by Flutter. Never publicly exposed. */
export class ConfirmPairingDto {
  @ApiProperty() @IsUUID() token: string;
  @ApiProperty({ description: 'Source IP the DNS probe query arrived from' })
  @IsIP()
  sourceIp: string;
  @ApiPropertyOptional() @IsOptional() @IsString() resolverRegion?: string;
}

export class ConnectionEventDto {
  @ApiProperty() id: string;
  @ApiProperty() type: string;
  @ApiPropertyOptional() ipAddress?: string | null;
  @ApiPropertyOptional() metadata?: Record<string, unknown> | null;
  @ApiProperty() createdAt: string;
}

export class IpHistoryEntryDto {
  @ApiProperty() ipAddress: string;
  @ApiProperty() firstSeenAt: string;
  @ApiProperty() lastSeenAt: string;
}

export class ConnectionStatsResponseDto {
  @ApiProperty() paired: boolean;
  @ApiProperty({ enum: ['EXCELLENT', 'GOOD', 'POOR', 'OFFLINE'] }) connectionQuality: string;
  @ApiPropertyOptional() lastDnsSeenAt?: string | null;
  @ApiPropertyOptional() dnsSourceIp?: string | null;
  @ApiPropertyOptional() publicIp?: string | null;
  @ApiPropertyOptional() resolverRegion?: string | null;
  @ApiProperty({ description: 'DNS queries resolved for this device since midnight UTC' }) queriesToday: number;
  @ApiPropertyOptional({ description: 'Domain of the most recent DNS query, if any' }) lastQueryDomain?: string | null;
  @ApiProperty({ type: [ConnectionEventDto] }) recentEvents: ConnectionEventDto[];
  @ApiProperty({ type: [IpHistoryEntryDto] }) ipHistory: IpHistoryEntryDto[];
}
