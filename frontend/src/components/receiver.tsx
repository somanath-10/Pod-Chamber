import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

export const Receiver = () => {
    const { roomId } = useParams();
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    
    const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
    
    useEffect(() => {
        if (!roomId) return;
        setStatus("connecting");
        
        const socket = new WebSocket('ws://localhost:8080');
        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "identify-receiver", room: roomId }))
        }

        let pc: RTCPeerConnection | null = null;
        const candidateQueue: RTCIceCandidateInit[] = [];

        socket.onmessage = async (event) => {
            const message = JSON.parse(event.data)
            if (message.type === 'create-offer') {
                pc = new RTCPeerConnection();
                
                pc.onicecandidate = (e: any) => {
                    if (e.candidate) {
                        socket.send(JSON.stringify({ type: "ice-candidate", room: roomId, candidate: e.candidate }))
                    }
                }

                pc.ontrack = (event) => {
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setStatus("connected");
                    }
                    if(remoteAudioRef.current){
                        remoteAudioRef.current.srcObject = event.streams[0];
                    }
                }

                try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        if (pc !== null) { stream.getTracks().forEach(track => pc?.addTrack(track, stream)); }
                        if (localVideoRef.current !== null) {
                            localVideoRef.current.srcObject = stream;
                        }
                        if(localAudioRef.current!==null){
                            localAudioRef.current.srcObject = stream;
                        }
                } catch (err) {
                    console.error("Error accessing media devices:", err);
                }

                await pc.setRemoteDescription(message.sdp);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer)
                socket.send(JSON.stringify({ type: "create-answer", room: roomId, sdp: pc.localDescription }));

                while (candidateQueue.length > 0) {
                    const candidate = candidateQueue.shift();
                    if (candidate) await pc.addIceCandidate(candidate);
                }
            }
            else if (message.type === "ice-candidate") {
                if (pc && pc.remoteDescription) {
                    await pc.addIceCandidate(message.candidate);
                } else {
                    candidateQueue.push(message.candidate);
                }
            }
        }
        return () => socket.close();
    }, [roomId])

    return (
        <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
            <div className="glass-card w-full max-w-5xl overflow-hidden flex flex-col md:flex-row">
                {/* Left Side: Info & Status */}
                <div className="w-full md:w-1/3 p-8 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-center gap-6">
                    <div>
                        <h1 className="text-3xl font-bold gradient-text mb-2">Receiver</h1>
                        <p className="text-gray-400 text-sm">Waiting for a secure broadcast.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Room</label>
                            <div className="w-full px-4 py-3 rounded-xl glass-input flex items-center bg-white/5">
                                <span className="font-mono text-purple-300">{roomId}</span>
                            </div>
                        </div>

                        <div className={`p-4 rounded-xl border flex items-center gap-3 transition-colors duration-500 ${
                            status === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                            status === 'connecting' ? 'bg-primary/10 border-primary/20 text-primary-hover' :
                            'bg-white/5 border-white/10 text-gray-500'
                        }`}>
                            <div className={`w-2 h-2 rounded-full ${
                                status === 'connected' ? 'bg-green-500 animate-pulse' :
                                status === 'connecting' ? 'bg-primary animate-pulse' :
                                'bg-gray-600'
                            }`} />
                            <span className="text-sm font-medium capitalize">{status}</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Video Grid */}
                <div className="w-full md:w-2/3 p-4 md:p-8 bg-black/20 flex flex-col gap-4">
                    <div className="grid grid-cols-1 gap-4 h-full">
                        <div className="video-container rounded-2xl group border-primary/20">
                            <video 
                                ref={remoteVideoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                            />
                            <div className="video-label">Sender's Camera</div>
                            {status !== 'connected' && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/50 backdrop-blur-sm">
                                    <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                                    <p className="text-gray-400 text-sm">Awaiting connection...</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="video-container rounded-2xl group h-48 md:h-64 opacity-80 hover:opacity-100 transition-opacity">
                            <video 
                                ref={localVideoRef} 
                                muted 
                                autoPlay 
                                playsInline 
                                className="w-full h-full object-cover"
                            />
                            <div className="video-label">Local Preview (Receiver)</div>
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
