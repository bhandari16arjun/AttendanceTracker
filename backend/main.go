package main

import (
	"log"

	"presently/api"
	"presently/config"
)

func main() {
	// Initialise configurations
	config.InitialiseConfig()
	a := api.App{}

	if err := a.Initialize(); err != nil {
		log.Fatalf("Failed to initialise the app %v", err)
	}
	if err := a.Run(); err != nil {
		log.Fatalf("SERVER STOPPED WITH ERROR %v", err)
	}

}
