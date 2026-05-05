import { IsString, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MarkReviewDto {
  @ApiProperty()
  @IsString()
  questionId: string;

  @ApiProperty()
  @IsBoolean()
  markedReview: boolean;
}
