import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, CardActions, Button, Box, List, ListItem, ListItemText, Divider } from '@mui/material';
import WebRTCPlayer from './WebRTCPlayer';
import api from '../services/api';

export default function CameraTile({ camera }: { camera: any }) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [alerts, setAlerts] = useState<any[]>([]);

    useEffect(() => {
        const ws = new WebSocket(`ws://localhost/ws?cameraId=${camera.id}`);

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

    return (
        <Card>
            {isStreaming ? <WebRTCPlayer cameraId={camera.id} /> : <Box sx={{ height: 240, backgroundColor: '#000' }} />}
            <CardContent>
                <Typography variant="h6">{camera.name}</Typography>
                <Typography color="text.secondary">{camera.location}</Typography>
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
                {/* A 'Stop Stream' button would go here */}
            </CardActions>
        </Card>
    );
}