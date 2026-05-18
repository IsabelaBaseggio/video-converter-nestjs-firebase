// src/ffmpeg/ffmpeg.service.ts
import { Injectable } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';

@Injectable()
export class FFmpegService {
    convertTo720p(
        inputPath: string,
        outputPath: string,
        onProgress?: (percent: number) => void,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .videoFilter('scale=-2:720')
                .videoCodec('libx264')
                .outputOptions(['-pix_fmt yuv420p', '-preset fast'])
                .output(outputPath)
                .on('progress', (progress) => {
                    if (onProgress && progress.percent) {
                        onProgress(Math.round(progress.percent));
                    }
                })
                .on('end', () => resolve())
                .on('error', (err) => reject(new Error(`FFmpeg failed: ${err.message}`)))
                .run();
        });
    }
}