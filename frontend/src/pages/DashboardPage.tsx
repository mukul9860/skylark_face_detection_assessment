import { useEffect, useState } from 'react';
import { 
  Grid, Typography, Container, Button, CircularProgress, Paper, Box, 
  List, ListItem, ListItemText, Dialog, DialogActions, DialogContent, 
  DialogTitle, TextField 
} from '@mui/material';
import { Add as AddIcon, VideocamOff as VideocamOffIcon } from '@mui/icons-material';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import CameraTile from '../components/CameraTile';

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
  cameraId: number;
  snapshotUrl?: string;
  timestamp: string;
}

const initialCameraState = {
  name: '',
  location: '',
  rtspUrl: ''
};

export default function DashboardPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [newCamera, setNewCamera] = useState(initialCameraState);

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setNewCamera(initialCameraState);
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewCamera(prevState => ({ ...prevState, [name]: value }));
  };

  const handleAddCamera = async () => {
    try {
      const response = await api.post<Camera>('/cameras', newCamera);
      setCameras(prevCameras => [...prevCameras, response.data]);
      handleClose();
    } catch (error) {
      console.error('Failed to add camera:', error);
    }
  };

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        setLoading(true);
        const response = await api.get<Camera[]>('/cameras');
        setCameras(response.data);
      } catch (error) {
        console.error('Failed to fetch cameras, redirecting to login', error);
        localStorage.removeItem('authToken');
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchCameras();
  }, [navigate]);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws?cameraId=all`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => console.log('WebSocket connected for real-time alerts.');
    ws.onmessage = (event) => {
      try {
        const newAlert = JSON.parse(event.data) as Alert;
        setAlerts(prevAlerts => [newAlert, ...prevAlerts]);
      } catch (error) {
        console.error('Error parsing alert message:', error);
      }
    };
    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket disconnected.');
    return () => ws.close();
  }, []);

  const renderContent = () => {
    if (loading) {
      return <Box display="flex" justifyContent="center" alignItems="center" height="50vh"><CircularProgress /></Box>;
    }
    if (cameras.length === 0) {
      return (
        <Paper elevation={3} sx={{ textAlign: 'center', padding: 4, mt: 4 }}>
          <VideocamOffIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
          <Typography variant="h5" component="h2" gutterBottom>No Cameras Found</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>Get started by adding your first camera stream.</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>Add Camera</Button>
        </Paper>
      );
    }
    return (
      <Grid container spacing={3}>
        {cameras.map((camera) => (
          <Grid item xs={12} md={6} lg={4} key={camera.id}><CameraTile camera={camera} /></Grid>
        ))}
      </Grid>
    );
  };
  
  return (
    <>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">Camera Dashboard</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpen}>Add Camera</Button>
        </Box>
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>{renderContent()}</Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Recent Alerts</Typography>
              <List sx={{ maxHeight: '70vh', overflow: 'auto' }}>
                {alerts.length > 0 ? (
                  alerts.map(alert => (
                    <ListItem key={alert.id}>
                      <ListItemText 
                        primary={`Face detected on Camera ${alert.cameraId}`}
                        secondary={new Date(alert.timestamp).toLocaleString()}
                      />
                    </ListItem>
                  ))
                ) : (
                  <Typography color="text.secondary" align="center" sx={{p: 2}}>No alerts yet.</Typography>
                )}
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Container>
      
      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>Add New Camera</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Camera Name"
            type="text"
            fullWidth
            variant="standard"
            value={newCamera.name}
            onChange={handleInputChange}
          />
          <TextField
            margin="dense"
            name="location"
            label="Location"
            type="text"
            fullWidth
            variant="standard"
            value={newCamera.location}
            onChange={handleInputChange}
          />
          <TextField
            margin="dense"
            name="rtspUrl"
            label="RTSP URL"
            type="text"
            fullWidth
            variant="standard"
            value={newCamera.rtspUrl}
            onChange={handleInputChange}
            placeholder="rtsp://..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAddCamera} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}