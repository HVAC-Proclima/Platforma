package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("unable to create db pool: %v", err)
	}
	defer db.Close()

	if err := db.Ping(ctx); err != nil {
		log.Fatalf("unable to connect to database: %v", err)
	}

	migrationsDir := "migrations"
	files, err := filepath.Glob(filepath.Join(migrationsDir, "*.sql"))
	if err != nil {
		log.Fatalf("glob migrations: %v", err)
	}
	if len(files) == 0 {
		log.Fatalf("no .sql files found in %s", migrationsDir)
	}

	sort.Strings(files)

	for _, path := range files {
		version := filepath.Base(path) // ex: 001_init.sql
		applied, err := isApplied(ctx, db, version)
		if err != nil {
			log.Fatalf("check applied %s: %v", version, err)
		}
		if applied {
			log.Printf("skip %s (already applied)", version)
			continue
		}

		sqlBytes, err := os.ReadFile(path)
		if err != nil {
			log.Fatalf("read %s: %v", path, err)
		}
		sqlText := strings.TrimSpace(string(sqlBytes))
		if sqlText == "" {
			log.Printf("skip %s (empty)", version)
			continue
		}

		log.Printf("apply %s", version)
		if _, err := db.Exec(ctx, sqlText); err != nil {
			log.Fatalf("apply %s failed: %v", version, err)
		}

		// Asigură-te că tabelul schema_migrations există (în caz că fișierul nu l-a creat dintr-un motiv)
		if err := ensureSchemaMigrations(ctx, db); err != nil {
			log.Fatalf("ensure schema_migrations: %v", err)
		}

		if _, err := db.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, version); err != nil {
			log.Fatalf("record migration %s: %v", version, err)
		}

		log.Printf("applied %s", version)
	}

	fmt.Println("Migrations complete.")
}

func ensureSchemaMigrations(ctx context.Context, db *pgxpool.Pool) error {
	_, err := db.Exec(ctx, `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`)
	return err
}

func isApplied(ctx context.Context, db *pgxpool.Pool, version string) (bool, error) {
	// dacă nu există încă schema_migrations, considerăm că nu e aplicat
	_, err := db.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`)
	if err != nil {
		return false, err
	}

	var exists bool
	err = db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version=$1)`, version).Scan(&exists)
	return exists, err
}
