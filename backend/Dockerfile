# -------- build stage --------
FROM golang:1.24 AS builder

WORKDIR /app

# deps first (cache-friendly)
COPY go.mod go.sum ./
RUN go mod download

# copy source (context is already backend/)
COPY . .

# build API binary
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/api

# -------- runtime stage --------
FROM gcr.io/distroless/static-debian12

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080
CMD ["/app/server"]
