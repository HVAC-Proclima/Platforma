package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if len(os.Args) != 4 {
		log.Fatalf("usage: create-admin <name> <phone> <password>")
	}

	name := os.Args[1]
	phone := os.Args[2]
	password := os.Args[3]

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("hash password: %v", err)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer db.Close()

	_, err = db.Exec(ctx, `
INSERT INTO users (name, phone, role, password_hash)
VALUES ($1, $2, 'admin', $3)
`, name, phone, string(hash))

	if err != nil {
		log.Fatalf("insert admin: %v", err)
	}

	fmt.Println("Admin user created successfully.")
}
