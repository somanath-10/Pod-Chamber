import type { Request, Response } from 'express';
import { s3Client } from '../config/aws.js';
import { CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// 1. Start multipart upload
export const startRecording = async (req: Request, res: Response): Promise<void> => {
    try {
        const key = `recording-${Date.now()}.webm`;
        const command = new CreateMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: 'video/webm'
        });
        const upload = await s3Client.send(command);
        res.json({ uploadId: upload.UploadId, key });
    } catch (error) {
        console.error("Start upload error:", error);
        res.status(500).json({ error: 'Failed to start upload' });
    }
};

// 2. Upload part
export const uploadPart = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uploadId, key, partNumber } = req.query;
        if (!uploadId || !key || !partNumber) {
            res.status(400).json({ error: 'Missing parameters' });
            return;
        }

        const command = new UploadPartCommand({
            Bucket: BUCKET_NAME,
            Key: key as string,
            UploadId: uploadId as string,
            PartNumber: parseInt(partNumber as string),
            Body: req.body
        });

        const response = await s3Client.send(command);
        res.json({ ETag: response.ETag });
    } catch (error) {
        console.error("Upload part error:", error);
        res.status(500).json({ error: 'Failed to upload part' });
    }
};

// 3. Complete upload
export const completeRecording = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uploadId, key, parts } = req.body;
        if (!uploadId || !key || !parts || !Array.isArray(parts)) {
            res.status(400).json({ error: 'Missing parameters' });
            return;
        }

        const command = new CompleteMultipartUploadCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                // Must be sorted by PartNumber!
                Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber)
            }
        });

        await s3Client.send(command);
        res.json({ success: true, key });
    } catch (error) {
        console.error("Complete upload error:", error);
        res.status(500).json({ error: 'Failed to complete upload' });
    }
};

// 4. List videos
export const listVideos = async (req: Request, res: Response): Promise<void> => {
    try {
        const command = new ListObjectsV2Command({
            Bucket: BUCKET_NAME,
            Prefix: 'recording-'
        });
        const response = await s3Client.send(command);

        // Sort by LastModified descending
        const files = (response.Contents?.map(item => ({
            key: item.Key,
            lastModified: item.LastModified,
            size: item.Size
        })) || []).sort((a, b) => {
            return new Date(b.lastModified!).getTime() - new Date(a.lastModified!).getTime();
        });

        res.json({ files });
    } catch (error) {
        console.error("List videos error:", error);
        res.status(500).json({ error: 'Failed to list videos' });
    }
};

// 5. Get video pre-signed URL
export const getVideoUrl = async (req: Request, res: Response): Promise<void> => {
    try {
        const { key } = req.query;
        if (!key) {
            res.status(400).json({ error: 'Missing key' });
            return;
        }

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key as string
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        res.json({ url });
    } catch (error) {
        console.error("Get URL error:", error);
        res.status(500).json({ error: 'Failed to get url' });
    }
};
