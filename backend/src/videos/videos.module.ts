// src/videos/videos.module.ts
import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { FFmpegModule } from '../ffmpeg/ffmpeg.module';

@Module({
    imports: [FirebaseModule, FFmpegModule],
    controllers: [VideosController],
    providers: [VideosService],
})
export class VideosModule { }