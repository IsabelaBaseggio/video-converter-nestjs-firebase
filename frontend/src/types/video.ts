export const VideoStatus = {
UPLOADED: "UPLOADED",
PROCESSING: "PROCESSING",
DONE: "DONE",
FAILED: "FAILED",
} as const;


export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];