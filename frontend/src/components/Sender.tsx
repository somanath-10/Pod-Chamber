import { useEffect, useRef, useState } from "react"

export const Sender = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8080');
        setSocket(socket);
        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "identify-sender" }))
        }
        return () => socket.close();
    }, [])

    async function startSending() {
        if (!socket) return;
        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({ type: "ice-candidate", candidate: event.candidate }))
            }
        }

        pc.onnegotiationneeded = async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket?.send(JSON.stringify({ type: 'create-offer', sdp: pc.localDescription }));
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
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            pc.addTrack(stream.getVideoTracks()[0],stream)
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        } catch (e) {
            console.error("Error getting user media:", e);
        }

        try{
            pc.ontrack=(event)=>{
                if(remoteVideoRef.current!==null){remoteVideoRef.current.srcObject = event.streams[0];}
            }
        }
        catch(err){

        }
    }

    return (
        <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
            <h2>Sender</h2>
            <button onClick={startSending} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                Start Connection
            </button>
            <div style={{ marginTop: '20px' }}>
                <p>Local Video (Preview)</p>
                <video ref={remoteVideoRef} muted autoPlay playsInline style={{ width: '400px', borderRadius: '8px', backgroundColor: '#333' }} />
            </div>
            <div style={{ marginTop: '20px' }}>
                <p>Local Video (Preview)</p>
                <video ref={localVideoRef} muted autoPlay playsInline style={{ width: '400px', borderRadius: '8px', backgroundColor: '#333' }} />
            </div>
        </div>
    )
}