// src/videos/videos.service.ts
import { Response } from 'express';
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FirebaseService } from '../firebase/firebase.service';
import { VideoStatus } from './video-status.enum';
import { v4 as uuidv4 } from 'uuid';
import { VideoDoc } from './video.types';
import { VIDEO_QUEUE } from '../queue/queue.module';
import { ConversionJobData } from '../queue/video.processor';

@Injectable()
export class VideosService {
    constructor(
        private readonly firebaseService: FirebaseService,
        @InjectQueue(VIDEO_QUEUE) private readonly videoQueue: Queue,
    ) { }

    async uploadVideo(
        userId: string,
        file: Express.Multer.File,
        title?: string,
    ) {
        try {
            const firestore = this.firebaseService.getFirestore();
            const storage = this.firebaseService.getStorage();

            const videoId = uuidv4();
            const extension = file.originalname.split('.').pop();
            const inputPath = `videos/${userId}/${videoId}/input.${extension}`;

            await storage.file(inputPath).save(file.buffer, {
                contentType: file.mimetype,
            });

            await firestore.collection('videos').doc(videoId).set({
                userId,
                title: file.originalname,
                status: VideoStatus.UPLOADED,
                inputPath,
                createdAt: new Date(),
                originalFileName: file.originalname,
                preset: 'MP4_720P',
            });

            return {
                id: videoId,
                status: VideoStatus.UPLOADED,
            };
        } catch (err) {
            console.error('UPLOAD ERROR:', err);
            throw err;
        }
    }

    async startConversion(videoId: string, userId: string) {
        const firestore = this.firebaseService.getFirestore();
        const docRef = firestore.collection('videos').doc(videoId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) {
            throw new NotFoundException('Video not found');
        }

        const video = snapshot.data() as VideoDoc;

        if (!video) {
            throw new NotFoundException('Video not found');
        }

        if (video.userId !== userId) {
            throw new ForbiddenException();
        }

        const jobData: ConversionJobData = {
            videoId,
            userId,
            inputPath: video.inputPath,
            originalFileName: video.originalFileName,
        };

        await this.videoQueue.add('convert', jobData, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
        });

        await docRef.update({
            status: VideoStatus.PROCESSING,
            startedAt: new Date(),
        });

        return { message: 'Conversion queued' };
    }

    async getVideo(videoId: string, userId: string) {
        const firestore = this.firebaseService.getFirestore();
        const ref = firestore.collection('videos').doc(videoId);
        const snapshot = await ref.get();

        if (!snapshot.exists) {
            throw new NotFoundException('Video not found');
        }

        const video = snapshot.data() as VideoDoc;

        if (video.userId !== userId) {
            throw new ForbiddenException();
        }

        return {
            id: snapshot.id,
            title: video.title,
            status: video.status,
            createdAt: video.createdAt,
        };
    }

    async getVideosByUser(userId: string) {
        const snapshot = await this.firebaseService
            .getFirestore()
            .collection('videos')
            .where('userId', '==', userId)
            .get();

        return snapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            status: doc.data().status,
            createdAt: doc.data().createdAt,
        }));
    }

    async downloadVideo(
        videoId: string,
        userId: string,
        res: Response,
    ) {
        const firestore = this.firebaseService.getFirestore();
        const storage = this.firebaseService.getStorage();

        const ref = firestore.collection('videos').doc(videoId);
        const snapshot = await ref.get();

        if (!snapshot.exists) {
            throw new NotFoundException('Video not found');
        }

        const video = snapshot.data()!;

        if (video.userId !== userId) {
            throw new ForbiddenException();
        }

        if (video.status !== VideoStatus.DONE) {
            throw new BadRequestException('Video not ready for download');
        }

        if (!video.outputPath) {
            throw new InternalServerErrorException('Output file missing');
        }

        const file = storage.file(video.outputPath);

        const safeName = video.originalFileName
            ? video.originalFileName.replace(/\.[^/.]+$/, '')
            : videoId;

        const filename = `${safeName}_720p.mp4`;

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        file.createReadStream().pipe(res);
    }
}