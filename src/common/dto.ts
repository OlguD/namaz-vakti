import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class CoordinatesQuery {
  @ApiProperty({ example: 41.0082 })
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 28.9784 })
  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  lng: number;
}
