package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"io"
	"log"
	"os"
	"strings"
	"time"

	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

type Browsers []Browser

type Browser struct {
	Name               string            `json:"Name"`
	Type               string            `json:"Type"`
	HistoryDBPath      string            `json:"HistoryDBPath"`
	Query              string            `json:"Query"`
	TimestampConverter func(int64) int64 `json:"TimestampConverter"`
}

func updateBrowsersMetadata(b Browsers) Browsers {
	for i := range b {
		switch strings.ToLower(b[i].Type) {
		case "chrome":
			b[i].Query = "SELECT url, title, visit_count, last_visit_time FROM urls ORDER BY last_visit_time DESC"
			b[i].TimestampConverter = convertChromeTimestamp

		case "firefox":
			b[i].Query = "SELECT url, COALESCE(title,'') AS title, visit_count, COALESCE(last_visit_date,0) AS last_visit_date FROM moz_places ORDER BY last_visit_date DESC"
			b[i].TimestampConverter = convertFirefoxTimestamp

		default:
			log.Printf("Browser not supported: %s", b[i].Name)
		}
	}
	return b
}

func (b Browser) copyDBPath(tmpDir string) string {
	return filepath.Join(tmpDir, b.Name+".db")
}

type BrowserHistoryEntry struct {
	URL           string
	Title         string
	VisitCount    int
	LastVisitTime int64
}

func (browsers Browsers) processHistory(db *sql.DB, tmpDir, instanceID string) error {
	log.Println("Processing browser history")
	err := createTempDir(tmpDir)
	if err != nil {
		return err
	}

	err = createTables(db)
	if err != nil {
		return err
	}

	for _, b := range browsers {
		if b.Query == "" {
			continue
		}

		err := processBrowserHistory(db, tmpDir, b, instanceID)
		if err != nil {
			return err
		}
	}

	err = cleanTempDir(tmpDir)
	if err != nil {
		return err
	}

	log.Println("Finished processing browser history")
	return nil
}

func createTempDir(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		err = os.Mkdir(dir, 0755)
		if err != nil {
			return err
		}
	}
	return nil
}

func cleanTempDir(dir string) error {
	err := os.RemoveAll(dir)
	if err != nil {
		return err
	}
	return nil
}

func copyDatabase(originalPath, copyPath string) error {
	input, err := os.Open(originalPath)
	if err != nil {
		return err
	}
	defer input.Close()

	output, err := os.Create(copyPath)
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = io.Copy(output, input)
	return err
}

func convertChromeTimestamp(chromeTimestamp int64) int64 {
	return (chromeTimestamp - 11644473600000000) / 1000000
}

func convertFirefoxTimestamp(firefoxTimestamp int64) int64 {
	return firefoxTimestamp / 1000000
}

func hashURL(url string) string {
	hasher := sha256.New()
	hasher.Write([]byte(url))
	return hex.EncodeToString(hasher.Sum(nil))
}

func createTables(db *sql.DB) error {
	createURLsTable := `
        CREATE TABLE IF NOT EXISTS urls (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT,
            title TEXT,
            visit_count INTEGER,
            last_visit_time INTEGER,
            browser TEXT,
            instance_id TEXT,
            url_hash TEXT TEXT,
			UNIQUE(url_hash, browser, instance_id)
        );
		CREATE INDEX IF NOT EXISTS idx_urls_url_last_visit_time ON urls(url, last_visit_time);
		CREATE INDEX IF NOT EXISTS idx_urls_url ON urls(url);
		REINDEX;`
	_, err := db.Exec(createURLsTable)
	if err != nil {
		return err
	}

	createLastRunTable := `
        CREATE TABLE IF NOT EXISTS last_run (
            instance TEXT,
            browser TEXT,
            timestamp INTEGER
        );`
	_, err = db.Exec(createLastRunTable)
	return err
}

func fetchEntries(db *sql.DB, query string, convertTimestamp func(int64) int64) ([]BrowserHistoryEntry, error) {
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []BrowserHistoryEntry
	for rows.Next() {
		var e BrowserHistoryEntry
		if err := rows.Scan(&e.URL, &e.Title, &e.VisitCount, &e.LastVisitTime); err != nil {
			return nil, err
		}
		e.LastVisitTime = convertTimestamp(e.LastVisitTime)
		entries = append(entries, e)
	}

	return entries, nil
}

func upsertEntriesToDB(db *sql.DB, entries []BrowserHistoryEntry, browser, instanceID string) error {
	log.Printf("Starting merge for browser: %s", browser)

	upsertQuery := `INSERT INTO urls
                    (url, title, visit_count, last_visit_time, browser, instance_id, url_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(url_hash, browser, instance_id) DO UPDATE SET
                    title=excluded.title,
                    visit_count=excluded.visit_count,
                    last_visit_time=excluded.last_visit_time;`

	tx, err := db.Begin()
	if err != nil {
		return err
	}

	stmt, err := tx.Prepare(upsertQuery)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, e := range entries {
		urlHash := hashURL(e.URL)
		_, err := stmt.Exec(e.URL, e.Title, e.VisitCount, e.LastVisitTime, browser, instanceID, urlHash)
		if err != nil {
			tx.Rollback()
			return err
		}
	}
	err = tx.Commit()
	if err != nil {
		return err
	}

	log.Printf("Done merging for browser: %s", browser)
	return nil
}

func insertLastRun(db *sql.DB, browser, instanceID string) error {
	insertQuery := "INSERT INTO last_run (instance, browser, timestamp) VALUES (?, ?, ?)"
	_, err := db.Exec(insertQuery, instanceID, browser, time.Now().Unix())
	return err
}

func processBrowserHistory(db *sql.DB, tmpDir string, b Browser, instanceID string) error {
	copyDBPath := b.copyDBPath(tmpDir)
	log.Printf("Processing browser %s on path %s \n", b.Name, copyDBPath)

	err := copyDatabase(b.HistoryDBPath, copyDBPath)
	if err != nil {
		return err
	}

	historyDB, err := sql.Open("sqlite3", copyDBPath)
	if err != nil {
		return err
	}
	defer historyDB.Close()

	entries, err := fetchEntries(historyDB, b.Query, b.TimestampConverter)
	if err != nil {
		return err
	}

	log.Printf("Found %d entries for browser %s \n", len(entries), b.Name)

	err = upsertEntriesToDB(db, entries, b.Name, instanceID)
	if err != nil {
		return err
	}

	err = insertLastRun(db, b.Name, instanceID)
	if err != nil {
		return err
	}

	return nil
}
