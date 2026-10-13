import { ApiProperty } from '@nestjs/swagger';
import { AcademicDegreeType } from '../enums/application-completion.enum.js';
import { DegreeLevel } from '../enums/master-data.enum.js';

export class LookupOptionDto {
  @ApiProperty({ example: DegreeLevel.Bachelor })
  code!: string;

  @ApiProperty({ example: 'Bachelor' })
  label!: string;
}

export class LookupListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 3 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class DegreeLevelListResponseDto {
  @ApiProperty({
    type: [LookupOptionDto],
    example: [
      { code: DegreeLevel.Bachelor, label: 'Bachelor' },
      { code: DegreeLevel.Master, label: 'Master' },
      { code: DegreeLevel.Doctorate, label: 'Doctorate' },
    ],
  })
  items!: LookupOptionDto[];

  @ApiProperty({ type: LookupListMetaDto })
  meta!: LookupListMetaDto;
}

export class AcademicDegreeTypeListResponseDto {
  @ApiProperty({
    type: [LookupOptionDto],
    example: [
      { code: AcademicDegreeType.MATRIC, label: 'Matric / SSC' },
      { code: AcademicDegreeType.FSC, label: 'Intermediate / FSc / HSSC' },
      { code: AcademicDegreeType.BACHELOR, label: 'Bachelor' },
    ],
  })
  items!: LookupOptionDto[];

  @ApiProperty({ type: LookupListMetaDto })
  meta!: LookupListMetaDto;
}
