document.addEventListener('DOMContentLoaded', function () {
    setupSearchFocus();
    setupSearchInput();
    setupKeyboardNavigation();
    fetchLastUpdatedInfo();
});

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

function setupKeyboardNavigation() {
    const searchBox = document.getElementById('search-box');
    const resultsContainer = document.getElementById('results-container');
    let selectedIndex = -1; // No item selected initially

    searchBox.addEventListener('keydown', function (e) {
        handleKeyboardNavigation(e, resultsContainer, selectedIndex, (newIndex) => {
            selectedIndex = newIndex; // Update the selectedIndex with the new value
        });
    });
}

function handleKeyboardNavigation(e, resultsContainer, selectedIndex, updateSelectedIndex) {
    let items = resultsContainer.getElementsByClassName('result-item');
    const maxIndex = items.length - 1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (e.key === 'ArrowDown') {
            selectedIndex = selectedIndex < maxIndex ? selectedIndex + 1 : 0;
        } else {
            selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : maxIndex;
        }
        updateSelectedIndex(selectedIndex);
        updateSelectedItem(items, selectedIndex);
        e.preventDefault();
    } else if (e.key === 'Enter') {
        if (selectedIndex >= 0 && selectedIndex <= maxIndex) {
            items[selectedIndex].click();
        } else {
            googleSearch();
        }
        e.preventDefault();
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
