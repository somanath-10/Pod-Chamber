import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

export const Receiver = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const [socket,setSocket] = useState<WebSocket|null>(null);
    
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    
    useEffect(() => {
        if (!roomId) return;
        setStatus("connecting");
        
        const socket = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:8080');
        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "identify-receiver", room: roomId }))
            setSocket(socket);
        }

        // let pc: RTCPeerConnection | null = null;
        const candidateQueue: RTCIceCandidateInit[] = [];

        socket.onmessage = async (event) => {
            const message = JSON.parse(event.data)
            if (message.type === 'create-offer') {
                const pc = new RTCPeerConnection();
                pcRef.current = pc;

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
                        localStreamRef.current = stream;
                        stream.getTracks().forEach(track => pc.addTrack(track, stream));
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
                if (pcRef.current && pcRef.current.remoteDescription) {
                    await pcRef.current.addIceCandidate(message.candidate);
                } else {
                    candidateQueue.push(message.candidate);
                }
            } else if (message.type === "peer-disconnected") {
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
                setStatus("connecting");
                console.log("Sender disconnected.");
                navigate("/");
            }
        }
        return () => socket.close();
    }, [roomId])


    function Disconnect(){
        socket?.send(JSON.stringify({type:"Disconnect",room:roomId}));
        
        // Cleanup media
        const localStream = localVideoRef.current?.srcObject as MediaStream;
        localStream?.getTracks().forEach(track => track.stop());
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        
        // Close PC
        pcRef.current?.close();
        pcRef.current = null;
        
        setStatus("idle");
        navigate("/");
    }

    function toggleMute() {
        if (!localStreamRef.current) return;
        const audioTracks = localStreamRef.current.getAudioTracks();
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsMuted(!isMuted);
    }

    function toggleCamera() {
        if (!localStreamRef.current) return;
        const videoTracks = localStreamRef.current.getVideoTracks();
        videoTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsCameraOff(!isCameraOff);
    }
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Decorative Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-emerald-600/20 blur-[120px] pointer-events-none" />

            <div className="glass-panel w-full max-w-5xl rounded-[32px] p-6 md:p-8 flex flex-col gap-6 relative z-10 animate-fade-in shadow-2xl shadow-black/50">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white">Studio Receiver</h1>
                            <p className="text-sm text-slate-400 font-medium">Room ID: <span className="text-emerald-400 font-mono tracking-wider ml-1">{roomId}</span></p>
                        </div>
                    </div>

                    {/* Status Indicator */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-inner ${
                        status === 'connected' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 
                        status === 'connecting' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                        {status === 'connected' && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
                        {status === 'connecting' && <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />}
                        <span className="font-bold tracking-widest text-xs uppercase">{status}</span>
                    </div>
                </div>

                {/* Video Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <div className="video-box aspect-video bg-black/50 backdrop-blur-md flex items-center justify-center group overflow-hidden border border-white/5 rounded-2xl relative">
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-semibold tracking-wider uppercase rounded-lg border border-white/10">
                            Host (Remote)
                        </div>
                        {!remoteVideoRef.current?.srcObject && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-slate-500 font-medium tracking-wide">Waiting for host video...</span>
                            </div>
                        )}
                    </div>
                    <div className="video-box aspect-video bg-black/50 backdrop-blur-md flex items-center justify-center group overflow-hidden border border-white/5 rounded-2xl relative">
                        <video ref={localVideoRef} muted autoPlay playsInline className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
                        <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-semibold tracking-wider uppercase rounded-lg border border-white/10">
                            You (Local)
                        </div>
                    </div>
                </div>

                {/* Floating Toolbar */}
                {status !== 'idle' && (
                    <div className="flex items-center justify-center gap-4 bg-slate-900/60 border border-slate-700/50 p-3 rounded-full mt-2 max-w-max mx-auto shadow-xl">
                        <div className="flex items-center gap-2 pr-4 border-r border-slate-700/50 mr-2">
                             <button
                                onClick={toggleMute}
                                className={`p-3 rounded-full transition-all ${isMuted 
                                    ? 'bg-red-500/20 text-red-500 border border-red-500/30' 
                                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'}`}
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                    </svg>
                                )}
                            </button>
                            <button
                                onClick={toggleCamera}
                                className={`p-3 rounded-full transition-all ${isCameraOff 
                                    ? 'bg-red-500/20 text-red-500 border border-red-500/30' 
                                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'}`}
                                title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
                            >
                                {isCameraOff ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        <button onClick={Disconnect} className="btn-secondary px-8 text-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 rounded-full whitespace-nowrap">
                            Leave Room
                        </button>
                    </div>
                )}
            </div>
            <audio ref={localAudioRef} muted />
            <audio ref={remoteAudioRef} autoPlay />
        </div>
    )
}
