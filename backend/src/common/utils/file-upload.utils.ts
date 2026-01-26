// src/common/utils/file-upload.utils.ts
import { UnsupportedMediaTypeException } from '@nestjs/common';
import { Request } from 'express';

export const videoFileFilter = (
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
) => {
    if (!file.mimetype.startsWith('video/')) {
        return callback(
            new UnsupportedMediaTypeException('Only video files are allowed'),
            false,
            );
    }
    callback(null, true);
};