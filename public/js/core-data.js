// Core Data Management Module
// Handles stations data, filtering, pagination, and search functionality

// Global data variables
let stations = [];
let filteredStations = [];
let currentPage = 1;
const stationsPerPage = 50;
let selectedStations = new Set();

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    loadStations();
    setupEventListeners();
});

function setupEventListeners() {
    // Search input
    document.getElementById('search-input').addEventListener('input', debounce(filterStations, 300));
    
    // Filter dropdowns
    ['filter-country', 'filter-genre', 'filter-type', 'filter-image'].forEach(id => {
        document.getElementById(id).addEventListener('change', filterStations);
    });

    // Select all checkboxes
    document.getElementById('select-all').addEventListener('change', toggleSelectAll);
    document.getElementById('header-select-all').addEventListener('change', toggleSelectAll);
}

async function loadStations() {
    try {
        console.log('Loading stations...');
        const response = await fetch('/stations');
        console.log('Response status:', response.status);
        if (response.ok) {
            stations = await response.json();
            console.log('Loaded stations:', stations.length);
            filteredStations = [...stations];
            await loadFilterOptions(); // Load filter options after stations are loaded
            renderStations();
            updateStationsCount();
        } else {
            throw new Error(`Failed to load stations: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error loading stations:', error);
        showError('Failed to load stations. Please try again.');
    }
}

async function loadFilterOptions() {
    try {
        console.log('Loading filter options from', stations.length, 'stations');
        
        // Clear existing options (except "All" option)
        const countrySelect = document.getElementById('filter-country');
        const genreSelect = document.getElementById('filter-genre');
        const typeSelect = document.getElementById('filter-type');
        
        // Clear all options except the first one (All)
        countrySelect.innerHTML = '<option value="">All Countries</option>';
        genreSelect.innerHTML = '<option value="">All Genres</option>';
        typeSelect.innerHTML = '<option value="">All Types</option>';

        // Load countries
        const countries = [...new Set(stations.map(s => s.country))].filter(Boolean).sort();
        console.log('Found countries:', countries.length);
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        });

        // Load genres
        const genres = [...new Set(stations.map(s => s.genre))].filter(Boolean).sort();
        console.log('Found genres:', genres.length);
        genres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = genre;
            genreSelect.appendChild(option);
        });

        // Load types
        const types = [...new Set(stations.map(s => s.type))].filter(Boolean).sort();
        console.log('Found types:', types.length);
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

function filterStations() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const countryFilter = document.getElementById('filter-country').value;
    const genreFilter = document.getElementById('filter-genre').value;
    const typeFilter = document.getElementById('filter-type').value;
    const imageFilter = document.getElementById('filter-image').value;

    console.log('Filtering stations with:', {
        searchTerm,
        countryFilter,
        genreFilter,
        typeFilter,
        imageFilter
    });

    filteredStations = stations.filter(station => {
        const matchesSearch = !searchTerm || [
            station.name, station.country, station.genre, station.type, station.city
        ].some(field => field && field.toLowerCase().includes(searchTerm));

        const matchesCountry = !countryFilter || station.country === countryFilter;
        const matchesGenre = !genreFilter || station.genre === genreFilter;
        const matchesType = !typeFilter || station.type === typeFilter;
        const matchesImage = !imageFilter || 
            (imageFilter === 'has-image' && station.faviconUrl) ||
            (imageFilter === 'no-image' && !station.faviconUrl);

        return matchesSearch && matchesCountry && matchesGenre && matchesType && matchesImage;
    });

    currentPage = 1;
    renderStations();
    updateStationsCount();
    updateActiveFilters();
}

function changePage(direction) {
    const totalPages = Math.ceil(filteredStations.length / stationsPerPage);
    if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
    } else if (direction === 'prev' && currentPage > 1) {
        currentPage--;
    }
    renderStations();
}

function updateStationsCount() {
    document.getElementById('stations-count').textContent = filteredStations.length;
}

function updateActiveFilters() {
    const filtersContainer = document.getElementById('active-filters');
    const searchTerm = document.getElementById('search-input').value;
    const countryFilter = document.getElementById('filter-country').value;
    const genreFilter = document.getElementById('filter-genre').value;
    const typeFilter = document.getElementById('filter-type').value;
    const imageFilter = document.getElementById('filter-image').value;

    let filtersHTML = '';
    
    if (searchTerm) filtersHTML += `<span class="filter-badge px-3 py-1 rounded-full text-white text-sm mr-2 mb-2 inline-flex items-center">Search: "${searchTerm}" <button onclick="removeFilter('search')" class="ml-2 text-white hover:text-gray-300">×</button></span>`;
    if (countryFilter) filtersHTML += `<span class="filter-badge px-3 py-1 rounded-full text-white text-sm mr-2 mb-2 inline-flex items-center">Country: ${countryFilter} <button onclick="removeFilter('country')" class="ml-2 text-white hover:text-gray-300">×</button></span>`;
    if (genreFilter) filtersHTML += `<span class="filter-badge px-3 py-1 rounded-full text-white text-sm mr-2 mb-2 inline-flex items-center">Genre: ${genreFilter} <button onclick="removeFilter('genre')" class="ml-2 text-white hover:text-gray-300">×</button></span>`;
    if (typeFilter) filtersHTML += `<span class="filter-badge px-3 py-1 rounded-full text-white text-sm mr-2 mb-2 inline-flex items-center">Type: ${typeFilter} <button onclick="removeFilter('type')" class="ml-2 text-white hover:text-gray-300">×</button></span>`;
    if (imageFilter) filtersHTML += `<span class="filter-badge px-3 py-1 rounded-full text-white text-sm mr-2 mb-2 inline-flex items-center">Image: ${imageFilter === 'has-image' ? 'Has Image' : 'No Image'} <button onclick="removeFilter('image')" class="ml-2 text-white hover:text-gray-300">×</button></span>`;

    if (filtersHTML) {
        filtersHTML += `<button onclick="clearAllFilters()" class="text-sm text-blue-600 hover:text-blue-800 ml-2">Clear All</button>`;
    }

    filtersContainer.innerHTML = filtersHTML;
}

function removeFilter(type) {
    switch(type) {
        case 'search':
            document.getElementById('search-input').value = '';
            break;
        case 'country':
            document.getElementById('filter-country').value = '';
            break;
        case 'genre':
            document.getElementById('filter-genre').value = '';
            break;
        case 'type':
            document.getElementById('filter-type').value = '';
            break;
        case 'image':
            document.getElementById('filter-image').value = '';
            break;
    }
    filterStations();
}

function clearAllFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-country').value = '';
    document.getElementById('filter-genre').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-image').value = '';
    filterStations();
}

function toggleStationSelection(stationId) {
    if (selectedStations.has(stationId)) {
        selectedStations.delete(stationId);
    } else {
        selectedStations.add(stationId);
    }
    updateSelectedCount();
    renderStations(); // Re-render to update checkbox states
}

function toggleSelectAll(event) {
    const isChecked = event.target.checked;
    const currentPageStations = filteredStations.slice(
        (currentPage - 1) * stationsPerPage,
        currentPage * stationsPerPage
    );
    
    if (isChecked) {
        currentPageStations.forEach(station => selectedStations.add(station.id));
    } else {
        currentPageStations.forEach(station => selectedStations.delete(station.id));
    }
    
    updateSelectedCount();
    renderStations();
}

function updateSelectedCount() {
    const count = selectedStations.size;
    const countElement = document.getElementById('selected-count');
    if (countElement) {
        countElement.textContent = count;
        countElement.style.display = count > 0 ? 'inline' : 'none';
    }
}