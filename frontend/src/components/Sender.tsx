import { useEffect, useRef, useState } from "react"
import {useNavigate, useParams } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import { useSelector, useDispatch } from "react-redux";
import { type RootState } from "../reducers/store";
import { setSocket as setReduxSocket, clearSession, setRoomId as setReduxRoomId } from "../reducers/slices/sessionSlice";
import { apiConnector } from "../services/apiConnector";
import toast from "react-hot-toast";

export const Sender = () => {
    const { roomId: paramRoomId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { email, roomId: reduxRoomId } = useSelector((state: RootState) => state.session);
    const roomid = reduxRoomId || paramRoomId || "";

    useEffect(() => {
        if (!email) {
            navigate("/");
        }
    }, [email, navigate]);

    const [socket, setSocket] = useState<Socket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localAudioRef = useRef<HTMLAudioElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const Icecandidates = useRef<RTCIceCandidateInit[]>([])
    // Recording states and refs
    const [salt,setSalt] = useState<string>("");
    const [mediaReady,setMediaReady] = useState<boolean>(false);
    const [isRecording, setIsRecording] = useState(false);
    const [sessionId, setSessionId] = useState("");
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const uploadContext = useRef({ uploadId: "", key: "", parts: [] as { PartNumber: number, ETag: string }[], partNumber: 1, isCompleting: false });
    const remoteMediaStreamRef = useRef<MediaStream | null>(new MediaStream());

    const rtcConfig = {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
            { urls: "stun:stun4.l.google.com:19302" },
            { urls: "stun:stun.cloudflare.com:3478" },
            { urls: "stun:global.stun.twilio.com:3478" },
            { urls: "stun:stun.stunprotocol.org:3478" },
            { urls: "stun:stun.sipgate.net:3478" },
            { urls: "stun:stun.ekiga.net" },
        ]
    };


    useEffect(()=>{
        async function getMedia(){
            try{
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                if(localVideoRef.current)localVideoRef.current.srcObject = stream;
                if(localAudioRef.current)localAudioRef.current.srcObject = stream;
                setMediaReady(true)
            }
            catch(e){
                toast.error("Camera/mic access denied");
            }
        }
        getMedia();
    },[socket])

    
    const handleRemoteTrack = (event: RTCTrackEvent) => {
        if(!remoteVideoRef.current) return;

        if(!remoteMediaStreamRef.current){
            remoteMediaStreamRef.current = new MediaStream();
        }

        const stream = remoteMediaStreamRef.current;
        stream.addTrack(event.track);

        if(!remoteVideoRef.current.srcObject){
            remoteVideoRef.current.srcObject = stream;
        }

        if(remoteAudioRef.current && !remoteAudioRef.current.srcObject){
            remoteAudioRef.current.srcObject = stream;
        }

        remoteVideoRef.current.play().catch(e => console.error(e));
        if (remoteAudioRef.current) {
            remoteAudioRef.current.play().catch(e => console.error(e));
        }
    };
    


    useEffect(()=>{
        if(!roomid)return;

        const socket:Socket = io(import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000');
        setSocket(socket);
        dispatch(setReduxSocket(socket));

        socket.emit("join-room",{room:roomid});

        socket.on("send-offer",async ()=>{
            console.log("in send offer")
            const pc = new RTCPeerConnection(rtcConfig)
            pcRef.current = pc;

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current!);
                });
            }

            pc.onicecandidate = (e)=>{
                if(e.candidate){
                    socket.emit("ice-candidate",{room:roomid,candidate:e.candidate})
                }
            }   
            pc.ontrack = handleRemoteTrack
            
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("offer",{room:roomid,sdp:pc.localDescription})
        })

        socket.on("offer",async (data:any)=>{
            console.log("in offer")
            const pc = new RTCPeerConnection(rtcConfig)
            pcRef.current = pc;

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current!);
                });
            }

            pc.onicecandidate = (e)=>{
                if(e.candidate){
                    socket.emit("ice-candidate",{room:roomid,candidate:e.candidate})
                }
            }   
            pc.ontrack = handleRemoteTrack
            
            await pc.setRemoteDescription(data.sdp);
            
            // Apply any queued candidates
            for (const candidate of Icecandidates.current) {
                await pc.addIceCandidate(candidate);
            }
            Icecandidates.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("answer",{room:roomid,sdp:pc.localDescription})
        })

        socket.on("answer",async (data:any)=>{
            await pcRef.current?.setRemoteDescription(data.sdp);

            // Apply any queued candidates
            for (const candidate of Icecandidates.current) {
                await pcRef.current?.addIceCandidate(candidate);
            }
            Icecandidates.current = [];
        })

        socket.on("ice-candidate",async (data:any)=>{
            if (pcRef.current && pcRef.current.remoteDescription) {
                await pcRef.current.addIceCandidate(data.candidate);
            } else {
                Icecandidates.current.push(data.candidate);
            }
        })

        socket.on("peer-disconnected", () => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
            console.log("Peer disconnected.");
            toast("Guest disconnected");
        })

        return () => {
            socket.disconnect();
        };
    },[mediaReady])



