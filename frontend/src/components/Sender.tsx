import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom";

export const Sender = () => {
    const { roomId: paramRoomId } = useParams();
    const navigate = useNavigate();
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localAudioRef = useRef<HTMLAudioElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const [roomid, setRoom] = useState(paramRoomId || "");
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8080');
        setSocket(socket);
        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "identify-sender", room: roomid }))
        }
        return () => socket.close();
    }, [roomid])

    async function startSending() {
        if (!socket) return;
        setIsConnected(true);
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({ type: "ice-candidate", room: roomid, candidate: event.candidate }))
            }
        }

        pc.onnegotiationneeded = async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket?.send(JSON.stringify({ type: 'create-offer', room: roomid, sdp: pc.localDescription }));
            } catch (e) {
                console.error("Error during negotiation:", e);
            }
        }

    socket.onmessage = async (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'create-answer') {
            await pc.setRemoteDescription(message.sdp);
        }
        else if (message.type === "ice-candidate") {
            try {
                await pc.addIceCandidate(message.candidate);
            } catch (e) {
                console.error("Error adding ice candidate:", e);
            }
        } else if (message.type === "receiver-joined") {
            // New receiver came in or refreshed, trigger new offer
            console.log("Receiver joined, re-negotiating...");
            pc.onnegotiationneeded?.(new Event('negotiationneeded'));
        } else if (message.type === "peer-disconnected") {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            console.log("Receiver disconnected.");

        }
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        if (localAudioRef.current) localAudioRef.current.srcObject = stream;
    } catch (e) {
        console.error("Error getting user media:", e);
    }

    pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
    }
}

function Disconnect() {
    socket?.send(JSON.stringify({ type: "Disconnect", room: roomid }));
    
    // Cleanup media
    const localStream = localVideoRef.current?.srcObject as MediaStream;
    localStream?.getTracks().forEach(track => track.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    
    pcRef.current?.close();
    pcRef.current = null;
    
    setIsConnected(false);
    navigate("/");
}

return (
    <div className="container">
        <div className="card max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">Sender</h1>
            <div className="flex gap-4 mb-6">
                <input
                    type="text"
                    value={roomid}
                    onChange={(e) => setRoom(e.target.value)}
                    className="input"
                    placeholder="Room ID"
                />
                <button
                    onClick={startSending}
                    disabled={isConnected}
                    className="btn whitespace-nowrap"
                >
                    {isConnected ? 'Connecting...' : 'Start'}
                </button>
                {isConnected && (
                    <button onClick={Disconnect} className="btn bg-red-600 hover:bg-red-700">
                        Disconnect
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="video-box aspect-video relative">
                    <video ref={localVideoRef} muted autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 p-1 text-[10px] bg-black/50 text-white rounded">Local</div>
                </div>
                <div className="video-box aspect-video relative">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 p-1 text-[10px] bg-black/50 text-white rounded">Remote</div>
                </div>
            </div>
        </div>
        <audio ref={localAudioRef} muted />
        <audio ref={remoteAudioRef} autoPlay />
    </div>
)
}
