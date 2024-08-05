package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/pkg/errors"
)

type searchResult struct {
	Title         string `json:"title"`
	URL           string `json:"url"`
	LastVisitTime int    `json:"last_visit_time"`
	VisitCount    int    `json:"visit_count"`
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, "static/index.html")
}

func searchHandler(db *sql.DB, replaceHTTPWithHTTPS bool, w http.ResponseWriter, r *http.Request) {
	searchTerm := r.URL.Query().Get("term")

	searchResults, err := queryHistory(db, replaceHTTPWithHTTPS, searchTerm)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(searchResults)
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

func queryHistory(db *sql.DB, replaceHTTPWithHTTPS bool, searchTerm string) ([]searchResult, error) {
	searchTerms := strings.Fields(searchTerm)
	var queryConditions []string
	var queryParameters []interface{}

	urlColumn := "url_lower"
	if replaceHTTPWithHTTPS {
		urlColumn = "url_https_lower"
	}

	for _, term := range searchTerms {
		term = "%" + strings.ToLower(term) + "%"
		queryConditions = append(queryConditions, "(title_lower LIKE ? OR "+ urlColumn +" LIKE ?)")
		queryParameters = append(queryParameters, term, term)
	}

	query := `
			SELECT
				title,
				` + urlColumn + ` as url,
				MAX(last_visit_time) AS last_visit_time,
				SUM(visit_count) AS visit_count
			FROM urls_cache
			WHERE ` + strings.Join(queryConditions, " AND ") + `
			GROUP BY ` + urlColumn + `
			ORDER BY LENGTH(` + urlColumn + `) ASC
			LIMIT 20;`

	rows, err := db.Query(query, queryParameters...)
	if err != nil {
		return nil, errors.Wrap(err, "Unable to create query")
	}
	defer rows.Close()

	var searchResults []searchResult
	for rows.Next() {
		var result searchResult
		if err := rows.Scan(&result.Title, &result.URL, &result.LastVisitTime, &result.VisitCount); err != nil {
			return nil, errors.Wrap(err, "Unable to scan row")
		}
		searchResults = append(searchResults, result)
	}
	return searchResults, nil
}

func searchSuggestionsHandler(db *sql.DB, replaceHTTPWithHTTPS bool, w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("term")
	if query == "" {
		http.Error(w, "Query parameter 'term' is missing", http.StatusBadRequest)
		return
	}

	searchResults, err := queryHistory(db, replaceHTTPWithHTTPS, query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	_ = searchResults

	var suggestions []string
	// var descriptions []string
	// var urls []string
	limit := 5
	for i, s := range searchResults {
		suggestions = append(suggestions, fmt.Sprintf("%s (%s)", s.Title, s.URL))
		// suggestions = append(suggestions, s.Title)
		// descriptions = append(descriptions, s.Title)
		// urls = append(urls, s.URL)
		if i == limit -1 {
			break
		}
	}

	//response := []interface{}{query, suggestions, descriptions, urls}
	response := []interface{}{query, suggestions}

	w.Header().Set("Content-Type", "application/json")

	err = json.NewEncoder(w).Encode(response)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func redirectHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("term")
	if query == "" {
		http.Error(w, "Query parameter 'term' is missing", http.StatusBadRequest)
		return
	}

	lastOpenParen := strings.LastIndex(query, " (")
	if lastOpenParen == -1 {
		http.Redirect(w, r, "https://google.com/search?q="+query, http.StatusMovedPermanently)
	}

	url := query[lastOpenParen+2 : len(query)-1]


	http.Redirect(w, r, url, http.StatusMovedPermanently)
}



