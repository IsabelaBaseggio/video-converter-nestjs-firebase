// src/videos/dto/create-video.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class CreateVideoDto {
    @IsOptional()
    @IsString()
    title?: string;
}