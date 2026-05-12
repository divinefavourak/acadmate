import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { createHash } from 'crypto';

type UploadedMulterFile = { buffer: Buffer; mimetype: string; size: number; originalname: string };

@Injectable()
export class UploadService {
  private readonly cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  private readonly apiKey = process.env.CLOUDINARY_API_KEY;
  private readonly apiSecret = process.env.CLOUDINARY_API_SECRET;

  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  private readonly maxSizeBytes = 5 * 1024 * 1024; // 5 MB

  // Whitelist of caller-supplied folder hints. Mapping to a fixed Cloudinary
  // folder (rather than letting the client pass arbitrary strings) prevents an
  // admin from polluting the asset tree with unexpected paths.
  private readonly folderMap: Record<string, string> = {
    questions: 'acadmate/questions',
    blog: 'acadmate/blog',
  };

  async uploadImage(
    file: UploadedMulterFile,
    folderKey: string = 'questions',
  ): Promise<{ url: string }> {
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, GIF, or WebP images are allowed');
    }

    if (file.size > this.maxSizeBytes) {
      throw new BadRequestException('Image must be under 5 MB');
    }

    const folder = this.folderMap[folderKey] ?? this.folderMap.questions;
    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary signature (identical to existing Next.js upload route)
    const toSign = `folder=${folder}&timestamp=${timestamp}${this.apiSecret}`;
    const signature = createHash('sha1').update(toSign).digest('hex');

    const b64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const body = new FormData();
    body.append('file', b64);
    body.append('folder', folder);
    body.append('api_key', this.apiKey!);
    body.append('timestamp', String(timestamp));
    body.append('signature', signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      { method: 'POST', body },
    );

    if (!res.ok) {
      const detail = await res.text();
      throw new InternalServerErrorException(`Cloudinary upload failed: ${detail}`);
    }

    const data = await res.json() as { secure_url: string };
    return { url: data.secure_url };
  }
}
