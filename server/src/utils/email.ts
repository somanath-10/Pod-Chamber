import nodemailer from 'nodemailer';
import type { Request, Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client } from '../config/aws.js';

const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

export async function sendRecordingEmail(email: string, url: string, sessionId: string) {
    let transporter;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        transporter = nodemailer.createTransport({
            service: 'gmail', // Standard, can be overridden if needed
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } else {
        // Development fallback: use Ethereal Email
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
    }

    const info = await transporter.sendMail({
        from: '"PodChamber Studio" <noreply@podchamber.local>',
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
    if (previewUrl) {
        console.log("Email preview URL: %s", previewUrl);
    }

    return previewUrl;
}

export const handleEmailRecording = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, sessionId } = req.body;
        if (!email || !sessionId) {
            res.status(400).json({ error: 'Missing email or sessionId' });
            return;
        }

        

        let key = sessionId;

        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ResponseContentDisposition: `attachment; filename="${key}"`
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: 86400 });

        const previewUrl = await sendRecordingEmail(email, url, sessionId);

        res.json({ success: true, previewUrl });
    } catch (error) {
        console.error("Email send error:", error);
        res.status(500).json({ error: 'Failed to send email' });
    }
};