// Recording Functions
async function startRecording() {
    if (!localVideoRef.current?.srcObject) return;
    
    try {
        if (!socket) throw new Error("Socket not connected");
        
        const data: any = await new Promise((resolve, reject) => {
            socket.emit("start-recording", { email, room: roomid }, (response: any) => {
                if (response?.error) reject(new Error(response.error));
                else resolve(response);
            });
        });

        setSalt(data.salt || "");
        setSessionId(data.key);
        
        uploadContext.current = {
            uploadId: data.uploadId,
            key: data.key,
            parts: [],
            partNumber: 1,
            isCompleting: false
        };

        const stream = localVideoRef.current.srcObject as MediaStream;
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp8,opus' });
        mediaRecorderRef.current = mediaRecorder;

        let currentBuffer: Blob[] = [];
        let currentSize = 0;

        mediaRecorder.ondataavailable = async (event) => {
            if (event.data && event.data.size > 0) {
                currentBuffer.push(event.data);
                currentSize += event.data.size;
                const isInactive = mediaRecorder.state === 'inactive';

                // S3 multipart requires every part (except the last) to be at least 5MB (5,242,880 bytes)
                // We'll wait until we collect 6MB (or if recording stops) before uploading
                if (currentSize >= 6 * 1024 * 1024 || isInactive) {
                    const chunkBlob = new Blob(currentBuffer, { type: 'video/webm' });
                    // Reset buffer for the next chunk
                    currentBuffer = [];
                    currentSize = 0;

                    const currentPart = uploadContext.current.partNumber++;
                    const chunkArrayBuffer = await chunkBlob.arrayBuffer();
                    
                    try {
                        const uploadData = await apiConnector.uploadPart(uploadContext.current.uploadId, uploadContext.current.key, currentPart, chunkArrayBuffer);
                        
                        if (uploadData.ETag) {
                            uploadContext.current.parts.push({ PartNumber: currentPart, ETag: uploadData.ETag });
                        }
                        
                        // If we stopped and this was the last chunk, complete it
                        if (isInactive && !uploadContext.current.isCompleting) {
                            completeRecording();
                        }
                    } catch (e) {
                        toast.error("Chunk upload failed");
                    }
                }
            }
        };

        mediaRecorder.start(1000);
        setIsRecording(true);
        toast.success("Recording started");
    } catch (e) {
        toast.error((e as Error).message || 'Failed to start recording');
    }
}

async function completeRecording() {
    uploadContext.current.isCompleting = true;
    try {
        await apiConnector.completeRecording(uploadContext.current.uploadId, uploadContext.current.key, uploadContext.current.parts);
        toast.success("Recording saved to cloud!");
        setShowCopyModal(true);
    } catch (e) {
        toast.error("Failed to save recording");
    }
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

function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
}

