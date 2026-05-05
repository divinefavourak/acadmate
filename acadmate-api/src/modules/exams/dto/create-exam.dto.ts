import {
  IsString,
  IsArray,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── MOCK exam ──────────────────────────────────────────────────────────────
export class CreateMockExamDto {
  @ApiProperty({ enum: ['MOCK'] })
  @IsIn(['MOCK'])
  mode: 'MOCK';

  @ApiProperty({ type: [String], minItems: 3, maxItems: 3 })
  @IsArray()
  @ArrayMinSize(3, { message: 'Select exactly 3 subjects (Use of English is included automatically)' })
  @ArrayMaxSize(3, { message: 'Select exactly 3 subjects (Use of English is included automatically)' })
  @IsString({ each: true })
  subjectIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proseTextId?: string;
}

// ─── PRACTICE exam ───────────────────────────────────────────────────────────
export class CreatePracticeExamDto {
  @ApiProperty({ enum: ['PRACTICE'] })
  @IsIn(['PRACTICE'])
  mode: 'PRACTICE';

  @ApiProperty()
  @IsString()
  subjectId: string;

  @ApiProperty({ default: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  questionCount?: number = 40;
}

// ─── TOPIC exam ───────────────────────────────────────────────────────────────
export class CreateTopicExamDto {
  @ApiProperty({ enum: ['TOPIC'] })
  @IsIn(['TOPIC'])
  mode: 'TOPIC';

  @ApiProperty()
  @IsString()
  subjectId: string;

  @ApiProperty()
  @IsString()
  topicId: string;

  @ApiProperty({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  questionCount?: number = 20;
}

// ─── Union type (controller accepts any of the three) ────────────────────────
export type CreateExamDto =
  | CreateMockExamDto
  | CreatePracticeExamDto
  | CreateTopicExamDto;
