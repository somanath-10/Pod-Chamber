import nodemailer from 'nodemailer';
import type { Request, Response } from 'express';
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/aws.js';

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@podchamber.local';
const shouldUseDevMailbox = process.env.NODE_ENV === 'development';
const RECORDING_KEY_PATTERN = /^recording-\d+(?:-[a-z0-9@._+-]+-[a-z0-9_-]+)?\.webm$/i;
const SESSION_ID_PATTERN = /^\d+$/;

type EmailDeliveryResult = {
    delivery: 'email' | 'link-only';
    previewUrl: string | null;
    message: string;
};

async function resolveRecordingKey(sessionId: string) {
    const trimmedSessionId = sessionId.trim();
    if (!trimmedSessionId) {
        return null;
    }

    if (RECORDING_KEY_PATTERN.test(trimmedSessionId)) {
        return trimmedSessionId;
    }

    if (!SESSION_ID_PATTERN.test(trimmedSessionId) || !BUCKET_NAME) {
        return null;
    }

    const prefix = `recording-${trimmedSessionId}`;
    const response = await s3Client.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: 10
    }));

    const matchingKey = response.Contents
        ?.map((item) => item.Key)
        .find((key): key is string => typeof key === 'string' && (key === `${prefix}.webm` || key.startsWith(`${prefix}-`)));

    return matchingKey ?? null;
}

export async function sendRecordingEmail(email: string, url: string, sessionId: string): Promise<EmailDeliveryResult> {
    let transporter;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail', // Standard, can be overridden if needed
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else if (shouldUseDevMailbox) {
        try {
            // Development fallback: use Ethereal Email only for local development.
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        } catch (error) {
            console.error("Failed to create a development email inbox, falling back to secure link:", error);
            return {
                delivery: 'link-only',
                previewUrl: null,
                message: 'Email preview is unavailable right now. Use the secure link below.'
            };
        }
    } else {
        return {
            delivery: 'link-only',
            previewUrl: null,
            message: 'Email is not configured on the server. Use the secure link below.'
        };
    }

    try {
        const info = await transporter.sendMail({
            from: `"PodChamber Studio" <${EMAIL_FROM}>`,
            to: email,
            subject: "Your Recording is Ready!",
            text: `Here is the link to your recording: ${url}\n\nSession ID: ${sessionId}`,
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                    <h2 style="color: #f59e0b;">Your Recording is Ready!</h2>
                    <p style="color: #334155; font-size: 16px;">We have successfully processed your recording.</p>
                    <p style="color: #64748b; font-size: 14px;">Session ID: <strong>${sessionId}</strong></p>
                    <div style="margin: 30px 0;">
                        <a href="${url}" style="background-color: #f59e0b; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">View / Download Recording</a>
                    </div>
                    <p style="color: #94a3b8; font-size: 12px;">This link will expire in 24 hours.</p>
                </div>
            `
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        const acceptedRecipients = Array.isArray(info.accepted) ? info.accepted.map(String) : [];
        const rejectedRecipients = Array.isArray(info.rejected) ? info.rejected.map(String) : [];

        console.log('Recording email delivery result:', {
            sessionId,
            messageId: info.messageId,
            acceptedRecipients,
            rejectedRecipients,
            response: info.response
        });

        if (acceptedRecipients.length === 0) {
            return {
                delivery: 'link-only',
                previewUrl: previewUrl || null,
                message: 'The mail server did not accept this email. Use the secure link below.'
            };
        }

        if (previewUrl) {
            console.log("Email preview URL: %s", previewUrl);
        }

        return {
            delivery: 'email',
            previewUrl: previewUrl || null,
            message: 'Email sent successfully!'
        };
    } catch (error) {
        console.error("Email delivery failed, falling back to secure link:", error);
        return {
            delivery: 'link-only',
            previewUrl: null,
            message: 'Email delivery failed on the server. Use the secure link below.'
        };
    }
}

export const handleEmailRecording = async (req: Request, res: Response): Promise<void> => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
        const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';

        if (!email || !sessionId) {
            res.status(400).json({ error: 'Missing email or sessionId' });
            return;
        }
        console.log('Received email send request:', { email, sessionId });
        const key = await resolveRecordingKey(sessionId);
        console.log('Resolved recording key for email request:', key);
        if (!key || !BUCKET_NAME) {
            res.status(404).json({ error: 'Recording not found for that session ID' });
            return;
        }

        try {
            await s3Client.send(new HeadObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key
            }));
        } catch (error) {
            console.error('Recording lookup failed before email send:', { sessionId, key, error });
            res.status(404).json({ error: 'Recording not found for that session ID' });
            return;
        }

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ResponseContentDisposition: `attachment; filename="${key}"`
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 86400 });

        const deliveryResult = await sendRecordingEmail(email, url, key);

        console.log('Recording email request completed:', {
            requestedSessionId: sessionId,
            resolvedKey: key,
            delivery: deliveryResult.delivery,
            targetEmail: email
        });

        res.json({
            success: deliveryResult.delivery === 'email',
            url,
            key,
            ...deliveryResult
        });
    } catch (error) {
        console.error("Email send error:", error);
        res.status(500).json({ error: 'Failed to send email' });
    }
};
