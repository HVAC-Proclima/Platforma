# -------- build stage --------
FROM golang:1.24 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# build migrate
RUN CGO_ENABLED=0 GOOS=linux go build -o migrate ./cmd/migrate

# build api
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/api

# -------- runtime stage --------
FROM gcr.io/distroless/base-debian12

WORKDIR /app

COPY --from=builder /app/migrate /app/migrate
COPY --from=builder /app/server /app/server
COPY --from=builder /app/migrations /app/migrations

EXPOSE 8080

CMD ["/app/migrate", "&&", "/app/server"]
