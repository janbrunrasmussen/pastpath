document.addEventListener('DOMContentLoaded', () => {
    setupSearchFocus();
    const searchManager = new SearchManager();
    searchManager.init();
    fetchLastUpdatedInfo();
});

class SearchManager {
    constructor() {
        this.resultsContainer = document.getElementById('results-container');
        this.searchBox = document.getElementById('search-box');
    }

    init() {
        this.setupKeyboardNavigation();
        this.setupSearchInput();
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                this.handleArrowNavigation(e);
            } else if (e.key === 'Enter') {
                this.handleEnterPress(e);
            }
        });
    }

    handleArrowNavigation(e) {
        const focusable = Array.from(this.resultsContainer.querySelectorAll('.result-item'));
        const focusedElement = document.activeElement;
        const currentIndex = focusable.indexOf(focusedElement);

        if (e.key === 'ArrowDown') {
            if (currentIndex < focusable.length - 1) {
                e.preventDefault();
                focusable[currentIndex + 1].focus();
            }
        } else if (e.key === 'ArrowUp') {
            if (currentIndex > 0) {
                e.preventDefault();
                focusable[currentIndex - 1].focus();
            } else {
                e.preventDefault();
                this.searchBox.focus();
            }
        }
    }

    handleEnterPress(e) {
        const activeElement = document.activeElement;
        if (activeElement === this.searchBox && this.searchBox.value.trim()) {
            e.preventDefault();
            webSearch(this.searchBox.value.trim());
        }
    }

    setupSearchInput() {
        const debouncedSearch = debounce((event) => {
            this.handleSearchInput(event.target.value);
        }, 250);

        this.searchBox.addEventListener('input', debouncedSearch);
    }

    handleSearchInput(searchTerm) {
        if (searchTerm.length > 0) {
            fetchData(`/search?term=${encodeURIComponent(searchTerm)}`, (data) => {
                this.displayResults(data);
            }, (error) => {
                console.error('Error fetching search results:', error);
            });
        } else {
            this.resultsContainer.innerHTML = '';
            this.resultsContainer.classList.add('hidden');
        }
    }

    displayResults(results) {
        this.resultsContainer.innerHTML = '';

        if (!results || results.length === 0) {
            this.resultsContainer.classList.add('hidden');
            return;
        }

        const fragment = document.createDocumentFragment();
        results.forEach(result => {
            const resultItem = this.createResultItem(result);
            fragment.appendChild(resultItem);
        });

        this.resultsContainer.appendChild(fragment);
        this.resultsContainer.classList.remove('hidden');
    }

    createResultItem(result) {
        const formattedDate = new Date(result.last_visit_time * 1000).toLocaleString();
        const resultItem = document.createElement('a');
        resultItem.href = result.url;
        resultItem.classList.add('result-item');
        resultItem.tabIndex = 0;
        resultItem.innerHTML = `
            <div class="result-title">${result.title}</div>
            <div class="result-url">${result.url}</div>
            <div class="result-metadata">
                <i>${result.visit_count} visits | last visit: ${formattedDate}</i>
            </div>
        `;
        return resultItem;
    }
}

function setupSearchFocus() {
    window.onload = () => document.getElementById('search-box').focus();
}

function debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function fetchData(url, onSuccess, onError) {
    fetch(url)
        .then(response => response.json())
        .then(onSuccess)
        .catch(onError);
}

function fetchLastUpdatedInfo() {
    fetchData('/last-updated', (data) => {
        const lastRunTimestampElement = document.getElementById('last-updated-timestamp');
        const formattedDate = data.last_timestamp ? new Date(data.last_timestamp * 1000).toLocaleString() : 'No update timestamp is available.';
        lastRunTimestampElement.textContent = `Updated: ${formattedDate}, Version: ${data.build_version}`;
    }, (error) => {
        console.error('Error fetching last updated info:', error);
    });
}

const DEFAULT_SEARCH_PROVIDER_URL = 'https://www.google.com/search?q=';

function webSearch(query, providerUrl = DEFAULT_SEARCH_PROVIDER_URL) {
    const encodedQuery = encodeURIComponent(query);
    window.location.href = `${providerUrl}${encodedQuery}`;
}
