import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ExamMode } from '@prisma/client';

export class CreateLiveSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  // The exam mode is stored for labelling; live papers are composed from
  // subjectIds + questionCount regardless of mode.
  @IsOptional()
  @IsEnum(ExamMode)
  mode?: ExamMode;

  // Empty array means "draw from the entire published question bank".
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subjectIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(240)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  questionCount?: number;
}
