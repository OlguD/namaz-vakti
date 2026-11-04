import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

export const SUPPORTED_LOCALES = ['tr', 'en', 'ar', 'de', 'fr', 'nl'] as const;

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Ahmet' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Length(3, 24)
  displayName?: string;

  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;

  @ApiPropertyOptional({ nullable: true, description: 'Default district for prayer times' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  districtId?: string | null;
}
