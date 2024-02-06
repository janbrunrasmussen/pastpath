document.addEventListener('DOMContentLoaded', () => {
    window.searchNavigation = new SearchNavigation();
    setupSearchFocus();
    setupSearchInput();
    fetchLastUpdatedInfo();
});

class SearchNavigation {
    constructor() {
        this.selectedIndex = -1; // Encapsulated within the class
        this.resultsContainer = document.getElementById('results-container');
        this.setupKeyboardNavigation();
    }

    setupKeyboardNavigation() {
        const searchBox = document.getElementById('search-box');
        searchBox.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));
    }

    handleKeyboardNavigation(e) {
        const items = this.resultsContainer.getElementsByClassName('result-item');
        const maxIndex = items.length - 1;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            this.selectedIndex = (e.key === 'ArrowDown')
                ? (this.selectedIndex < maxIndex ? this.selectedIndex + 1 : 0)
                : (this.selectedIndex > 0 ? this.selectedIndex - 1 : maxIndex);
            this.updateSelectedItem(items);
            e.preventDefault();
        } else if (e.key === 'Enter') {
            if (this.selectedIndex >= 0 && this.selectedIndex <= maxIndex) {
                items[this.selectedIndex].click();
            } else {
                const query = document.getElementById('search-box').value;
                webSearch(query);
            }
            e.preventDefault();
        }
    }

    updateSelectedItem(items) {
        Array.from(items).forEach(item => item.classList.remove('selected'));
        if (this.selectedIndex >= 0) {
            items[this.selectedIndex].classList.add('selected');
            items[this.selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    resetSelectedIndex() {
        this.selectedIndex = -1;
    }
}

function setupSearchFocus() {
    window.onload = () => document.getElementById('search-box').focus();
}

function debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };

        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function setupSearchInput() {
    const searchBox = document.getElementById('search-box');
    const resultsContainer = document.getElementById('results-container');
    const debouncedSearch = debounce(function(event) {
        searchNavigation.resetSelectedIndex();
        handleSearchInput(event.target.value, resultsContainer);
    }, 50);

    searchBox.addEventListener('input', debouncedSearch);
}

function handleSearchInput(searchTerm, resultsContainer) {
    if (searchTerm.length > 0) {
        fetchData(`/search?term=${encodeURIComponent(searchTerm)}`, data => {
            displayResults(data, resultsContainer);
        }, error => {
            console.error('Error fetching search results:', error);
        });
    } else {
        resultsContainer.innerHTML = '';
        resultsContainer.classList.add('hidden');
    }
}

function fetchData(url, onSuccess, onError) {
    fetch(url)
        .then(response => response.json())
        .then(onSuccess)
        .catch(onError);
}

function displayResults(results, resultsContainer) {
    const fragment = document.createDocumentFragment();

    results.forEach(result => {
        const resultItem = createResultItem(result);
        fragment.appendChild(resultItem);
    });

    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(fragment);
    resultsContainer.classList.toggle('hidden', results.length === 0);
}

function createResultItem(result) {
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

function fetchLastUpdatedInfo() {
    fetchData('/last-updated', data => {
        const lastRunTimestampElement = document.getElementById('last-updated-timestamp');
        const formattedDate = data.last_timestamp ? new Date(data.last_timestamp * 1000).toLocaleString() : 'No update timestamp is available.';
        lastRunTimestampElement.textContent = `Updated: ${formattedDate}, Version: ${data.build_version}`;
    }, error => {
        console.error('Error fetching last updated info:', error);
    });
}

const DEFAULT_SEARCH_PROVIDER_URL = 'https://www.google.com/search?q=';

function webSearch(query, providerUrl = DEFAULT_SEARCH_PROVIDER_URL) {
    const encodedQuery = encodeURIComponent(query);
    window.location.href = `${providerUrl}${encodedQuery}`;
}
