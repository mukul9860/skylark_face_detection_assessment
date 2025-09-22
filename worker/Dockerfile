FROM golang:1.23-bullseye AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    pkg-config \
    libgtk-3-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    gfortran \
    openexr \
    libatlas-base-dev \
    libwebp-dev \
    libtbb2 \
    libtbb-dev \
    libdc1394-22-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /opencv

# Use OpenCV version 4.9.0
RUN git clone https://github.com/opencv/opencv.git --branch 4.9.0 --depth 1 && \
    git clone https://github.com/opencv/opencv_contrib.git --branch 4.9.0 --depth 1

# Configure and build OpenCV
WORKDIR /opencv/build
RUN cmake \
    -D CMAKE_BUILD_TYPE=RELEASE \
    -D CMAKE_INSTALL_PREFIX=/usr/local \
    -D OPENCV_EXTRA_MODULES_PATH=/opencv/opencv_contrib/modules \
    -D BUILD_EXAMPLES=OFF \
    -D BUILD_TESTS=OFF \
    -D BUILD_PERF_TESTS=OFF \
    -D BUILD_opencv_java=OFF \
    -D BUILD_opencv_python=OFF \
    -D OPENCV_GENERATE_PKGCONFIG=ON \
    ../opencv

RUN make -j$(nproc) && make install

FROM golang:1.23-bullseye AS go-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libtbb-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libdc1394-22-dev && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local /usr/local

ENV PKG_CONFIG_PATH=/usr/local/lib/pkgconfig
ENV LD_LIBRARY_PATH=/usr/local/lib
ENV CGO_CPPFLAGS="-I/usr/local/include"
ENV CGO_LDFLAGS="-L/usr/local/lib -lopencv_core -lopencv_imgproc -lopencv_highgui -lopencv_videoio -lopencv_objdetect -lopencv_features2d -lopencv_calib3d -lopencv_imgcodecs -lopencv_video"

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=1 go build -o /skylark-worker .

# Create the final production image using the same Debian base
FROM debian:bullseye

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgtk-3-0 \
    libavcodec58 \
    libavformat58 \
    libswscale5 \
    libtbb2 \
    libjpeg62-turbo \
    libpng16-16 \
    libtiff5 \
    libdc1394-25 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /usr/local/lib/ /usr/local/lib/

COPY --from=go-builder /skylark-worker .

COPY --from=go-builder /app/haarcascade_frontalface_default.xml .

ENV LD_LIBRARY_PATH=/usr/local/lib

# Command to run the executable
CMD ["./skylark-worker"]