# -------- build stage --------
FROM golang:1.24 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
  -o /out/server ./cmd/api

# -------- runtime stage --------
FROM gcr.io/distroless/base-debian12

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

# IMPORTANT: nu punem HEALTHCHECK aici; Railway îl face din setarea /health
CMD ["/app/server"]
