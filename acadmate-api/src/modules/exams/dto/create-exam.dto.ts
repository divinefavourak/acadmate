import {
  IsString,
  IsArray,
  IsOptional,
  IsInt,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  IsIn,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExamDto {
  @ApiProperty({ enum: ['MOCK', 'PRACTICE', 'TOPIC', 'POST_UTME'] })
  @IsIn(['MOCK', 'PRACTICE', 'TOPIC', 'POST_UTME'])
  mode: 'MOCK' | 'PRACTICE' | 'TOPIC' | 'POST_UTME';

  // ─── MOCK fields ──────────────────────────────────────────────────────────
  @ApiPropertyOptional({ type: [String], minItems: 3, maxItems: 3 })
  @ValidateIf((o) => o.mode === 'MOCK')
  @IsArray()
  @ArrayMinSize(3, { message: 'Select exactly 3 subjects' })
  @ArrayMaxSize(3, { message: 'Select exactly 3 subjects' })
  @IsString({ each: true })
  subjectIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proseTextId?: string;

  // ─── PRACTICE & TOPIC fields ──────────────────────────────────────────────
  @ApiPropertyOptional()
  @ValidateIf((o) => o.mode === 'PRACTICE' || o.mode === 'TOPIC')
  @IsString()
  subjectId?: string;

  // ─── TOPIC fields ─────────────────────────────────────────────────────────
  @ApiPropertyOptional()
  @ValidateIf((o) => o.mode === 'TOPIC')
  @IsString()
  topicId?: string;

  // ─── POST_UTME fields ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Target institution (POST_UTME mode)' })
  @ValidateIf((o) => o.mode === 'POST_UTME')
  @IsString()
  school?: string;

  @ApiPropertyOptional({ description: 'Filter by exam year (POST_UTME mode, optional)' })
  @IsOptional()
  @IsInt()
  @Min(1980)
  @Max(2100)
  year?: number;

  // ─── Shared overrides ─────────────────────────────────────────────────────
  @ApiPropertyOptional({ description: 'Defaults to 40 for PRACTICE, 20 for TOPIC, 40 for POST_UTME' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  questionCount?: number;
}
