// src/ffmpeg/ffmpeg.module.ts
import { Module } from '@nestjs/common';
import { FFmpegService } from './ffmpeg.service';

@Module({
    providers: [FFmpegService],
    exports: [FFmpegService],
})
export class FFmpegModule { }