package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"gocv.io/x/gocv"
)

type streamProcesses struct {
	passthroughCmd *exec.Cmd
	processingCmd  *exec.Cmd
}

var runningCameras = make(map[string]*streamProcesses)
var mu sync.Mutex

const (
	frameWidth       = 640
	frameHeight      = 480
	faceDetectionFPS = 2
	frameSize        = frameWidth * frameHeight * 3
)

type BoundingBox struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

type AlertPayload struct {
	CameraID      string        `json:"cameraId"`
	BoundingBoxes []BoundingBox `json:"boundingBoxes"`
	SnapshotURL   string        `json:"snapshotUrl,omitempty"`
}

func main() {
	r := gin.Default()

	r.GET("/healthz", func(c *gin.Context) {
		c.String(http.StatusOK, "OK")
	})

	r.POST("/start-stream", func(c *gin.Context) {
		var req struct {
			CameraID             string `json:"cameraId"`
			RtspURL              string `json:"rtspUrl"`
			FaceDetectionEnabled bool   `json:"faceDetectionEnabled"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		mu.Lock()
		if _, exists := runningCameras[req.CameraID]; exists {
			mu.Unlock()
			c.JSON(http.StatusConflict, gin.H{"message": "Stream already running"})
			return
		}
		mu.Unlock()

		go startStreamPipelines(req.CameraID, req.RtspURL, req.FaceDetectionEnabled)

		c.JSON(http.StatusOK, gin.H{"message": "Stream processing initiated"})
	})

	r.POST("/stop-stream", func(c *gin.Context) {
		var req struct {
			CameraID string `json:"cameraId"`
		}
		if err := c.BindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		mu.Lock()
		defer mu.Unlock()

		if procs, ok := runningCameras[req.CameraID]; ok {
			log.Printf("[%s] Received stop request. Terminating processes...", req.CameraID)
			if procs.passthroughCmd != nil && procs.passthroughCmd.Process != nil {
				procs.passthroughCmd.Process.Signal(syscall.SIGTERM)
			}
			if procs.processingCmd != nil && procs.processingCmd.Process != nil {
				procs.processingCmd.Process.Signal(syscall.SIGTERM)
			}
			delete(runningCameras, req.CameraID)
			c.JSON(http.StatusOK, gin.H{"message": "Stream stopped"})
		} else {
			c.JSON(http.StatusNotFound, gin.H{"message": "Stream not found"})
		}
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("✅ Go Worker starting on port %s", port)
	r.Run(":" + port)
}

func startStreamPipelines(cameraID, rtspURL string, detectionEnabled bool) {
	passthroughCmd := exec.Command("ffmpeg",
		"-rtsp_transport", "tcp",
		"-i", rtspURL,
		"-c:v", "copy",
		"-an",
		"-f", "rtsp",
		"-rtsp_transport", "tcp",
		fmt.Sprintf("rtsp://skylark-mediamtx:8554/%s", cameraID),
	)

	var processingCmd *exec.Cmd
	if detectionEnabled {
		processingCmd = exec.Command("ffmpeg",
			"-rtsp_transport", "tcp",
			"-i", rtspURL,
			"-f", "rawvideo",
			"-pix_fmt", "bgr24",
			"-s", fmt.Sprintf("%dx%d", frameWidth, frameHeight),
			"-r", fmt.Sprintf("%d", faceDetectionFPS),
			"pipe:1",
		)
		processingStdout, _ := processingCmd.StdoutPipe()
		if err := processingCmd.Start(); err != nil {
			log.Printf("[%s] ERROR: Failed to start processing ffmpeg: %v", cameraID, err)
			passthroughCmd.Process.Kill()
			return
		}
		log.Printf("[%s] Started face detection pipeline", cameraID)
		go handleFaceDetection(cameraID, processingStdout)
	}

	if err := passthroughCmd.Start(); err != nil {
		log.Printf("[%s] ERROR: Failed to start passthrough ffmpeg: %v", cameraID, err)
		if processingCmd != nil && processingCmd.Process != nil {
			processingCmd.Process.Kill()
		}
		return
	}
	log.Printf("[%s] Started video passthrough pipeline", cameraID)

	mu.Lock()
	runningCameras[cameraID] = &streamProcesses{passthroughCmd: passthroughCmd, processingCmd: processingCmd}
	mu.Unlock()

	passthroughCmd.Wait()

	log.Printf("[%s] Passthrough stream ended. Cleaning up...", cameraID)
	if processingCmd != nil && processingCmd.Process != nil {
		processingCmd.Process.Signal(syscall.SIGTERM)
	}

	mu.Lock()
	if procs, ok := runningCameras[cameraID]; ok {
		if procs.processingCmd != nil {
			procs.processingCmd.Wait()
		}
		delete(runningCameras, cameraID)
	}
	mu.Unlock()
	log.Printf("[%s] All processes stopped for camera %s", cameraID, cameraID)
}

func handleFaceDetection(cameraID string, stream io.ReadCloser) {
	classifier := gocv.NewCascadeClassifier()
	defer classifier.Close()
	if !classifier.Load("haarcascade_frontalface_default.xml") {
		log.Printf("[%s] ERROR: Failed to load cascade file for detection", cameraID)
		return
	}

	frameBuffer := make([]byte, frameSize)
	for {
		if _, err := io.ReadFull(stream, frameBuffer); err != nil {
			log.Printf("[%s] Face detection stream ended: %v", cameraID, err)
			break
		}

		img, err := gocv.NewMatFromBytes(frameHeight, frameWidth, gocv.MatTypeCV8UC3, frameBuffer)
		if err != nil {
			log.Printf("[%s] ERROR: Could not convert frame for detection: %v", cameraID, err)
			continue
		}

		rects := classifier.DetectMultiScale(img)
		if len(rects) > 0 {
			log.Printf("[%s] Face detected!", cameraID)

			var boxes []BoundingBox
			for _, r := range rects {
				boxes = append(boxes, BoundingBox{X: r.Min.X, Y: r.Min.Y, W: r.Dx(), H: r.Dy()})
			}

			go saveSnapshotAndPostAlert(cameraID, boxes, img.Clone())
		}
		img.Close()
	}
}

func saveSnapshotAndPostAlert(cameraID string, boxes []BoundingBox, img gocv.Mat) {
	defer img.Close()

	timestamp := time.Now().UnixNano()
	filename := fmt.Sprintf("snapshot_%s_%d.jpg", cameraID, timestamp)
	filepath := fmt.Sprintf("/snapshots/%s", filename)

	if ok := gocv.IMWrite(filepath, img); !ok {
		log.Printf("[%s] ERROR: Failed to save snapshot to %s", cameraID, filepath)
		postAlert(cameraID, boxes, "")
		return
	}

	log.Printf("[%s] Saved snapshot to %s", cameraID, filepath)
	snapshotURL := fmt.Sprintf("/snapshots/%s", filename)
	postAlert(cameraID, boxes, snapshotURL)
}

func postAlert(cameraID string, boxes []BoundingBox, snapshotURL string) {
	backendURL := os.Getenv("BACKEND_URL")
	if backendURL == "" {
		backendURL = "http://backend:3000/api/alerts"
	}

	payloadData := AlertPayload{
		CameraID:      cameraID,
		BoundingBoxes: boxes,
		SnapshotURL:   snapshotURL,
	}

	payloadBytes, err := json.Marshal(payloadData)
	if err != nil {
		log.Printf("[%s] ERROR: Failed to marshal alert payload: %v", cameraID, err)
		return
	}

	resp, err := http.Post(backendURL, "application/json", bytes.NewBuffer(payloadBytes))
	if err != nil {
		log.Printf("[%s] ERROR: Failed to post alert to backend: %v", cameraID, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		log.Printf("[%s] WARN: Backend returned non-201 status for alert: %s", cameraID, resp.Status)
	}
}
