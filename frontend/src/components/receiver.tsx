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
    const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
    
    useEffect(() => {
        if (!roomId) return;
        setStatus("connecting");
        
        const socket = new WebSocket('ws://localhost:8080');
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
    return (
        <div className="container">
            <div className="card max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Receiver</h1>
                    <div className="flex gap-2">
                        {status !== 'idle' && (
                            <button onClick={Disconnect} className="btn bg-red-600 hover:bg-red-700 py-1 px-3 text-xs">
                                Stop
                            </button>
                        )}
                        <div className={`px-3 py-1 rounded text-xs font-bold ${
                            status === 'connected' ? 'bg-green-900 text-green-300' : 
                            status === 'connecting' ? 'bg-indigo-900 text-indigo-300' : 'bg-gray-800 text-gray-400'
                        }`}>
                            {status.toUpperCase()}
                        </div>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="text-xs text-gray-500 uppercase flex mb-1">Room ID</label>
                    <div className="bg-black/30 p-2 rounded font-mono text-indigo-400 border border-white/5">
                        {roomId}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="video-box aspect-video relative">
                        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 p-1 text-[10px] bg-black/50 text-white rounded">Remote</div>
                    </div>
                    <div className="video-box aspect-video relative">
                        <video ref={localVideoRef} muted autoPlay playsInline className="w-full h-full object-cover" />
                        <div className="absolute top-2 left-2 p-1 text-[10px] bg-black/50 text-white rounded">Local</div>
                    </div>
                </div>
            </div>
            <audio ref={localAudioRef} muted />
            <audio ref={remoteAudioRef} autoPlay />
        </div>
    )
}
