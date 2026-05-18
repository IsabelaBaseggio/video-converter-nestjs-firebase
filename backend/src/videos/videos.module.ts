// src/videos/videos.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { FirebaseModule } from '../firebase/firebase.module';
import { FFmpegModule } from '../ffmpeg/ffmpeg.module';
import { VideoProcessor } from '../queue/video.processor';
import { VIDEO_QUEUE } from '../queue/queue.module';

@Module({
    imports: [
        FirebaseModule,
        FFmpegModule,
        BullModule.registerQueue({ name: VIDEO_QUEUE }),
    ],
    controllers: [VideosController],
    providers: [VideosService, VideoProcessor],
})
export class VideosModule { }