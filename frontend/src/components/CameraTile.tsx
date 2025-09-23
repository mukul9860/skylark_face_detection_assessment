import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, CardActions, Button, Box, Divider, FormControlLabel, Switch, List, ListItem, ListItemText } from '@mui/material';
import WebRTCPlayer from './WebRTCPlayer';
import api from '../services/api';

// Update the Camera interface to include the new field
interface Camera {
  id: number;
  name: string;
  location: string;
  rtspUrl: string;
  isEnabled: boolean;
  faceDetectionEnabled: boolean;
}

interface Alert {
  id: number;
  timestamp: string;
}

export default function CameraTile({ camera }: { camera: Camera }) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [faceDetection, setFaceDetection] = useState(camera.faceDetectionEnabled);

    useEffect(() => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws?cameraId=${camera.id}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => console.log(`WebSocket connected for camera ${camera.id}`);
        ws.onmessage = (event) => {
            const newAlert = JSON.parse(event.data);
            setAlerts(prevAlerts => [newAlert, ...prevAlerts].slice(0, 5));
        };
        ws.onclose = () => console.log(`WebSocket disconnected for camera ${camera.id}`);

        return () => ws.close();
    }, [camera.id]);
    
    const handleStartStream = async () => {
        try {
            await api.post(`/cameras/${camera.id}/start`);
            setIsStreaming(true);
        } catch (error) {
            console.error(`Failed to start stream for camera ${camera.id}`, error);
        }
    };

    const handleStopStream = async () => {
        try {
            await api.post(`/cameras/${camera.id}/stop`);
            setIsStreaming(false);
        } catch (error) {
            console.error(`Failed to stop stream for camera ${camera.id}`, error);
        }
    };

    const handleToggleFaceDetection = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const isEnabled = event.target.checked;
        setFaceDetection(isEnabled);
        try {
            await api.put(`/cameras/${camera.id}/toggle-detection`, {
                faceDetectionEnabled: isEnabled
            });
        } catch (error) {
            console.error(`Failed to toggle face detection for camera ${camera.id}`, error);
            setFaceDetection(!isEnabled);
        }
    };

    return (
        <Card>
            {isStreaming ? <WebRTCPlayer cameraId={camera.id} /> : <Box sx={{ height: 240, backgroundColor: '#000' }} />}
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6">{camera.name}</Typography>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={faceDetection}
                                onChange={handleToggleFaceDetection}
                                name="faceDetection"
                                disabled={isStreaming}
                            />
                        }
                        label="Face Detection"
                        labelPlacement="start"
                    />
                </Box>
                <Typography color="text.secondary" gutterBottom>{camera.location}</Typography>
                
                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2">Recent Alerts</Typography>
                <List dense>
                    {alerts.length > 0 ? alerts.map(alert => (
                       <ListItem key={alert.id} disableGutters>
                           <ListItemText primary={`Face detected at ${new Date(alert.timestamp).toLocaleTimeString()}`} />
                       </ListItem>
                    )) : <Typography variant="body2" color="text.secondary">No recent alerts</Typography>}
                </List>
            </CardContent>
            <CardActions>
                <Button size="small" onClick={handleStartStream} disabled={isStreaming}>Start Stream</Button>
                <Button size="small" color="secondary" onClick={handleStopStream} disabled={!isStreaming}>Stop Stream</Button>
            </CardActions>
        </Card>
    );
}