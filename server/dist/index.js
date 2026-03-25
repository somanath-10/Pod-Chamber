import express from "express";
import { error } from "node:console";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import recordRouter from "./routes/recordRoutes.js";
const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/record", recordRouter);
const wss = new WebSocketServer({ port: 8080 });
const rooms = {};
wss.on('connection', function connection(ws) {
    ws.on('message', function message(data) {
        let payload;
        try {
            payload = JSON.parse(data);
        }
        catch (e) {
            console.error("Invalid JSON:", data);
            return;
        }
        const roomId = payload.room;
        if (!roomId)
            return;
        if (payload.type === "identify-sender") {
            if (!rooms[roomId]) {
                rooms[roomId] = { sender: ws, receiver: null, bufferedSenderCandidates: [], bufferedReceiverCandidates: [] };
            }
            else {
                rooms[roomId].sender = ws;
            }
            console.log(`Sender identified for room: ${roomId}`);
            // Send buffered messages to sender
            const room = rooms[roomId];
            if (room.bufferedAnswer) {
                ws.send(JSON.stringify({ type: "create-answer", sdp: room.bufferedAnswer }));
                room.bufferedAnswer = null;
            }
            room.bufferedReceiverCandidates.forEach(candidate => {
                ws.send(JSON.stringify({ type: "ice-candidate", candidate }));
            });
            room.bufferedReceiverCandidates = [];
        }
        else if (payload.type === "identify-receiver") {
            if (!rooms[roomId]) {
                rooms[roomId] = { sender: null, receiver: ws, bufferedSenderCandidates: [], bufferedReceiverCandidates: [] };
            }
            else {
                rooms[roomId].receiver = ws;
            }
            console.log(`Receiver identified for room: ${roomId}`);
            const room = rooms[roomId];
            // Notify sender that a receiver has joined
            room.sender?.send(JSON.stringify({ type: "receiver-joined" }));
            // Send buffered messages to receiver
            if (room.bufferedOffer) {
                ws.send(JSON.stringify({ type: "create-offer", sdp: room.bufferedOffer }));
                room.bufferedOffer = null;
            }
            room.bufferedSenderCandidates.forEach(candidate => {
                ws.send(JSON.stringify({ type: "ice-candidate", candidate }));
            });
            room.bufferedSenderCandidates = [];
        }
        else if (payload.type === "create-offer") {
            const room = rooms[roomId];
            if (room) {
                if (room.receiver) {
                    room.receiver.send(JSON.stringify({ type: "create-offer", sdp: payload.sdp }));
                    console.log(`Offer routed in room: ${roomId}`);
                }
                else {
                    room.bufferedOffer = payload.sdp;
                    console.log(`Offer buffered for room: ${roomId}`);
                }
            }
        }
        else if (payload.type === "create-answer") {
            const room = rooms[roomId];
            if (room) {
                if (room.sender) {
                    room.sender.send(JSON.stringify({ type: "create-answer", sdp: payload.sdp }));
                    console.log(`Answer routed in room: ${roomId}`);
                }
                else {
                    room.bufferedAnswer = payload.sdp;
                    console.log(`Answer buffered for room: ${roomId}`);
                }
            }
        }
        else if (payload.type === "ice-candidate") {
            const room = rooms[roomId];
            if (!room)
                return;
            if (ws === room.sender) {
                if (room.receiver) {
                    room.receiver.send(JSON.stringify({ type: "ice-candidate", candidate: payload.candidate }));
                }
                else {
                    room.bufferedSenderCandidates.push(payload.candidate);
                }
            }
            else if (ws === room.receiver) {
                if (room.sender) {
                    room.sender.send(JSON.stringify({ type: "ice-candidate", candidate: payload.candidate }));
                }
                else {
                    room.bufferedReceiverCandidates.push(payload.candidate);
                }
            }
        }
        else if (payload.type === "Disconnect") {
            const room = rooms[roomId];
            if (room) {
                if (ws === room.sender) {
                    // Sender kills the room
                    room.receiver?.send(JSON.stringify({ type: "peer-disconnected" }));
                    delete rooms[roomId];
                    console.log(`Room ${roomId} deleted as Sender disconnected.`);
                }
                else if (ws === room.receiver) {
                    room.receiver = null;
                    room.sender?.send(JSON.stringify({ type: "peer-disconnected" }));
                    console.log(`Receiver disconnected from room: ${roomId}. Room persists.`);
                    // Only delete room if both are gone (unlikely here since we just set receiver to null, but good for consistency)
                    if (!room.sender && !room.receiver) {
                        delete rooms[roomId];
                    }
                }
            }
        }
    });
    ws.on('close', () => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room) {
                if (room.sender === ws) {
                    // Sender socket closed, kill the room
                    room.receiver?.send(JSON.stringify({ type: "peer-disconnected" }));
                    delete rooms[roomId];
                    console.log(`Sender socket closed. Room ${roomId} deleted.`);
                }
                else if (room.receiver === ws) {
                    room.receiver = null;
                    room.sender?.send(JSON.stringify({ type: "peer-disconnected" }));
                    console.log(`Receiver socket closed for room: ${roomId}. Room persists.`);
                    if (!room.sender && !room.receiver) {
                        delete rooms[roomId];
                    }
                }
            }
        }
    });
});
app.listen(3000, () => {
    console.log("Server is listening on port 3000");
});
//# sourceMappingURL=index.js.map