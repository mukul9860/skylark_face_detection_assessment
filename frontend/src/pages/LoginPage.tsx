import React, { useState } from 'react';
import { Box, Button, TextField, Typography, Container, Alert } from '@mui/material';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        const data = new FormData(event.currentTarget);
        const username = data.get('username') as string;
        const password = data.get('password') as string;

        try {
            const response = await api.post('/login', { username, password });
            localStorage.setItem('authToken', response.data.token);
            navigate('/');
        } catch (err) {
            setError('Invalid username or password.');
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box sx={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h5">Sign In</Typography>
                <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
                    {error && <Alert severity="error" sx={{width: '100%', mt: 2}}>{error}</Alert>}
                    <TextField margin="normal" required fullWidth id="username" label="Username" name="username" autoFocus />
                    <TextField margin="normal" required fullWidth name="password" label="Password" type="password" id="password" />
                    <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>Sign In</Button>
                </Box>
            </Box>
        </Container>
    );
}