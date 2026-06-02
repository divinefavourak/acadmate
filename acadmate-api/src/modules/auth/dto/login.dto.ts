import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  // Email address or phone number — resolved server-side.
  @ApiProperty({ example: 'adaeze@example.com or 08012345678' })
  @IsString()
  @MinLength(1)
  identifier: string;

  @ApiProperty({ example: 'strongpassword123' })
  @IsString()
  @MinLength(1)
  password: string;
}
