window.onload = function () {
    document.getElementById('search-box').focus();
};

document.addEventListener('DOMContentLoaded', function () {
    const searchBox = document.getElementById('search-box');
    const resultsContainer = document.getElementById('results-container');
    let selectedIndex = -1; // No item selected initially

    searchBox.addEventListener('input', function () {
        const searchTerm = this.value;
        if (searchTerm.length > 0) {
            searchPath = 'search';
            fetch(`/${searchPath}?term=${encodeURIComponent(searchTerm)}`)
                .then(response => response.json())
                .then(data => {
                    displayResults(data);
                    selectedIndex = -1; // Reset selected index whenever search results update
                })
                .catch(error => console.error('Error fetching search results:', error));
        } else {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.add('hidden');
            selectedIndex = -1; // Reset selected index
        }
    });

    searchBox.addEventListener('keydown', function (e) {
        let items = resultsContainer.getElementsByClassName('result-item');
        const maxIndex = items.length - 1;
        if (e.key === 'ArrowDown') {
            if (selectedIndex < maxIndex) selectedIndex++;
            else selectedIndex = 0; // Wrap around to the first item
            updateSelectedItem(items);
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            if (selectedIndex > 0) selectedIndex--;
            else if (selectedIndex === -1 || selectedIndex === 0) selectedIndex = maxIndex; // Wrap around to the last item
            updateSelectedItem(items);
            e.preventDefault();
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && selectedIndex <= maxIndex) {
                items[selectedIndex].click();
                e.preventDefault();
            } else {
                googleSearch();
                e.preventDefault();
            }
        }
    });

    function updateSelectedItem(items) {
        // Remove 'selected' class from all items
        Array.from(items).forEach(item => item.classList.remove('selected'));

        // Add 'selected' class to the new selected item
        if (selectedIndex >= 0) {
            items[selectedIndex].classList.add('selected');
            items[selectedIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function displayResults(results) {
        resultsContainer.innerHTML = '';
        results.forEach(result => {
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
            resultsContainer.appendChild(resultItem);
        });
        resultsContainer.classList.toggle('hidden', results.length === 0);
    }

    fetch('/last-updated')
        .then(response => response.json())
        .then(data => {
            const lastRunTimestampElement = document.getElementById('last-updated-timestamp');
            if (data.last_timestamp) {
                const formattedDate = new Date(data.last_timestamp * 1000).toLocaleString();
                lastRunTimestampElement.textContent = `Updated: ${formattedDate}, Version: ${data.build_version}`;
            } else {
                lastRunTimestampElement.textContent = 'No update timestamp is aviailable.';
            }
        });

    function googleSearch() {
        const searchBoxContent = document.getElementById('search-box').value;
        const query = encodeURIComponent(searchBoxContent);
        window.location.href = 'https://www.google.com/search?q=' + query;
    }

});


