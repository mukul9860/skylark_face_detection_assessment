package main

import (
	"fmt"
	"os/exec"
	"sync"

	"github.com/gin-gonic/gin"
)

// A map to keep track of running camera processes (FFmpeg commands)
var runningCameras = make(map[string]*exec.Cmd)
var mu sync.Mutex

func main() {
	r := gin.Default()

	r.POST("/start-stream", func(c *gin.Context) {
		var req struct {
			CameraID string `json:"cameraId"`
			RtspURL  string `json:"rtspUrl"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "Invalid request"})
			return
		}

		mu.Lock()
		defer mu.Unlock()

		// Check if camera is already running
		if _, exists := runningCameras[req.CameraID]; exists {
			c.JSON(409, gin.H{"message": "Camera stream is already running"})
			return
		}

		outputURL := fmt.Sprintf("rtsp://mediamtx:8554/%s", req.CameraID)

		cmd := exec.Command("ffmpeg", "-i", req.RtspURL, "-c", "copy", "-f", "rtsp", outputURL)

		err := cmd.Start()
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to start FFmpeg process"})
			return
		}

		runningCameras[req.CameraID] = cmd
		fmt.Printf("Started processing for camera %s\n", req.CameraID)

		go func() {
			cmd.Wait()
			mu.Lock()
			delete(runningCameras, req.CameraID)
			mu.Unlock()
			fmt.Printf("Stopped processing for camera %s\n", req.CameraID)
		}()

		c.JSON(200, gin.H{"message": "Stream processing started"})
	})

	r.POST("/stop-stream", func(c *gin.Context) {

	})

	fmt.Println("Go Worker running on port 8080")
	r.Run(":8080")
}
