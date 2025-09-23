import { useState, useEffect } from 'react';
import { 
    Card, CardContent, Typography, CardActions, Button, Box, Divider, 
    FormControlLabel, Switch, List, ListItem, ListItemText, IconButton, 
    Dialog, DialogTitle, DialogContent, TextField, DialogActions 
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import WebRTCPlayer from './WebRTCPlayer';
import api from '../services/api';

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

interface CameraTileProps {
  camera: Camera;
  onCameraUpdate: (updatedCamera: Camera) => void;
  onCameraDelete: (cameraId: number) => void;
}

export default function CameraTile({ camera, onCameraUpdate, onCameraDelete }: CameraTileProps) {
    const [isStreaming, setIsStreaming] = useState(false);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [faceDetection, setFaceDetection] = useState(camera.faceDetectionEnabled);

    const [openEdit, setOpenEdit] = useState(false);
    const [editedCamera, setEditedCamera] = useState({ 
        name: camera.name, 
        location: camera.location, 
        rtspUrl: camera.rtspUrl 
    });

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

    const handleOpenEdit = () => setOpenEdit(true);
    const handleCloseEdit = () => setOpenEdit(false);

    const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditedCamera(prevState => ({ ...prevState, [name]: value }));
    };

    const handleSaveChanges = async () => {
        try {
            const response = await api.put<Camera>(`/cameras/${camera.id}`, editedCamera);
            onCameraUpdate(response.data);
            handleCloseEdit();
        } catch (error) {
            console.error(`Failed to update camera ${camera.id}`, error);
        }
    };

    const handleDeleteCamera = async () => {
        // Use a simple browser confirm dialog
        if (window.confirm(`Are you sure you want to delete the camera "${camera.name}"?`)) {
            try {
                await api.delete(`/cameras/${camera.id}`);
                onCameraDelete(camera.id);
            } catch (error) {
                console.error(`Failed to delete camera ${camera.id}`, error);
            }
        }
    };

    return (
        <>
            <Card>
                {isStreaming ? <WebRTCPlayer cameraId={camera.id} /> : <Box sx={{ height: 240, backgroundColor: '#000' }} />}
                <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="h6">{camera.name}</Typography>
                        <Box>
                            <IconButton size="small" onClick={handleOpenEdit} disabled={isStreaming}><EditIcon /></IconButton>
                            <IconButton size="small" onClick={handleDeleteCamera} disabled={isStreaming}><DeleteIcon /></IconButton>
                        </Box>
                    </Box>
                    <Typography color="text.secondary" gutterBottom>{camera.location}</Typography>
                    <FormControlLabel
                        control={ <Switch checked={faceDetection} onChange={handleToggleFaceDetection} name="faceDetection" disabled={isStreaming} /> }
                        label="Face Detection"
                    />
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

            <Dialog open={openEdit} onClose={handleCloseEdit}>
                <DialogTitle>Edit Camera</DialogTitle>
                <DialogContent>
                    <TextField autoFocus margin="dense" name="name" label="Camera Name" type="text" fullWidth variant="standard" value={editedCamera.name} onChange={handleEditInputChange} />
                    <TextField margin="dense" name="location" label="Location" type="text" fullWidth variant="standard" value={editedCamera.location} onChange={handleEditInputChange} />
                    <TextField margin="dense" name="rtspUrl" label="RTSP URL" type="text" fullWidth variant="standard" value={editedCamera.rtspUrl} onChange={handleEditInputChange} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseEdit}>Cancel</Button>
                    <Button onClick={handleSaveChanges} variant="contained">Save Changes</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

