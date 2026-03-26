import express from "express";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import recordRouter from "./routes/recordRoutes.js";
import { s3Client } from "./config/aws.js";
import { CreateMultipartUploadCommand } from "@aws-sdk/client-s3";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/record", recordRouter);

interface Room {
    users: Socket[];
}

const rooms: Record<string, Room> = {};

// Create a combined HTTP server for Express and Socket.IO on port 3000
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket: Socket) => {
    socket.on('join-room', (payload: any) => {
        const roomId = payload?.room;
        if (!roomId) return;
        
        socket.data.room = roomId;

        if (!rooms[roomId]) {
            rooms[roomId] = { users: [socket] };
        } else {
            const room = rooms[roomId];
            if (room.users.length === 2) return;
            if (room.users.length === 1 && !room.users.includes(socket)) {
                room.users.push(socket);
                // Room is full, tell the FIRST user to create the offer
                if (room.users[0]) room.users[0].emit("send-offer", { roomId });
            }
        }
        console.log(`User joined room: ${roomId}. Users in room: ${rooms[roomId]?.users.length}`);
    });

    socket.on('offer', (payload: any) => {
        const roomId = payload?.room;
        const room = rooms[roomId];
        if (room) {
            const otherUser = room.users.find(u => u.id !== socket.id);
            if (otherUser) {
                otherUser.emit("offer", { sdp: payload.sdp });
            }
        }
    });

    socket.on('answer', (payload: any) => {
        const roomId = payload?.room;
        const room = rooms[roomId];
        if (room) {
            const otherUser = room.users.find(u => u.id !== socket.id);
            if (otherUser) {
                otherUser.emit("answer", { sdp: payload.sdp });
            }
        }
    });

    socket.on('start-recording', async (payload: any, callback: Function) => {
        try {
            const email = payload?.email || '';
            const salt = Math.floor(100000 + Math.random() * 900000).toString();
            const key = email
                ? `recordingfs-${Date.now()}-${email}-${salt}.webm`
                : `recording-${Date.now()}.webm`;

            const command = new CreateMultipartUploadCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: key,
                ContentType: 'video/webm'
            });
            const upload = await s3Client.send(command);
            console.log(`Recording started: ${key}`);
            callback({ uploadId: upload.UploadId, key, salt });
        } catch (err) {
            console.error("Socket start-recording error:", err);
            callback({ error: 'Failed to start recording' });
        }
    });

    socket.on('ice-candidate', (payload: any) => {
        const roomId = payload?.room;
        const room = rooms[roomId];
        if (room) {
            const otherUser = room.users.find(u => u.id !== socket.id);
            if (otherUser) {
                otherUser.emit("ice-candidate", { candidate: payload.candidate });
            }
        }
    });

    socket.on('disconnect', () => {
        const roomId = socket.data.room;
        if (roomId) {
            const room = rooms[roomId];
            if (room) {
                const otherUser = room.users.find(u => u.id !== socket.id);
                if (otherUser) {
                    otherUser.emit("peer-disconnected");
                }
                room.users = room.users.filter(u => u.id !== socket.id);
                if (room.users.length === 0) {
                    delete rooms[roomId];
                }
                console.log(`User disconnected from room: ${roomId}`);
            }
        }
    });
});

httpServer.listen(3000, () => {
    console.log("Server listening on port 3000 (Express API & Socket.IO)");
});