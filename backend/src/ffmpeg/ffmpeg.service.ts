// src/ffmpeg/ffmpeg.service.ts
import { Injectable } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class FFmpegService {
    async convertTo720p(inputPath: string, outputPath: string): Promise<void> {
        const command = `ffmpeg -y -i "${inputPath}" -vf scale=-2:720 "${outputPath}"`;

        try {
            await execAsync(command);
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            throw new Error(`FFmpeg conversion failed: ${error.message}`);
        }
    }
}