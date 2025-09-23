import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { ErrorOutline as ErrorIcon, Replay as ReplayIcon } from '@mui/icons-material';

// Define the types for the props and the bounding box
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
    onStreamStateChange: (state: 'connecting' | 'streaming' | 'error') => void;
}

export default function WebRTCPlayer({ cameraId, latestAlert, onStreamStateChange }: WebRTCPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [streamState, setStreamState] = useState<'connecting' | 'streaming' | 'error'>('connecting');
    const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

    const connect = async () => {
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }

        setStreamState('connecting');
        onStreamStateChange('connecting');
        
        const pc = new RTCPeerConnection();
        peerConnectionRef.current = pc;

        pc.ontrack = (event) => {
            if (videoRef.current && event.streams.length > 0) {
                videoRef.current.srcObject = event.streams[0];
                setStreamState('streaming');
                onStreamStateChange('streaming');
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') {
                setStreamState('error');
                onStreamStateChange('error');
            }
        };
        
        try {
            pc.addTransceiver('video', { 'direction': 'recvonly' });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

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
                setStreamState('error');
                onStreamStateChange('error');
            }
        } catch (error) {
            console.error('WebRTC connection error:', error);
            setStreamState('error');
            onStreamStateChange('error');
        }
    };

    useEffect(() => {
        connect();
        
        return () => {
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
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
        <Box sx={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000' }}>
            {streamState === 'connecting' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
                    <CircularProgress color="inherit" />
                    <Typography sx={{ mt: 2 }}>Connecting...</Typography>
                </Box>
            )}
            {streamState === 'error' && (
                 <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'white' }}>
                    <ErrorIcon sx={{ fontSize: 40 }}/>
                    <Typography sx={{ mt: 1 }}>Stream Unavailable</Typography>
                     <Button startIcon={<ReplayIcon />} variant="outlined" color="inherit" size="small" onClick={connect} sx={{mt: 2}}>
                        Retry
                    </Button>
                </Box>
            )}
            <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'cover',
                    display: streamState === 'streaming' ? 'block' : 'none'
                }} 
            />
            <canvas 
                ref={canvasRef} 
                style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: '100%',
                    display: streamState === 'streaming' ? 'block' : 'none'
                }} 
            />
        </Box>
    );
}