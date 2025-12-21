# -------- build stage --------
FROM golang:1.24 AS builder

WORKDIR /app

# 1) deps first (cache-friendly)
COPY go.mod go.sum ./
RUN go mod download

# 2) copy source
COPY . .

# 3) build (main.go is in repo root)
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server .

# -------- runtime stage --------
FROM gcr.io/distroless/static-debian12

WORKDIR /app

COPY --from=builder /out/server /app/server
# keep migrations available for MIGRATE_ON_START=1 (your main.go uses "migrations")
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

CMD ["/app/server"]
