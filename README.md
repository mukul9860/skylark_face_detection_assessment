# Skylark Labs - Real-Time Face Detection Dashboard

This project is a microservices-based dashboard for viewing and analyzing multiple camera streams in real-time. 

## Tech Stack
- **Frontend**: React (TypeScript) + Vite + MUI 
- **Backend**: Hono (TypeScript) + Prisma + PostgreSQL 
- **Worker**: Golang + Gin + FFmpeg + GoCV 
- **Infrastructure**: Docker, MediaMTX

## How to Run
1. Ensure you have Docker and Docker Compose installed.
2. Clone the repository.
3. Create a `.env` file in the root directory (copy from `.env.example`).
4. Run `docker-compose up --build` from the root directory.
5. The application will be available at `http://localhost`.

## Test Credentials
- **Username**: testuser
- **Password**: password123