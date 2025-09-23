# Real-Time Multi-Camera Face Detection Dashboard

This project is a microservices-based web application that allows users to monitor multiple RTSP camera streams in real-time. It features live face detection, instant alerts with snapshots, and real-time bounding box overlays directly in the browser.



## Features Implemented

-   **User Authentication**: Secure login/registration system using JWTs.
-   **Full Camera Management (CRUD)**: Users can add, view, update, and delete their camera streams.
-   **Live Streaming**: View live RTSP camera feeds directly in the browser using WebRTC (via MediaMTX).
-   **Real-time Face Detection**: A high-performance Go worker analyzes video streams to detect faces.
-   **Instant Alerts**: Face detections trigger instant alerts, which are pushed to the frontend via WebSockets.
-   **Snapshot on Alert**: When a face is detected, a snapshot image is saved and displayed with the alert.
-   **Bounding Box Overlays**: Real-time bounding boxes are drawn on the video feed to highlight detected faces.
-   **Toggleable Detection**: Face detection can be enabled or disabled for each camera individually.
-   **Start/Stop Stream Control**: Users can start and stop the processing and streaming for each camera.
-   **Protected Routes**: Frontend routing is protected, ensuring only authenticated users can access the dashboard.
-   **Polished UI**: Includes user feedback for stream connection states and custom confirmation dialogs for a smooth user experience.

## Technology Stack

-   **Frontend**: React (TypeScript) with Vite, Material-UI (MUI)
-   **Backend API**: Hono (TypeScript) on Node.js
-   **Database**: PostgreSQL with Prisma ORM
-   **Worker**: Go with Gin and gocv (OpenCV bindings)
-   **Media Server**: MediaMTX for WebRTC and RTSP stream handling
-   **Containerization**: Docker and Docker Compose

## How to Run Locally

### Prerequisites

-   Docker and Docker Compose installed on your machine.
-   An available webcam or a public RTSP stream URL for testing.
-   `ffmpeg` installed on your local machine (only if you want to stream your webcam).

### Setup Instructions

1.  **Clone the Repository**
    ```bash
    git clone <your-repository-url>
    cd <your-repository-folder>
    ```

2.  **Configure Environment Variables**
    Create a `.env` file in the root directory of the project by copying the example:
    ```bash
    cp .env.example .env
    ```
    Open the `.env` file and set the following variables. A strong, random string for `JWT_SECRET` is recommended.

    ```env
    # A secret key for signing JWTs.
    JWT_SECRET=your-super-secret-key-for-jwt

    # Database connection string for Prisma, used by the backend service.
    DATABASE_URL="postgresql://user:password@postgres:5432/skylarkdb?schema=public"
    ```

3.  **Build and Run the Application**
    From the root directory, run the following command. This will build the Docker images for all services and start them in the background.
    ```bash
    docker-compose up --build -d
    ```

4.  **Run the Initial Database Migration**
    After the containers are running, you need to set up the database schema for the first time.
    ```bash
    docker-compose exec backend npx prisma migrate dev --name init
    ```

5.  **Access the Application**
    The application is now running! Open your web browser and navigate to:
    `http://localhost`

### Test User Credentials

You can register a new user directly from the login page. For demonstration purposes, you can use the following credentials after registering:

-   **Username**: `testuser`
-   **Password**: `password123`

### Using the Application

1.  **Register or Login**: Create a new account or log in with the test credentials.
2.  **Add a Camera**: Click the "Add Camera" button and provide a name, location, and a valid RTSP URL.
    -   **To use a public test stream**, use: `rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mov`
    -   **To use your local webcam**, run the following `ffmpeg` command on your machine and use the URL `rtsp://host.docker.internal:8554/webcam` in the form.
        ```bash
        ffmpeg -f avfoundation -framerate 30 -i "0" -c:v libx264 -preset ultrafast -f rtsp rtsp://localhost:8554/webcam
        ```
3.  **Start Streaming**: Click the "Start Stream" button on a camera tile. A "Connecting..." message will appear, and the video should start playing.
4.  **Test Face Detection**: Ensure the "Face Detection" toggle is on. When a face appears in the stream, you should see real-time alerts with snapshots on the right and bounding boxes on the video.

## Known Limitations & Future Improvements

-   The bounding box overlays are drawn on the frontend. This is highly performant but means the raw video stream sent to other clients (e.g., VLC) would not have the overlays.
-   The application could be extended to support more analytics, such as face recognition or object detection.
-   A more comprehensive testing suite (e.g., Jest, Cypress) could be added to ensure long-term stability.