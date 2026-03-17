import express from "express";
import { error } from "node:console";
import { WebSocketServer, WebSocket } from "ws";
const app = express();
app.use(express.json());
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
                rooms[roomId] = { sender: ws, receiver: null };
            }
            else {
                rooms[roomId].sender = ws;
            }
            console.log(`Sender identified for room: ${roomId}`);
        }
        else if (payload.type === "identify-receiver") {
            if (!rooms[roomId]) {
                rooms[roomId] = { sender: null, receiver: ws };
            }
            else {
                rooms[roomId].receiver = ws;
            }
            console.log(`Receiver identified for room: ${roomId}`);
        }
        else if (payload.type === "create-offer") {
            const room = rooms[roomId];
            if (room?.receiver) {
                room.receiver.send(JSON.stringify({ type: "create-offer", sdp: payload.sdp }));
                console.log(`Offer routed in room: ${roomId}`);
            }
        }
        else if (payload.type === "create-answer") {
            const room = rooms[roomId];
            if (room?.sender) {
                room.sender.send(JSON.stringify({ type: "create-answer", sdp: payload.sdp }));
                console.log(`Answer routed in room: ${roomId}`);
            }
        }
        else if (payload.type === "ice-candidate") {
            const room = rooms[roomId];
            if (!room)
                return;
            if (ws === room.sender && room.receiver) {
                room.receiver.send(JSON.stringify({ type: "ice-candidate", candidate: payload.candidate }));
            }
            else if (ws === room.receiver && room.sender) {
                room.sender.send(JSON.stringify({ type: "ice-candidate", candidate: payload.candidate }));
            }
        }
    });
    ws.on('close', () => {
        // Cleanup: remove socket from rooms when closed
        for (const roomId in rooms) {
            const room = rooms[roomId];
            if (room) {
                if (room.sender === ws) {
                    room.sender = null;
                }
                if (room.receiver === ws) {
                    room.receiver = null;
                }
                if (!room.sender && !room.receiver) {
                    delete rooms[roomId];
                }
            }
        }
    });
});
app.listen(3000, () => {
    console.log("Server is listening on port 3000");
});
//# sourceMappingURL=index.js.map