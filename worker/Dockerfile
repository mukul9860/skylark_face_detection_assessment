FROM golang:1.25
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 go build -o /skylark-worker
CMD [ "/skylark-worker" ]