// src/queue/queue.module.ts
import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

export const VIDEO_QUEUE = 'video-conversion';

@Global()
@Module({
    imports: [
        BullModule.registerQueue({
            name: VIDEO_QUEUE,
        }),
    ],
    exports: [
        BullModule,
    ],
})
export class QueueModule { }