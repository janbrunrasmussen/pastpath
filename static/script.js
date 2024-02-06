document.addEventListener('DOMContentLoaded', function () {
    new SearchNavigation()
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
        let items = this.resultsContainer.getElementsByClassName('result-item');
        const maxIndex = items.length - 1;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (e.key === 'ArrowDown') {
                this.selectedIndex = this.selectedIndex < maxIndex ? this.selectedIndex + 1 : 0;
            } else {
                this.selectedIndex = this.selectedIndex > 0 ? this.selectedIndex - 1 : maxIndex;
            }
            this.updateSelectedItem(items);
            e.preventDefault();
        } else if (e.key === 'Enter') {
            if (this.selectedIndex >= 0 && this.selectedIndex <= maxIndex) {
                items[this.selectedIndex].click();
            } else {
                googleSearch();
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
}

function setupSearchFocus() {
    window.onload = function () {
        document.getElementById('search-box').focus();
    };
}

function setupSearchInput() {
    const searchBox = document.getElementById('search-box');
    const resultsContainer = document.getElementById('results-container');

    searchBox.addEventListener('input', function () {
        handleSearchInput(this.value, resultsContainer);
    });
}

function handleSearchInput(searchTerm, resultsContainer) {
    if (searchTerm.length > 0) {
        fetchData(`/search?term=${encodeURIComponent(searchTerm)}`, (data) => {
            displayResults(data, resultsContainer);
        }, (error) => {
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
    resultsContainer.innerHTML = ''; // Clear existing results
    results.forEach(result => {
        const resultItem = createResultItem(result);
        resultsContainer.appendChild(resultItem);
    });
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

function updateSelectedItem(items, selectedIndex) {
    Array.from(items).forEach(item => item.classList.remove('selected'));
    if (selectedIndex >= 0) {
        items[selectedIndex].classList.add('selected');
        items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function googleSearch() {
    const searchBoxContent = document.getElementById('search-box').value;
    const query = encodeURIComponent(searchBoxContent);
    window.location.href = 'https://www.google.com/search?q=' + query;
}

function fetchLastUpdatedInfo() {
    fetchData('/last-updated', (data) => {
        const lastRunTimestampElement = document.getElementById('last-updated-timestamp');
        if (data.last_timestamp) {
            const formattedDate = new Date(data.last_timestamp * 1000).toLocaleString();
            lastRunTimestampElement.textContent = `Updated: ${formattedDate}, Version: ${data.build_version}`;
        } else {
            lastRunTimestampElement.textContent = 'No update timestamp is available.';
        }
    }, (error) => {
        console.error('Error fetching last updated info:', error);
    });
}
