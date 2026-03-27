import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import { useSelector, useDispatch } from "react-redux";
import { type RootState } from "../reducers/store";
import { setSocket as setReduxSocket, clearSession, setEmail as setReduxEmail } from "../reducers/slices/sessionSlice";
import { apiConnector } from "../services/apiConnector";
import { BACKEND_BASE_URL } from "../utils/backendUrl";
import { getStoredUserEmail } from "../utils/userPreferences";
import toast from "react-hot-toast";

const getMediaErrorMessage = (error: unknown) => {
    const hostname = typeof window !== "undefined" ? window.location.hostname : "";
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isInsecureContext = typeof window !== "undefined" && !window.isSecureContext && !isLocalhost;

    if (!navigator.mediaDevices?.getUserMedia || isInsecureContext) {
        return "Camera/mic need an HTTPS frontend on phone. Open this app over HTTPS, not a local http:// IP.";
    }

    if (error instanceof DOMException) {
        if (error.name === "NotAllowedError" || error.name === "SecurityError") {
            return "Camera/mic permission was blocked. Allow access in the browser site settings and try again.";
        }

        if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
            return "No camera or microphone was found on this device.";
        }

        if (error.name === "NotReadableError" || error.name === "TrackStartError") {
            return "Camera or microphone is already in use by another app.";
        }
    }

    return "Unable to access camera/mic on this device.";
};

const isMobileDevice = () => {
    if (typeof navigator === "undefined") {
        return false;
    }

    return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
};

