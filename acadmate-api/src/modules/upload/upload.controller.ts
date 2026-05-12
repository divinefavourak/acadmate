import {
  Controller,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

type UploadedMulterFile = { buffer: Buffer; mimetype: string; size: number; originalname: string };
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload image to Cloudinary (admin only)' })
  @ApiQuery({ name: 'folder', required: false, enum: ['questions', 'blog'] })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage() }),
  )
  uploadFile(
    @UploadedFile() file: UploadedMulterFile,
    @Query('folder') folder?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.uploadImage(file, folder);
  }
}
