package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	ServerPort string
	MongoURI   string
	DB_Name    string
	JWT_Secret string
}

func LoadConfig() (*Config, error) {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	cfg := &Config{
		ServerPort: getEnv("SERVER_PORT", "3000"),
		MongoURI:   getEnv("MONGO_URI", ""),
		DB_Name:    getEnv("DB_NAME", ""),
		JWT_Secret: getEnv("JWT_SECRET", ""),
	}

	if cfg.MongoURI == "" || cfg.DB_Name == "" || cfg.JWT_Secret == "" {
		log.Fatal("MONGO_URI, DB_NAME, and JWT_SECRET must be set")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
