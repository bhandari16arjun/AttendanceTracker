package config

import (
	"fmt"
	"os"
	"sync"
)

type Config struct {
	MONGO_URI  string
	DB_NAME    string
	JWT_SECRET string
	API_PORT   string
}

var (
	instance *Config
	once     sync.Once
)

func InitialiseConfig() {
	once.Do(func() {
		instance = LoadConfig()
		fmt.Println("Config initialized")
	})
}
func LoadConfig() *Config {
	return &Config{
		MONGO_URI:  getEnv("MONGO_URI", "mongodb://localhost:27017"),
		DB_NAME:    getEnv("DB_NAME", "presently"),
		JWT_SECRET: getEnv("JWT_SECRET", "your_jwt_secret_key"),
		API_PORT:   getEnv("API_PORT", "8080"),
	}
}
func getEnv(key, fallback string) string {
	val, exists := os.LookupEnv(key)
	if !exists {
		return fallback
	}
	return val
}
func GetConfig() *Config {
	if instance == nil {
		InitialiseConfig()
	}
	return instance
}
