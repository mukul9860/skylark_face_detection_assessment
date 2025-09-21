# Stage 1: Build OpenCV from source on Debian "Bullseye"
FROM golang:1.23-bullseye AS builder

# Install all necessary build tools and dependencies for OpenCV
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

# Set a directory for the OpenCV build
WORKDIR /opencv

# Download the specific versions of OpenCV and opencv_contrib
RUN git clone https://github.com/opencv/opencv.git --branch 4.5.5 --depth 1 && \
    git clone https://github.com/opencv/opencv_contrib.git --branch 4.5.5 --depth 1

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

# Compile and install
RUN make -j$(nproc) && make install

# Stage 2: Build the Go application against the custom OpenCV
FROM golang:1.23-bullseye AS go-builder

# Copy the compiled OpenCV libraries and headers from the builder stage
COPY --from=builder /usr/local /usr/local

# Set required environment variables for the Go compiler
ENV PKG_CONFIG_PATH=/usr/local/lib/pkgconfig
ENV LD_LIBRARY_PATH=/usr/local/lib
ENV CGO_CPPFLAGS="-I/usr/local/include"
ENV CGO_LDFLAGS="-L/usr/local/lib -lopencv_core -lopencv_highgui -lopencv_imgproc -lopencv_objdetect -lopencv_videoio -lopencv_aruco"

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Build the current package in the current directory
RUN CGO_ENABLED=1 go build -o /skylark-worker .

# Stage 3: Create the final production image using the same Debian base
FROM debian:bullseye

# Install the exact same runtime dependencies as the builder stage
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgtk-3-0 \
    libavcodec58 \
    libavformat58 \