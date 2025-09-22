package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"io"
	"log"
	"net/http"
	"os/exec"
	"sync"
	"syscall"

	"github.com/gin-gonic/gin"
	"gocv.io/x/gocv"
)

type streamProcesses struct {
	inputCmd  *exec.Cmd
	outputCmd *exec.Cmd
}

var runningCameras = make(map[string]*streamProcesses)
var mu sync.Mutex

const (
	frameWidth    = 640
	frameHeight   = 480
	processingFPS = 5
	frameSize     = frameWidth * frameHeight * 3
)

func main() {
	r := gin.Default()

	r.POST("/start-stream", func(c *gin.Context) {
		var req struct {
			CameraID string `json:"cameraId"`
			RtspURL  string `json:"rtspUrl"`
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

		go processAndPublishStream(req.CameraID, req.RtspURL)

		c.JSON(http.StatusOK, gin.H{"message": "Stream processing initiated"})
	})

	log.Println("✅ Go Worker running on port 8080")
	r.Run(":8080")
}

func processAndPublishStream(cameraID, rtspURL string) {
	classifier := gocv.NewCascadeClassifier()
	defer classifier.Close()
	if !classifier.Load("haarcascade_frontalface_default.xml") {
		log.Printf("[%s] ERROR: Failed to load cascade file", cameraID)
		return
	}

	ffmpegInputCmd := exec.Command("ffmpeg",
		"-rtsp_transport", "tcp",
		"-i", rtspURL,
		"-f", "rawvideo",
		"-pix_fmt", "bgr24",
		"-s", fmt.Sprintf("%dx%d", frameWidth, frameHeight),
		"-r", fmt.Sprintf("%d", processingFPS),
		"pipe:1",
	)
	ffmpegInputStdout, _ := ffmpegInputCmd.StdoutPipe()

	ffmpegOutputCmd := exec.Command("ffmpeg",
		"-f", "rawvideo",
		"-pix_fmt", "bgr24",
		"-s", fmt.Sprintf("%dx%d", frameWidth, frameHeight),
		"-r", fmt.Sprintf("%d", processingFPS),
		"-i", "pipe:0",
		"-c:v", "libx264",
		"-preset", "veryfast",
		"-tune", "zerolatency",
		"-pix_fmt", "yuv420p",
		"-f", "rtsp",
		"-rtsp_transport", "tcp",
		fmt.Sprintf("rtsp://mediamtx:8554/%s", cameraID),
	)
	ffmpegOutputStdin, _ := ffmpegOutputCmd.StdinPipe()

	if err := ffmpegInputCmd.Start(); err != nil {
		log.Printf("[%s] ERROR: Failed to start input ffmpeg: %v", cameraID, err)
		return
	}
	if err := ffmpegOutputCmd.Start(); err != nil {
		log.Printf("[%s] ERROR: Failed to start output ffmpeg: %v", cameraID, err)
		return
	}

	mu.Lock()
	runningCameras[cameraID] = &streamProcesses{inputCmd: ffmpegInputCmd, outputCmd: ffmpegOutputCmd}
	mu.Unlock()
	log.Printf("[%s] Started processing and publishing stream", cameraID)

	frameBuffer := make([]byte, frameSize)
	var lastRects []image.Rectangle

	for {
		if _, err := io.ReadFull(ffmpegInputStdout, frameBuffer); err != nil {
			log.Printf("[%s] Input stream ended: %v", cameraID, err)
			break
		}

		img, err := gocv.NewMatFromBytes(frameHeight, frameWidth, gocv.MatTypeCV8UC3, frameBuffer)
		if err != nil {
			log.Printf("[%s] ERROR: Could not convert frame buffer to Mat: %v", cameraID, err)
			continue
		}

		rects := classifier.DetectMultiScale(img)
		if len(rects) > 0 {
			lastRects = rects
			go postAlert(cameraID)
		} else {
			lastRects = nil
		}

		if len(lastRects) > 0 {
			for _, r := range lastRects {
				gocv.Rectangle(&img, r, color.RGBA{0, 255, 0, 0}, 2)
			}
		}

		if _, err := ffmpegOutputStdin.Write(img.ToBytes()); err != nil {
			log.Printf("[%s] Output stream closed: %v", cameraID, err)
			img.Close()
			break
		}
		img.Close()
	}

	log.Printf("[%s] Cleaning up processes for camera %s", cameraID, cameraID)
	if ffmpegInputCmd.Process != nil {
		ffmpegInputCmd.Process.Signal(syscall.SIGTERM)
	}
	if ffmpegOutputCmd.Process != nil {
		ffmpegOutputCmd.Process.Signal(syscall.SIGTERM)
	}
	ffmpegInputCmd.Wait()
	ffmpegOutputCmd.Wait()

	mu.Lock()
	delete(runningCameras, cameraID)
	mu.Unlock()
	log.Printf("[%s] Stopped processing stream for camera %s", cameraID, cameraID)
}

func postAlert(cameraID string) {
	payload := bytes.NewBuffer([]byte(fmt.Sprintf(`{"cameraId": "%s"}`, cameraID)))
	resp, err := http.Post("http://backend:3000/api/alerts", "application/json", payload)
	if err != nil {
		log.Printf("[%s] ERROR: Failed to post alert to backend: %v", cameraID, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		log.Printf("[%s] WARN: Backend returned non-201 status for alert: %s", cameraID, resp.Status)
	}
}
