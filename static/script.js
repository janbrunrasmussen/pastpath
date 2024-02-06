document.addEventListener('DOMContentLoaded', () => {
    const searchManager = new SearchManager();
    searchManager.init(); // Call init to set up everything related to search navigation
    fetchLastUpdatedInfo();
});

class SearchManager {
    constructor() {
        this.selectedIndex = -1;
        this.resultsContainer = document.getElementById('results-container');
        this.searchBox = document.getElementById('search-box');
    }

    init() {
        this.setupKeyboardNavigation();
        this.setupSearchInput();
    }

    setupKeyboardNavigation() {
        this.searchBox.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
    }
    handleKeyboardNavigation(e) {
        const items = this.resultsContainer.getElementsByClassName('result-item');
        const maxIndex = items.length - 1;
        
        if (e.key === 'ArrowDown') {
            if (this.selectedIndex < maxIndex) this.selectedIndex++;
            else this.selectedIndex = -1;
            
            this.updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            if (this.selectedIndex > 0) this.selectedIndex--;
            else if (this.selectedIndex <= 0) {
                this.selectedIndex = -1;
                this.searchBox.focus();
                return;
            }
            
            this.updateSelection(items);
        } else if (e.key === 'Enter') {
            if (this.selectedIndex === -1) {
                const query = this.searchBox.value;
                webSearch(query); // Make sure this line is correctly triggering the search
                e.preventDefault();
            } else if (this.selectedIndex >= 0 && this.selectedIndex <= maxIndex) {
                items[this.selectedIndex].click();
                e.preventDefault();
            }
        }
        
        if (this.selectedIndex === -1) {
            this.searchBox.focus();
        } else if (this.selectedIndex >= 0) {
            items[this.selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    updateSelection(items) {
        Array.from(items).forEach(item => item.classList.remove('selected'));
        if (this.selectedIndex >= 0) {
            items[this.selectedIndex].classList.add('selected');
            items[this.selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    setupSearchInput() {
        const debouncedSearch = debounce((event) => {
            this.handleSearchInput(event.target.value);
        }, 50);

        this.searchBox.addEventListener('input', debouncedSearch);
    }

    handleSearchInput(searchTerm) {
        this.selectedIndex = -1; // Reset selection on new input
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
        const fragment = document.createDocumentFragment();
        results.forEach(result => {
            const resultItem = this.createResultItem(result);
            fragment.appendChild(resultItem);
        });
        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(fragment);
        this.resultsContainer.classList.toggle('hidden', results.length === 0);
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
