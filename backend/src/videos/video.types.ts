// src/videos/video.types.ts
export interface VideoDoc {
    userId: string;
    title?: string;
    inputPath: string;
    outputPath?: string;
    status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILER';
    createdAt: FirebaseFirestore.Timestamp;
    originalFileName?: string;
    preset: 'MP4_720P';
}