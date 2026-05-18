// src/app.module.ts
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { FirebaseModule } from './firebase/firebase.module';
import { VideosModule } from './videos/videos.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { VIDEO_QUEUE } from './queue/queue.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),

        BullModule.forRoot({
            connection: {
                host: process.env.REDIS_HOST || 'localhost',
                port: Number(process.env.REDIS_PORT) || 6379,
            },
        }),

        BullBoardModule.forRoot({
            route: '/queues',
            adapter: ExpressAdapter,
        }),

        BullBoardModule.forFeature({
            name: VIDEO_QUEUE,
            adapter: BullMQAdapter,
        }),

        FirebaseModule,
        VideosModule,
    ],
    controllers: [AppController],
})
export class AppModule { }