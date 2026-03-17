import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

export const Receiver = () => {
    const { roomId } = useParams();
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        if (!roomId) return;
        
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
                    }
                }

                try{
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                        if(pc!==null){stream.getTracks().forEach(track => pc?.addTrack(track, stream));}
                        if(localVideoRef.current!==null){
                            localVideoRef.current.srcObject = stream;
                        }
                }
                catch(err){

                }

                await pc.setRemoteDescription(message.sdp);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer)
                socket.send(JSON.stringify({ type: "create-answer", room: roomId, sdp: pc.localDescription }));

                // Process queued candidates
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
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h2>Receiver</h2>
            <div style={{ marginTop: '20px' }}>
                <p>local Video (receiver)</p>
                <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '400px', borderRadius: '8px', backgroundColor: '#333' }} />
            </div>
            <div style={{ marginTop: '20px' }}>
                <p>Remote Video (from Sender)</p>
                <video ref={remoteVideoRef} autoPlay playsInline muted style={{ width: '400px', borderRadius: '8px', backgroundColor: '#333' }} />
            </div>
        </div>
    )
}