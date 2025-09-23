import { useEffect, useRef } from 'react';

interface BoundingBox {
    x: number;
    y: number;
    w: number;
    h: number;
}
interface Alert {
  id: number;
  timestamp: string;
  boundingBoxes?: BoundingBox[] | null;
}

interface WebRTCPlayerProps {
    cameraId: number;
    latestAlert?: Alert;
}

export default function WebRTCPlayer({ cameraId, latestAlert }: WebRTCPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const pc = new RTCPeerConnection();

        pc.ontrack = (event) => {
            if (videoRef.current && event.streams.length > 0) {
                videoRef.current.srcObject = event.streams[0];
            }
        };

        const connect = async () => {
            try {
                const response = await fetch(`http://${window.location.hostname}:8888/${cameraId}/whep`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/sdp' },
                    body: pc.localDescription?.sdp,
                });

                if (response.ok) {
                    const answer = await response.text();
                    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
                } else {
                    console.error('Failed to connect to WHEP endpoint');
                }
            } catch (error) {
                console.error('WebRTC connection error:', error);
            }
        };
        
        pc.addTransceiver('video', { 'direction': 'recvonly' });
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(connect);
            
        return () => {
            pc.close();
        };
    }, [cameraId]);

    useEffect(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || !latestAlert || !latestAlert.boundingBoxes) {
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = video.clientWidth;
        canvas.height = video.clientHeight;

        const scaleX = video.clientWidth / 640;
        const scaleY = video.clientHeight / 480;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = '#4caf50'; 
        ctx.lineWidth = 2;
        ctx.font = '14px Arial';
        ctx.fillStyle = '#4caf50';

        latestAlert.boundingBoxes.forEach(box => {
            const x = box.x * scaleX;
            const y = box.y * scaleY;
            const w = box.w * scaleX;
            const h = box.h * scaleY;
            
            ctx.strokeRect(x, y, w, h);
            ctx.fillText('Face', x, y > 10 ? y - 5 : 10);
        });

        const timer = setTimeout(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 1500);

        return () => clearTimeout(timer);

    }, [latestAlert]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        </div>
    );
}