import { useEffect, useState } from 'react';
import { Grid, Typography, Container } from '@mui/material';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import CameraTile from '../components/CameraTile';

export default function DashboardPage() {
    const [cameras, setCameras] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCameras = async () => {
            try {
                const response = await api.get('/cameras');
                setCameras(response.data);
            } catch (error) {
                console.error('Failed to fetch cameras, redirecting to login', error);
                localStorage.removeItem('authToken');
                navigate('/login');
            }
        };
        fetchCameras();
    }, [navigate]);

    return (
        <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
            <Typography variant="h4" component="h1" gutterBottom>Camera Dashboard</Typography>
            <Grid container spacing={3}>
                {cameras.map((camera) => (
                    <Grid item xs={12} md={6} lg={4} key={camera.id}>
                        <CameraTile camera={camera} />
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
}