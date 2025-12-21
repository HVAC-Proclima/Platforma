# -------- build stage --------
FROM golang:1.24 AS builder

WORKDIR /src

# deps first (cache-friendly)
COPY backend/go.mod backend/go.sum ./backend/
RUN cd backend && go mod download

# copy backend source
COPY backend ./backend

# build API binary (cmd/api)
RUN cd backend && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/api

# -------- runtime stage --------
FROM gcr.io/distroless/static-debian12

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY --from=builder /src/backend/migrations /app/migrations

EXPOSE 8080

CMD ["/app/server"]
