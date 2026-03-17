import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom";

export const Sender = () => {
    const { roomId: paramRoomId } = useParams();
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
            }
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            if (localAudioRef.current) {
                localAudioRef.current.srcObject = stream;
            }
        } catch (e) {
            console.error("Error getting user media:", e);
        }

        pc.ontrack = (event) => {
            if (remoteVideoRef.current !== null) {
                remoteVideoRef.current.srcObject = event.streams[0];
            }
            if(remoteAudioRef.current!==null){
                remoteAudioRef.current.srcObject = event.streams[0];
            }

        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
            <div className="glass-card w-full max-w-5xl overflow-hidden flex flex-col md:flex-row">
                {/* Left Side: Controls */}
                <div className="w-full md:w-1/3 p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-center gap-6">
                    <div>
                        <h1 className="text-3xl font-bold gradient-text mb-2">Pod Chamber</h1>
                        <p className="text-gray-400 text-sm">Initiate a secure peer-to-peer connection.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Room ID</label>
                            <input
                                type="text"
                                value={roomid}
                                onChange={(e) => setRoom(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl glass-input"
                                placeholder="Enter room ID..."
                            />
                        </div>

                        <button
                            onClick={startSending}
                            disabled={isConnected}
                            className={`w-full py-4 rounded-xl btn-primary flex items-center justify-center gap-2 ${isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isConnected ? 'Connecting...' : 'Start Connection'}
                        </button>
                    </div>

                    {isConnected && (
                        <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                            <span className="text-sm font-medium text-primary-hover">Active Session</span>
                        </div>
                    )}
                </div>

                {/* Right Side: Video Grid */}
                <div className="w-full md:w-2/3 p-4 md:p-8 bg-black/20 flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 h-full">
                        <div className="video-container rounded-2xl group">
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                            <div className="video-label">Remote Stream</div>
                            {!remoteVideoRef.current?.srcObject && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                                    <p className="text-gray-500 text-sm animate-pulse">Waiting for receiver...</p>
                                </div>
                            )}
                        </div>

                        <div className="video-container rounded-2xl group h-48 md:h-64">
                            <video
                                ref={localVideoRef}
                                muted
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                            <div className="video-label">Local Preview (You)</div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Hidden audio elements for refs */}
            <audio ref={localAudioRef} muted />
            <audio ref={remoteAudioRef} autoPlay />
        </div>
    )
}
