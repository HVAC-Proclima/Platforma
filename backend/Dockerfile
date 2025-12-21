# -------- build stage --------
FROM golang:1.24 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# build single binary from main package (root)
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server .

# -------- runtime stage --------
FROM gcr.io/distroless/static-debian12

WORKDIR /app

COPY --from=builder /out/server /app/server
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

USER nonroot:nonroot

CMD ["/app/server"]
