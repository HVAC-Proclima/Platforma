# syntax=docker/dockerfile:1

FROM golang:1.23-alpine AS build
WORKDIR /app

# deps
COPY go.mod go.sum ./
RUN go mod download

# source
COPY . .

# build binary
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/api

# runtime
FROM alpine:3.20
WORKDIR /app
COPY --from=build /app/server /app/server

EXPOSE 8080
CMD ["/app/server"]
