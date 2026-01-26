// src/videos/videos.service.ts
import { Response } from 'express';
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    InternalServerErrorException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { VideoStatus } from './video-status.enum';
import { v4 as uuidv4 } from 'uuid';
import { FFmpegService } from '../ffmpeg/ffmpeg.service';
import { join } from 'path';
import { mkdirSync, unlinkSync } from 'fs';
import { VideoDoc } from './video.types';


@Injectable()
export class VideosService {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly ffmpegService: FFmpegService,
    ) { }


    async uploadVideo(
        userId: string,
        file: Express.Multer.File,
        title?: string,
    ) {
        const firestore = this.firebaseService.getFirestore();
        const storage = this.firebaseService.getStorage();

        const videoId = uuidv4();
        const inputPath = `videos/${userId}/${videoId}/input.mp4`;

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

        await docRef.update({
            status: VideoStatus.PROCESSING,
            startedAt: new Date(),
        });

        // roda async
        this.processConversion(videoId, video).catch(async (err) => {
            await docRef.update({
                status: VideoStatus.FAILED,
                error: err.message,
            });
        });
    }

    private async processConversion(videoId: string, video: any) {
        const storage = this.firebaseService.getStorage();


        const tempDir = join(process.cwd(), 'temp');
        mkdirSync(tempDir, { recursive: true });


        const inputFile = join(tempDir, `${videoId}-input.mp4`);
        const outputFile = join(tempDir, `${videoId}-720p.mp4`);

        // input's download
        await storage.file(video.inputPath).download({
            destination: inputFile,
        });

        // converter
        await this.ffmpegService.convertTo720p(inputFile, outputFile);

        // output's upload
        const outputPath = `videos/${video.userId}/${videoId}/output-720p.mp4`;
        await storage.upload(outputFile, {
            destination: outputPath,
            contentType: 'video/mp4',
        });

        // update firestore
        await this.firebaseService
            .getFirestore()
            .collection('videos')
            .doc(videoId)
            .update({
                status: VideoStatus.DONE,
                outputPath,
                finishedAt: new Date(),
                title: `${video.originalFileName.replace(/\.[^/.]+$/, '')}_720p.mp4`,
            });


        // cleanup
        unlinkSync(inputFile);
        unlinkSync(outputFile);
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
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`,
        );

        file.createReadStream().pipe(res);
    }
}