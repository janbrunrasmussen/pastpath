package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/pkg/errors"
)

type Config struct {
	ServerPort                       int16    `json:"ServerPort"`
	TmpDir                           string   `json:"TmpDir"`
	InstanceID                       string   `json:"InstanceID"`
	HistoryProcessingIntervalSeconds int      `json:"HistoryProcessingIntervalSeconds"`
	LocalDBPath                      string   `json:"LocalDBPath"`
	Browsers                         Browsers `json:"Browsers"`
	Search                           Search   `json:"Search"`
}

type Search struct {
	ReplaceHTTPWithHTTPS bool `json:"ReplaceHTTPWithHTTPS"`
}

func NewDefaultConfig() *Config {
	return &Config{
		ServerPort:                       10000,
		TmpDir:                           ".tmp",
		HistoryProcessingIntervalSeconds: 600,
		LocalDBPath:                      "pastpath.db",
		Search:                           Search{ReplaceHTTPWithHTTPS: true},
	}
}

var (
	BuildVersion string
)

func main() {
	log.Printf("Starting PastPath %s", BuildVersion)

	// Find config path
	var configPath string
	flag.StringVar(&configPath, "c", "config.json", "Path to the config file")
	flag.StringVar(&configPath, "config", "config.json", "Path to the config file")
	flag.Parse()
	log.Printf("Using Config: %s", configPath)

	// Load config
	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Printf("Unable to load config: %v", err)
	}
	// Update browser metadata (query and timestamp converter etc.)
	cfg.Browsers = updateBrowsersMetadata(cfg.Browsers)

	log.Printf("%v", cfg)

	// Initialize local database
	db, err := sql.Open("sqlite3", "pastpath.db")
	if err != nil {
		log.Fatalf("Unable to open local database: %v", err)
	}
	defer db.Close()

	// Ticker for scheduled history processing
	ticker := time.NewTicker(time.Duration(cfg.HistoryProcessingIntervalSeconds) * time.Second)
	go func() {
		for range ticker.C {
			err = cfg.Browsers.processHistory(db, cfg.TmpDir, cfg.InstanceID)
			if err != nil {
				log.Println(err)
			}
		}
	}()
	// Process history once at startup
	err = cfg.Browsers.processHistory(db, cfg.TmpDir, cfg.InstanceID)
	if err != nil {
		log.Println(err)
	}

	// Define routes
	http.HandleFunc("/", indexHandler)
	http.HandleFunc("/search", func(w http.ResponseWriter, r *http.Request) {
		searchHandler(db, cfg.Search.ReplaceHTTPWithHTTPS, w, r)
	})
	http.HandleFunc("/last-updated", func(w http.ResponseWriter, r *http.Request) {
		lastUpdatedHandler(db, w, r)
	})
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	// Start HTTP server
	log.Printf("Starting server on port %d", cfg.ServerPort)
	srv := &http.Server{Addr: fmt.Sprintf(":%d", cfg.ServerPort)}
	go func() {
		if err := srv.ListenAndServe(); err != http.ErrServerClosed {
			log.Fatalf("HTTP server ListenAndServe: %v", err)
		}
	}()

	//Handle shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server Shutdown Failed: %v", err)
	}

	log.Println("Server gracefully stopped")
}

func loadConfig(configFile string) (*Config, error) {
	config := NewDefaultConfig()

	file, err := os.Open(configFile)
	if err != nil {
		return nil, errors.Wrapf(err, "Unable to open config file: %s", configFile)
	}
	defer file.Close()

	decoder := json.NewDecoder(file)
	if err := decoder.Decode(config); err != nil {
		return config, err
	}

	return config, nil
}