function Disconnect() {
    if (isRecording) {
        stopRecording();
    }
    
    socket?.disconnect();
    
    // Cleanup media
    const localStream = localVideoRef.current?.srcObject as MediaStream;
    localStream?.getTracks().forEach(track => track.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    
    pcRef.current?.close();
    pcRef.current = null;
    
    setIsConnected(false);
    dispatch(clearSession());
    navigate("/");
}


return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-orange-600/20 blur-[120px] pointer-events-none" />

        <div className="glass-panel w-full max-w-5xl rounded-[32px] p-6 md:p-8 flex flex-col gap-6 relative z-10 animate-fade-in shadow-2xl shadow-black/50">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                        <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Studio Sender</h1>
                        <p className="text-sm text-slate-400 font-medium">Broadcast your pod cell</p>
                    </div>
                </div>

                {isRecording && (
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full">
                            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse-recording" />
                            <span className="text-red-400 font-bold tracking-widest text-xs uppercase">Recording</span>
                        </div>
                        {sessionId && (
                            <div className="text-[10px] font-mono text-slate-500 bg-slate-900/50 px-2 py-1 rounded border border-white/5">
                                Session: {sessionId}
                                {salt && <div>Salt: <span className="text-amber-400">{salt}</span></div>}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Video Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                <div className="video-box aspect-video bg-black/50 backdrop-blur-md flex items-center justify-center group overflow-hidden border border-white/5 rounded-2xl relative">
                    <video ref={localVideoRef} muted autoPlay playsInline className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-semibold tracking-wider uppercase rounded-lg border border-white/10">
                        You 
                    </div>
                </div>
                <div className="video-box aspect-video bg-black/50 backdrop-blur-md flex items-center justify-center group overflow-hidden border border-white/5 rounded-2xl relative">
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]" />
                    <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-xs font-semibold tracking-wider uppercase rounded-lg border border-white/10">
                        Guest (Remote)
                    </div>
                    {!remoteVideoRef.current?.srcObject && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-slate-500 font-medium tracking-wide">Waiting for guest...</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Controls Toolbar */}
            <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-900/60 border border-slate-700/50 p-4 rounded-3xl mt-4 max-w-max mx-auto">
                <input
                    type="text"
                    value={roomid}
                    onChange={(e) => dispatch(setReduxRoomId(e.target.value))}
                    className="input !mb-0 min-w-[200px] text-center bg-slate-800/80 border-slate-600 focus:border-amber-500"
                    placeholder="Room ID"
                />
                

                {isConnected && (
                    <div className="flex items-center gap-2 pl-4 border-l border-slate-700/50">
                        <button
                            onClick={toggleMute}
                            className={`p-3 rounded-xl transition-all ${isMuted 
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
                            className={`p-3 rounded-xl transition-all ${isCameraOff 
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
                )}

                {isConnected && (
                    <div className="flex items-center gap-3 pl-4 border-l border-slate-700/50 ml-2">
                        <button 
                            onClick={isRecording ? stopRecording : startRecording} 
                            className={`btn px-6 text-sm whitespace-nowrap shadow-lg ${isRecording 
                                ? 'bg-[linear-gradient(135deg,#ef4444_0%,#b91c1c_100%)] hover:bg-[linear-gradient(135deg,#f87171_0%,#dc2626_100%)] shadow-red-500/30 text-white' 
                                : 'bg-slate-800 hover:bg-slate-700 text-white shadow-none border border-slate-600 hover:border-slate-500'}`}
                        >
                            {isRecording ? '■ Stop Recording' : '● Start Recording'}
                        </button>
                        <button onClick={Disconnect} className="btn-secondary px-6 text-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 whitespace-nowrap">
                            Disconnect
                        </button>
                    </div>
                )}
            </div>
        </div>
        
        <audio ref={localAudioRef} muted />
        <audio ref={remoteAudioRef} autoPlay />

        {/* Copy Session ID Modal */}
        {showCopyModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                <div className="glass-panel max-w-sm w-full p-8 rounded-[32px] border border-white/10 shadow-2xl flex flex-col items-center gap-6 text-center animate-scale-up">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                        <svg className="w-8 h-8 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white mb-2">Recording Saved!</h3>
                        <p className="text-slate-400 text-sm">Your session has been securely stored. Please copy the session ID for your records.</p>
                    </div>
                    
                    <div className="w-full bg-slate-950/50 rounded-2xl p-4 border border-white/5 font-mono text-xs text-amber-400 break-all select-all">
                        {sessionId}
                        {salt && <div><span className="text-slate-500">Private Salt:</span> {salt}</div>}
                    </div>

                    <div className="flex flex-col w-full gap-3">
                        <button 
                            onClick={() => {
                                navigator.clipboard.writeText(sessionId);
                                // Optional: simple "Copied" state feedback could be added
                            }}
                            className="btn w-full bg-gradient-to-r from-amber-400 to-orange-600 text-black font-bold py-3 rounded-xl hover:scale-[1.02] transition-transform"
                        >
                            Copy to Clipboard
                        </button>
                        <button 
                            onClick={() => setShowCopyModal(false)}
                            className="text-slate-500 hover:text-white text-sm font-medium transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
)
}
