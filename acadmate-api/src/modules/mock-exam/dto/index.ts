import { IsString, IsDateString, IsInt, IsOptional, IsBoolean, IsObject, Min, Max, IsArray, ValidateNested, IsIn, ArrayNotEmpty, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMockExamDto {
  @IsString() title: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() startsAt: string;
  @IsDateString() endsAt: string;
  @IsInt() @Min(10) @Max(300) durationMinutes: number;
}

export class UpdateMockExamDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsInt() @Min(10) @Max(300) durationMinutes?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AddParticipantDto {
  @IsString() phone: string;
  @IsOptional() @IsString() name?: string;
}

export class BulkAddParticipantsDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500) @IsString({ each: true }) phones: string[];
}



export class RegisterParticipantDto {
  @IsString() phone: string;
  @IsString() name: string;
  @IsString() pin: string; // 4-digit, validated in service
  // Avatar chosen at registration: a generated react-nice-avatar config OR an
  // uploaded image (data URL). Either may be present; both are optional.
  @IsOptional() @IsObject() avatarConfig?: Record<string, unknown>;
  @IsOptional() @IsString() avatarUrl?: string;
}

export class LoginParticipantDto {
  @IsString() phone: string;
  @IsString() pin: string;
}

class QuestionOptionDto {
  @IsString() label: string; // A B C D
  @IsString() text: string;
  @IsBoolean() isCorrect: boolean;
}

class UploadQuestionItemDto {
  @IsString() text: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => QuestionOptionDto) options: QuestionOptionDto[];
  @IsString() subject: string;
  @IsOptional() @IsString() explanation?: string;
}

export class UploadQuestionsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => UploadQuestionItemDto) questions: UploadQuestionItemDto[];
  // 'replace' (default) wipes existing questions; 'append' adds to them so a paper
  // can be built up across several uploads.
  @IsOptional() @IsIn(['replace', 'append']) mode?: 'replace' | 'append';
}

export class StartSessionDto {
  // Chosen elective subjects (compulsory subjects are added server-side).
  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true }) subjects?: string[];
}

export class SaveAnswerDto {
  @IsString() questionId: string;
  @IsOptional() @IsString() @IsIn(['A', 'B', 'C', 'D']) selected?: string;
}

export class PanicReportDto {
  @IsString() message: string;
  @IsOptional() @IsString() sessionId?: string;
}

export class ResolvePanicDto {
  @IsBoolean() isResolved: boolean;
}
