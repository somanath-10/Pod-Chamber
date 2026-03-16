import express from "express";
import { WebSocketServer, WebSocket } from "ws";
const app = express();
app.use(express.json());
const wss = new WebSocketServer({ port: 8080 });
let senderSocket = null;
let receiverSocket = null;
wss.on('connection', function connection(ws) {
    ws.on('message', function message(data) {
        //sender
        const message = JSON.parse(data);
        console.log(message);
        if (message.type === "identify-sender") {
            senderSocket = ws;
            console.log("in sender");
        }
        else if (message.type === "identify-receiver") {
            receiverSocket = ws;
            console.log("in receiver");
        }
        else if (message.type === "create-offer") {
            receiverSocket?.send(JSON.stringify({ type: "create-offer", sdp: message.sdp }));
            console.log("in create-offer");
        }
        else if (message.type === "create-answer") {
            console.log("in create-answer", message);
            senderSocket?.send(JSON.stringify({ type: "create-answer", sdp: message.sdp }));
            console.log("in create-answer");
        }
        else if (message.type === "ice-candidate") {
            if (ws == senderSocket) {
                receiverSocket?.send(JSON.stringify({ type: "ice-candidate", candidate: message.candidate }));
            }
            else if (ws == receiverSocket) {
                senderSocket?.send(JSON.stringify({ type: "ice-candidate", candidate: message.candidate }));
            }
        }
    });
});
app.listen(3000, () => {
    console.log("Server is listening on port 3000");
});
//# sourceMappingURL=index.js.map