import {
  IsArray,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SaveAnswerItemDto {
  @ApiProperty()
  @IsString()
  questionId: string;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @IsString()
  optionId: string | null;
}

export class SaveAnswersDto {
  @ApiProperty({ type: [SaveAnswerItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveAnswerItemDto)
  answers: SaveAnswerItemDto[];
}
