import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import recordRouter from "./routes/recordRoutes.js";
import { s3Client } from "./config/aws.js";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
import { startRecordingCleanupJob } from "./jobs/recordingCleanup.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/record", recordRouter);

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

interface Room {
    users: Socket[];
}

const rooms: Record<string, Room> = {};

const PORT = Number(process.env.PORT) || 3000;

startRecordingCleanupJob();

// Create a combined HTTP server for Express and Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join-room', (payload: any) => {
        try {
            const roomId = payload?.room;
            if (!roomId) {
                console.warn('Join-room attempt without roomId');
                return;
            }

            socket.data.room = roomId;

            if (!rooms[roomId]) {
                rooms[roomId] = { users: [socket] };
                console.log(`Created room ${roomId} for socket ${socket.id}`);
            } else {
                const room = rooms[roomId];
                // Check if socket is already in room (reconnect scenario)
                const existingIndex = room.users.findIndex(u => u.id === socket.id);
                if (existingIndex !== -1) {
                    console.log(`Socket ${socket.id} reconnected to room ${roomId}`);
                    return; // Already in room
                }

                if (room.users.length >= 2) {
                    console.warn(`Room ${roomId} is full (${room.users.length} users), rejecting socket ${socket.id}`);
                    // Optionally notify client about room being full
                    socket.emit('room-full', { roomId });
                    return;
                }

                room.users.push(socket);
                console.log(`User joined room: ${roomId}. Users in room: ${room.users.length}`);

                // Room is full (now 2 users), tell the FIRST user to create the offer
                if (room.users.length === 2) {
                    if (room.users[0]) room.users[0].emit("send-offer", { roomId });
                }
            }
        } catch (error) {
            console.error('Error in join-room:', error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    socket.on('offer', (payload: any) => {
        try {
            const roomId = payload?.room;
            const room = rooms[roomId];
            if (!room) {
                console.warn(`Offer received for non-existent room: ${roomId}`);
                return;
            }

            const otherUser = room.users.find(u => u.id !== socket.id);
            if (otherUser) {
                otherUser.emit("offer", { sdp: payload.sdp });
            } else {
                console.warn(`No other user in room ${roomId} for offer from ${socket.id}`);
            }
        } catch (error) {
            console.error('Error in offer:', error);
        }
    });

    socket.on('answer', (payload: any) => {
        try {
            const roomId = payload?.room;
            const room = rooms[roomId];
            if (!room) {
                console.warn(`Answer received for non-existent room: ${roomId}`);
                return;
            }

            const otherUser = room.users.find(u => u.id !== socket.id);
            if (otherUser) {
                otherUser.emit("answer", { sdp: payload.sdp });
            } else {
                console.warn(`No other user in room ${roomId} for answer from ${socket.id}`);
            }
        } catch (error) {
            console.error('Error in answer:', error);
        }
    });

    socket.on('start-recording', async (payload: any, callback: Function) => {
        try {
            const email = payload?.email || '';
            const salt = Math.floor(100000 + Math.random() * 900000).toString();
            const key = email
                ? `recording-${Date.now()}-${email}-${salt}.webm`
                : `recording-${Date.now()}.webm`;

            const command = new CreateMultipartUploadCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key,
                ContentType: 'video/webm'
            });
            const upload = await s3Client.send(command);
            console.log(`Recording started: ${key}`);
            callback({ uploadId: upload.UploadId, key, salt });

            // Broadcast to the other user in the room
            const roomId = socket.data.room;
            if (roomId && rooms[roomId]) {
                const otherUser = rooms[roomId].users.find(u => u.id !== socket.id);
                if (otherUser) otherUser.emit("recording-started", { sessionId: key, salt });
            }
        } catch (err) {
            console.error("Socket start-recording error:", err);
            callback({ error: 'Failed to start recording' });
        }
    });

    socket.on('stop-recording', () => {
        try {
            const roomId = socket.data.room;
            if (roomId && rooms[roomId]) {
                const otherUser = rooms[roomId].users.find(u => u.id !== socket.id);
                if (otherUser) otherUser.emit("recording-stopped");
            }
        } catch (error) {
            console.error('Error in stop-recording:', error);
        }
    });

    socket.on('ice-candidate', (payload: any) => {
        try {
            const roomId = payload?.room;
            const room = rooms[roomId];
            if (!room) {
                console.warn(`ICE candidate received for non-existent room: ${roomId}`);
                return;
            }

            const otherUser = room.users.find(u => u.id !== socket.id);
            if (otherUser) {
                otherUser.emit("ice-candidate", { candidate: payload.candidate });
            } else {
                console.warn(`No other user in room ${roomId} for ICE candidate from ${socket.id}`);
            }
        } catch (error) {
            console.error('Error in ice-candidate:', error);
        }
    });

    socket.on('disconnect', (reason) => {
        try {
            console.log(`Socket disconnected: ${socket.id}, reason: ${reason}`);
            const roomId = socket.data.room;
            if (roomId && rooms[roomId]) {
                const room = rooms[roomId];
                // Remove socket from room
                room.users = room.users.filter(u => u.id !== socket.id);

                // Notify other user if any
                if (room.users.length === 1) {
                    const remainingUser = room.users[0];
                    remainingUser?.emit("peer-disconnected");
                }

                // Clean up empty room
                if (room.users.length === 0) {
                    delete rooms[roomId];
                    console.log(`Room ${roomId} removed (no users left)`);
                }
            }
        } catch (error) {
            console.error('Error in disconnect handler:', error);
        }
    });

    // Handle socket errors
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
});

httpServer.listen(PORT, () => {
    console.log(`Server listening on port ${PORT} (Express API & Socket.IO)`);
});