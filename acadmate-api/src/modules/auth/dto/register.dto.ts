import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Adaeze Okonkwo' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'adaeze@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '08012345678', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s()-]{10,20}$/, { message: 'Enter a valid phone number' })
  phone?: string;

  @ApiProperty({ example: 'strongpassword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