export const Sender = () => {
    const { roomId: paramRoomId } = useParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { email, roomId: reduxRoomId } = useSelector((state: RootState) => state.session);
    const storedEmail = getStoredUserEmail();
    const effectiveEmail = email || storedEmail || "";
    const roomid = reduxRoomId || paramRoomId || "";

    const [socket, setSocket] = useState<Socket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localAudioRef = useRef<HTMLAudioElement | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const iceCandidates = useRef<RTCIceCandidateInit[]>([]);
    const [salt, setSalt] = useState("");
    const [mediaReady, setMediaReady] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isRemoteRecording, setIsRemoteRecording] = useState(false);
    const [hasGuest, setHasGuest] = useState(false);
    const [sessionId, setSessionId] = useState("");
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const displayStreamRef = useRef<MediaStream | null>(null);
    const uploadContext = useRef({
        uploadId: "",
        key: "",
        parts: [] as { PartNumber: number; ETag: string }[],
        partNumber: 1,
        isCompleting: false
    });
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

    useEffect(() => {
        if (!email && storedEmail) {
            dispatch(setReduxEmail(storedEmail));
        }

        if (!effectiveEmail) {
            navigate("/");
        }
    }, [dispatch, effectiveEmail, email, navigate, storedEmail]);

    useEffect(() => {
        async function getMedia() {
            try {
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error("MEDIA_DEVICES_UNAVAILABLE");
                }

                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                localStreamRef.current = stream;
                if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                if (localAudioRef.current) localAudioRef.current.srcObject = stream;
                setMediaReady(true);
            } catch (error) {
                console.error("getUserMedia failed", error);
                toast.error(getMediaErrorMessage(error), { duration: 5000 });
            }
        }

        getMedia();

        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => track.stop());
                localStreamRef.current = null;
            }
        };
    }, []);

    const handleRemoteTrack = (event: RTCTrackEvent) => {
        if (!remoteVideoRef.current) return;

        if (!remoteMediaStreamRef.current) {
            remoteMediaStreamRef.current = new MediaStream();
        }

        const stream = remoteMediaStreamRef.current;
        stream.addTrack(event.track);

        if (!remoteVideoRef.current.srcObject) {
            remoteVideoRef.current.srcObject = stream;
            setHasGuest(true);
        }

        if (remoteAudioRef.current && !remoteAudioRef.current.srcObject) {
            remoteAudioRef.current.srcObject = stream;
        }

        remoteVideoRef.current.play().catch((error) => console.error(error));
        remoteAudioRef.current?.play().catch((error) => console.error(error));
    };

    useEffect(() => {
        if (!roomid || !mediaReady) return;

        const nextSocket: Socket = io(BACKEND_BASE_URL);
        setSocket(nextSocket);
        dispatch(setReduxSocket(nextSocket));

        nextSocket.on("connect", () => {
            nextSocket.emit("join-room", { room: roomid });
            setIsConnected(true);
        });

        nextSocket.on("connect_error", () => {
            setIsConnected(false);
            toast.error("Unable to reach the signaling server");
        });

        nextSocket.on("disconnect", () => {
            setIsConnected(false);
        });

        nextSocket.on("send-offer", async () => {
            const pc = new RTCPeerConnection(rtcConfig);
            pcRef.current = pc;

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current!);
                });
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    nextSocket.emit("ice-candidate", { room: roomid, candidate: event.candidate });
                }
            };
            pc.ontrack = handleRemoteTrack;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            nextSocket.emit("offer", { room: roomid, sdp: pc.localDescription });
        });

        nextSocket.on("offer", async (data: any) => {
            const pc = new RTCPeerConnection(rtcConfig);
            pcRef.current = pc;

            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) => {
                    pc.addTrack(track, localStreamRef.current!);
                });
            }

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    nextSocket.emit("ice-candidate", { room: roomid, candidate: event.candidate });
                }
            };
            pc.ontrack = handleRemoteTrack;

            await pc.setRemoteDescription(data.sdp);
            for (const candidate of iceCandidates.current) {
                await pc.addIceCandidate(candidate);
            }
            iceCandidates.current = [];

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            nextSocket.emit("answer", { room: roomid, sdp: pc.localDescription });
        });

        nextSocket.on("answer", async (data: any) => {
            await pcRef.current?.setRemoteDescription(data.sdp);
            for (const candidate of iceCandidates.current) {
                await pcRef.current?.addIceCandidate(candidate);
            }
            iceCandidates.current = [];
        });

        nextSocket.on("ice-candidate", async (data: any) => {
            if (pcRef.current && pcRef.current.remoteDescription) {
                await pcRef.current.addIceCandidate(data.candidate);
            } else {
                iceCandidates.current.push(data.candidate);
            }
        });

        nextSocket.on("peer-disconnected", () => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            remoteMediaStreamRef.current = new MediaStream();
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
            setHasGuest(false);
            toast("Guest disconnected");
        });

        nextSocket.on("recording-started", (data: any) => {
            setIsRecording(true);
            setIsRemoteRecording(true);
            setSessionId(data.sessionId);
            setSalt(data.salt);
            toast("Remote guest started recording");
        });

        nextSocket.on("recording-stopped", () => {
            setIsRecording(false);
            setIsRemoteRecording(false);
            setShowCopyModal(true);
            toast("Recording completed by guest");
        });

        return () => {
            nextSocket.disconnect();
        };
    }, [dispatch, mediaReady, roomid]);

    async function startRecording() {
        if (!localVideoRef.current?.srcObject) return;

        try {
            if (!socket) throw new Error("Socket not connected");

            const canUseDisplayCapture = typeof navigator.mediaDevices?.getDisplayMedia === "function";
            const shouldRecordCameraFeed = isMobileDevice() || !canUseDisplayCapture;

            let displayStream: MediaStream | null = null;
            let recordingVideoTrack: MediaStreamTrack | undefined;

            if (shouldRecordCameraFeed) {
                recordingVideoTrack = localStreamRef.current?.getVideoTracks()[0];
                if (!recordingVideoTrack) {
                    throw new Error("No camera video track available for recording.");
                }
                toast("Screen capture is not available on this device. Recording camera feed instead.");
            } else {
                const displayMediaOptions: any = {
                    video: { displaySurface: "browser" },
                    audio: true,
                    preferCurrentTab: true,
                    systemAudio: "include"
                };

                displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions).catch(() => {
                    throw new Error("Screen sharing permissions were denied or cancelled.");
                });
                displayStreamRef.current = displayStream;
                recordingVideoTrack = displayStream.getVideoTracks()[0];
            }

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioCtx = new AudioContextClass();
            const dest = audioCtx.createMediaStreamDestination();

            if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
                const localSource = audioCtx.createMediaStreamSource(localStreamRef.current);
                localSource.connect(dest);
            }

            if (displayStream && displayStream.getAudioTracks().length > 0) {
                const displaySource = audioCtx.createMediaStreamSource(displayStream);
                displaySource.connect(dest);
            } else if (remoteMediaStreamRef.current && remoteMediaStreamRef.current.getAudioTracks().length > 0) {
                const remoteSource = audioCtx.createMediaStreamSource(remoteMediaStreamRef.current);
                remoteSource.connect(dest);
            }

            if (!recordingVideoTrack) {
                throw new Error("No video track available for recording.");
            }

            const finalStream = new MediaStream([recordingVideoTrack, ...dest.stream.getAudioTracks()]);

            const data: any = await new Promise((resolve, reject) => {
                socket.emit("start-recording", { email: effectiveEmail, room: roomid }, (response: any) => {
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

            const mediaRecorder = new MediaRecorder(finalStream, { mimeType: "video/webm; codecs=vp8,opus" });
            mediaRecorderRef.current = mediaRecorder;

            let currentBuffer: Blob[] = [];
            let currentSize = 0;

            mediaRecorder.ondataavailable = async (event) => {
                if (event.data && event.data.size > 0) {
                    currentBuffer.push(event.data);
                    currentSize += event.data.size;
                    const isInactive = mediaRecorder.state === "inactive";

                    if (currentSize >= 6 * 1024 * 1024 || isInactive) {
                        const chunkBlob = new Blob(currentBuffer, { type: "video/webm" });
                        currentBuffer = [];
                        currentSize = 0;

                        const currentPart = uploadContext.current.partNumber++;
                        const chunkArrayBuffer = await chunkBlob.arrayBuffer();

                        try {
                            const uploadData = await apiConnector.uploadPart(
                                uploadContext.current.uploadId,
                                uploadContext.current.key,
                                currentPart,
                                chunkArrayBuffer
                            );

                            if (uploadData.ETag) {
                                uploadContext.current.parts.push({ PartNumber: currentPart, ETag: uploadData.ETag });
                            }

                            if (isInactive && !uploadContext.current.isCompleting) {
                                completeRecording();
                            }
                        } catch (error) {
                            toast.error("Chunk upload failed");
                        }
                    }
                }
            };

            mediaRecorder.start(1000);
            setIsRecording(true);
            toast.success("Recording started");
        } catch (error) {
            toast.error((error as Error).message || "Failed to start recording");
        }
    }

    async function completeRecording() {
        uploadContext.current.isCompleting = true;

        try {
            await apiConnector.completeRecording(
                uploadContext.current.uploadId,
                uploadContext.current.key,
                uploadContext.current.parts
            );
            toast.success("Recording saved to cloud!");
            setShowCopyModal(true);
            socket?.emit("stop-recording");
        } catch (error) {
            toast.error("Failed to save recording");
        }
    }

    function toggleMute() {
        if (!localStreamRef.current) return;
        localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = !track.enabled;
        });
        setIsMuted(!isMuted);
    }

    function toggleCamera() {
        if (!localStreamRef.current) return;
        localStreamRef.current.getVideoTracks().forEach((track) => {
            track.enabled = !track.enabled;
        });
        setIsCameraOff(!isCameraOff);
    }

    function stopRecording() {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }

        if (displayStreamRef.current) {
            displayStreamRef.current.getTracks().forEach((track) => track.stop());
            displayStreamRef.current = null;
        }
    }

    function disconnectSession() {
        if (isRecording && !isRemoteRecording) {
            stopRecording();
        }

        socket?.disconnect();

        const localStream = localVideoRef.current?.srcObject as MediaStream;
        localStream?.getTracks().forEach((track) => track.stop());
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        pcRef.current?.close();
        pcRef.current = null;

        setIsConnected(false);
        dispatch(clearSession());
        navigate("/");
    }

    async function copyRoomId() {
        if (!roomid) return;
        try {
            await navigator.clipboard.writeText(roomid);
            toast.success("Room ID copied");
        } catch (error) {
            toast.error("Could not copy room ID");
        }
    }

    async function copySessionId() {
        try {
            await navigator.clipboard.writeText(sessionId);
            toast.success("Session ID copied");
        } catch (error) {
            toast.error("Could not copy session ID");
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-3 sm:p-5 lg:p-6 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-orange-600/20 blur-[120px] pointer-events-none" />

            <div className="glass-panel w-full max-w-6xl rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 lg:p-8 flex flex-col gap-5 sm:gap-6 relative z-10 animate-fade-in shadow-2xl shadow-black/50">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
                            <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-bold tracking-tight text-white">Studio Sender</h1>
                                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                                    isConnected
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                        : "border-white/10 bg-white/5 text-slate-400"
                                }`}>
                                    {isConnected ? "Connected" : "Connecting"}
                                </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-400 font-medium">Broadcast your pod cell</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                                    Room <span className="text-amber-300 font-semibold">{roomid || "Not set"}</span>
                                </div>
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 break-all">
                                    {effectiveEmail}
                                </div>
                            </div>
                        </div>
                    </div>

                    {isRecording && (
                        <div className="flex flex-col gap-2 xl:items-end">
                            <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-full">
                                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse-recording" />
                                <span className="text-red-400 font-bold tracking-widest text-xs uppercase">Recording</span>
                            </div>
                            {sessionId && (
                                <div className="w-full xl:max-w-sm text-[10px] font-mono text-slate-500 bg-slate-900/50 px-3 py-2 rounded-2xl border border-white/5 break-all">
                                    Session: {sessionId}
                                    {salt && <div>Salt: <span className="text-amber-400">{salt}</span></div>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 relative z-10">
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
                        {!hasGuest && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-slate-500 font-medium tracking-wide">Waiting for guest...</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_auto]">
                    <div className="glass-panel rounded-[24px] p-4 sm:p-5 border border-white/8">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Session</p>
                                <p className="mt-2 text-sm text-slate-300">Share this room code with your guest to join the same pod cell.</p>
                            </div>
                            <button onClick={copyRoomId} className="btn-secondary w-full sm:w-auto px-4 py-3 text-sm">
                                Copy Room ID
                            </button>
                        </div>
                        <div className="mt-4 rounded-2xl border border-white/8 bg-slate-950/50 p-4">
                            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Room ID</div>
                            <div className="mt-2 break-all font-mono text-lg text-amber-300">{roomid}</div>
                        </div>
                    </div>

                    {isConnected && (
                        <div className="glass-panel rounded-[24px] p-4 sm:p-5 border border-white/8">
                            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Controls</p>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3">
                                <button
                                    onClick={toggleMute}
                                    className={`rounded-2xl px-4 py-4 text-sm font-semibold transition-all ${
                                        isMuted
                                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                            : "bg-slate-800 text-slate-200 hover:text-white border border-slate-700"
                                    }`}
                                >
                                    {isMuted ? "Unmute" : "Mute"}
                                </button>
                                <button
                                    onClick={toggleCamera}
                                    className={`rounded-2xl px-4 py-4 text-sm font-semibold transition-all ${
                                        isCameraOff
                                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                            : "bg-slate-800 text-slate-200 hover:text-white border border-slate-700"
                                    }`}
                                >
                                    {isCameraOff ? "Camera On" : "Camera Off"}
                                </button>
                                {!isRemoteRecording && (
                                    <button
                                        onClick={isRecording ? stopRecording : startRecording}
                                        className={`col-span-2 sm:col-span-1 xl:col-span-2 rounded-2xl px-4 py-4 text-sm font-semibold whitespace-nowrap transition-all ${
                                            isRecording
                                                ? "bg-[linear-gradient(135deg,#ef4444_0%,#b91c1c_100%)] shadow-red-500/30 text-white shadow-lg"
                                                : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-600 hover:border-slate-500"
                                        }`}
                                    >
                                        {isRecording ? "Stop Recording" : "Start Recording"}
                                    </button>
                                )}
                                <button
                                    onClick={disconnectSession}
                                    className="col-span-2 rounded-2xl px-4 py-4 text-sm font-semibold border border-white/10 bg-white/5 text-slate-200 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 transition-all"
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <audio ref={localAudioRef} muted />
            <audio ref={remoteAudioRef} autoPlay />

            {showCopyModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel max-w-sm w-full p-6 sm:p-8 rounded-[28px] sm:rounded-[32px] border border-white/10 shadow-2xl flex flex-col items-center gap-5 sm:gap-6 text-center animate-scale-up">
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
                                onClick={copySessionId}
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
    );
};
