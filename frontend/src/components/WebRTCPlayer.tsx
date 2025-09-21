import { useEffect, useRef } from 'react';

export default function WebRTCPlayer({ cameraId }: { cameraId: number }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        pc.addTransceiver('video', { direction: 'recvonly' });

        pc.ontrack = (event) => {
            if (videoRef.current) {
                videoRef.current.srcObject = event.streams[0];
            }
        };

        const connect = async () => {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
    
                const response = await fetch(`http://localhost:8888/${cameraId}/whep`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/sdp' },
                    body: offer.sdp
                });
    
                if (response.status === 201 && response.headers.get('Content-Type') === 'application/sdp') {
                    const answerSdp = await response.text();
                    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
                } else {
                    console.error("Failed to get answer SDP from MediaMTX");
                }
            } catch (error) {
                console.error("WebRTC connection error:", error);
            }
        };

        connect();

        return () => pc.close();
    }, [cameraId]);

    return <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', backgroundColor: '#000', display: 'block' }} />;
}