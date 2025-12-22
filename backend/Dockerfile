# -------- build stage --------
FROM golang:1.24 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# build API binary
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" \
  -o /out/server ./cmd/api

# -------- runtime stage --------
FROM alpine:3.20

WORKDIR /app

# certs (pt HTTPS daca ai nevoie) + wget pt healthcheck
RUN apk add --no-cache ca-certificates wget

COPY --from=builder /out/server /app/server
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

# Use Railway PORT if present, fallback 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=10 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/health" >/dev/null 2>&1 || exit 1

CMD ["/app/server"]
