// src/queue/video.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { FFmpegService } from '../ffmpeg/ffmpeg.service';
import { VideoStatus } from '../videos/video-status.enum';
import { VIDEO_QUEUE } from './queue.module';
import { join } from 'path';
import { mkdirSync, unlinkSync } from 'fs';

export interface ConversionJobData {
    videoId: string;
    userId: string;
    inputPath: string;
    originalFileName: string;
}

@Processor(VIDEO_QUEUE)
export class VideoProcessor extends WorkerHost {
    private readonly logger = new Logger(VideoProcessor.name);

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly ffmpegService: FFmpegService,
    ) {
        super();
    }

    async process(job: Job<ConversionJobData>): Promise<void> {
        const { videoId, userId, inputPath, originalFileName } = job.data;
        const firestore = this.firebaseService.getFirestore();
        const storage = this.firebaseService.getStorage();
        const docRef = firestore.collection('videos').doc(videoId);

        this.logger.log(`Starting conversion for video ${videoId}`);

        await docRef.update({
            status: VideoStatus.PROCESSING,
            startedAt: new Date(),
        });

        const tempDir = join(process.cwd(), 'temp');
        mkdirSync(tempDir, { recursive: true });

        const originalExtension = originalFileName.split('.').pop();
        const inputFile = join(tempDir, `${videoId}-input.${originalExtension}`);
        const outputFile = join(tempDir, `${videoId}-720p.mp4`);

        try {
            // download do input — 0-20%
            await job.updateProgress(10);
            await storage.file(inputPath).download({ destination: inputFile });
            await job.updateProgress(20);

            // conversão com progresso real do FFmpeg — 20-90%
            await this.ffmpegService.convertTo720p(
                inputFile,
                outputFile,
                async (percent) => {
                    const scaled = 20 + Math.round(percent * 0.7);
                    await job.updateProgress(scaled);
                },
            );

            // upload do output — 90-100%
            await job.updateProgress(90);
            const outputPath = `videos/${userId}/${videoId}/output-720p.mp4`;
            await storage.upload(outputFile, {
                destination: outputPath,
                contentType: 'video/mp4',
            });

            await docRef.update({
                status: VideoStatus.DONE,
                outputPath,
                finishedAt: new Date(),
                title: `${originalFileName.replace(/\.[^/.]+$/, '')}_720p.mp4`,
            });

            await job.updateProgress(100);
            this.logger.log(`Conversion done for video ${videoId}`);

        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.logger.error(`Conversion failed for video ${videoId}: ${error.message}`);

            await docRef.update({
                status: VideoStatus.FAILED,
                error: error.message,
            });

            throw error;
        } finally {
            try { unlinkSync(inputFile); } catch { }
            try { unlinkSync(outputFile); } catch { }
        }
    }
}