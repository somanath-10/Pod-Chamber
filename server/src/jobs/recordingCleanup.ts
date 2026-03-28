import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import cron, { type ScheduledTask } from "node-cron";
import { s3Client } from "../config/aws.js";

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const RECORDING_PREFIX = "recording";
const DEFAULT_RETENTION_HOURS = 24;
const DEFAULT_CLEANUP_CRON = "0 * * * *";

const parsePositiveNumber = (value: string | undefined, fallback: number) => {
    const parsedValue = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : fallback;
};

const retentionHours = parsePositiveNumber(
    process.env.RECORDING_RETENTION_HOURS,
    DEFAULT_RETENTION_HOURS
);
const retentionMs = retentionHours * 60 * 60 * 1000;
const cleanupCronExpression = process.env.RECORDING_CLEANUP_CRON?.trim() || DEFAULT_CLEANUP_CRON;

let cleanupTask: ScheduledTask | null = null;
let cleanupInProgress = false;

async function deleteExpiredRecordings() {
    if (!BUCKET_NAME) {
        console.warn("Skipping recording cleanup because AWS_BUCKET_NAME is not configured.");
        return;
    }

    if (cleanupInProgress) {
        console.log("Recording cleanup skipped because a previous run is still in progress.");
        return;
    }

    cleanupInProgress = true;

    try {
        const cutoffTime = Date.now() - retentionMs;
        let continuationToken: string | undefined;
        let deletedCount = 0;

        do {
            const response = await s3Client.send(new ListObjectsV2Command({
                Bucket: BUCKET_NAME,
                Prefix: RECORDING_PREFIX,
                ContinuationToken: continuationToken
            }));

            const expiredObjects = (response.Contents ?? [])
                .filter((item) => (
                    typeof item.Key === "string" &&
                    Boolean(item.LastModified) &&
                    item.LastModified!.getTime() <= cutoffTime
                ))
                .map((item) => ({ Key: item.Key! }));

            if (expiredObjects.length > 0) {
                await s3Client.send(new DeleteObjectsCommand({
                    Bucket: BUCKET_NAME,
                    Delete: {
                        Objects: expiredObjects,
                        Quiet: false
                    }
                }));

                deletedCount += expiredObjects.length;
            }

            continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
        } while (continuationToken);

        if (deletedCount > 0) {
            console.log(`Deleted ${deletedCount} recording(s) older than ${retentionHours} hour(s).`);
        } else {
            console.log(`Recording cleanup completed. No recordings older than ${retentionHours} hour(s) were found.`);
        }
    } catch (error) {
        console.error("Recording cleanup failed:", error);
    } finally {
        cleanupInProgress = false;
    }
}

export function startRecordingCleanupJob() {
    if (cleanupTask) {
        return cleanupTask;
    }

    if (!cron.validate(cleanupCronExpression)) {
        throw new Error(`Invalid RECORDING_CLEANUP_CRON expression: ${cleanupCronExpression}`);
    }

    console.log(
        `Recording cleanup job started. Retention: ${retentionHours} hour(s). Cron: ${cleanupCronExpression}.`
    );

    void deleteExpiredRecordings();

    cleanupTask = cron.schedule(cleanupCronExpression, () => {
        void deleteExpiredRecordings();
    });

    return cleanupTask;
}
