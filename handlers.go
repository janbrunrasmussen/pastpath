package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
)

func indexHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, "static/index.html")
}

func searchHandler(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	searchTerm := r.URL.Query().Get("term")
	searchTerms := strings.Fields(searchTerm)
	var queryConditions []string
	var queryParameters []interface{}

	for _, term := range searchTerms {
		term = "%" + strings.ToLower(term) + "%"
		queryConditions = append(queryConditions, "(LOWER(title) LIKE ? OR LOWER(url) LIKE ?)")
		queryParameters = append(queryParameters, term, term)
	}
	// Some times the title changes for the url, so here the latest title is selected for each url.
	query := `
		SELECT
			(
				SELECT COALESCE(title, '')
				FROM urls AS latest
				WHERE latest.url = urls.url
				ORDER BY last_visit_time DESC
				LIMIT 1
			) AS title,
			url,
			MAX(last_visit_time) AS last_visit_time,
			SUM(visit_count) AS visit_count
		FROM urls
		WHERE ` + strings.Join(queryConditions, " AND ") + `
		GROUP BY url
		ORDER BY LENGTH(url) ASC
		LIMIT 20;
    `

	rows, err := db.Query(query, queryParameters...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []map[string]interface{}
	for rows.Next() {
		var title, url string
		var lastVisitTime, visitCount int
		if err := rows.Scan(&title, &url, &lastVisitTime, &visitCount); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		entries = append(entries, map[string]interface{}{
			"title":           title,
			"url":             url,
			"last_visit_time": lastVisitTime,
			"visit_count":     visitCount,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func lastUpdatedHandler(db *sql.DB, w http.ResponseWriter, r *http.Request) {
	row := db.QueryRow("SELECT MAX(timestamp) as last_timestamp FROM last_run")

	var lastTimestamp sql.NullInt64
	if err := row.Scan(&lastTimestamp); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if lastTimestamp.Valid {
		json.NewEncoder(w).Encode(map[string]interface{}{"last_timestamp": lastTimestamp.Int64, "build_version": BuildVersion})
	} else {
		json.NewEncoder(w).Encode(map[string]interface{}{"last_timestamp": nil, "build_version": BuildVersion})
	}
}
