// src/videos/videos.controller.ts
import {
    Controller,
    Post,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Body,
    Param,
    Get,
    Res,
    UnauthorizedException,
    Query,
    BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { videoFileFilter } from '../common/utils/file-upload.utils';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { FirebaseService } from '../firebase/firebase.service'
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { User } from '../auth/user.decorator';
import type { FirebaseUser } from '../auth/user.interface';


@Controller('videos')
export class VideosController {
    constructor(
        private readonly videosService: VideosService,
        private readonly firebaseService: FirebaseService,
    ) { }


    @UseGuards(FirebaseAuthGuard)
    @Post()
    @UseInterceptors(FileInterceptor('file', {
        fileFilter: videoFileFilter,
        limits: { fileSize: 100 * 1024 * 1024 }
    }))
    async upload(
        @UploadedFile() file: Express.Multer.File,
        @Body() body: CreateVideoDto,
        @User() user: FirebaseUser,
    ) {
        return this.videosService.uploadVideo(
            user.uid,
            file,
            body.title,
        );
    }

    @UseGuards(FirebaseAuthGuard)
    @Post(':id/convert')
    async convert(
        @Param('id') videoId: string,
        @User() user: FirebaseUser,
    ) {
        this.videosService.startConversion(videoId, user.uid);
        return { message: 'Conversion started' };
    }

    @UseGuards(FirebaseAuthGuard)
    @Get(':id')
    async getVideo(
        @Param('id') videoId: string,
        @User() user: FirebaseUser,
    ) {
        return this.videosService.getVideo(videoId, user.uid);
    }

    @UseGuards(FirebaseAuthGuard)
    @Get()
    async getMyVideos(@User() user: FirebaseUser) {
        return this.videosService.getVideosByUser(user.uid);
    }

    @Get(':id/download')
    async download(
        @Param('id') videoId: string,
        @Query('token') token: string,
        @Res() res: Response,
    ) {
        if (!token) throw new UnauthorizedException('Token missing');


        const decoded = await this.firebaseService.verifyIdToken(token);

        return this.videosService.downloadVideo(videoId, decoded.uid, res);
    }
}