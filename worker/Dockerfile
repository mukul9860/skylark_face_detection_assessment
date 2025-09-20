FROM golang:1.22
WORKDIR /app

COPY haarcascade_frontalface_default.xml .

COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o /skylark-worker
CMD [ "/skylark-worker" ]