// Station Editor Module - ES6 Version
// Handles station editing modal, form validation, saving, and data management

// NanoID Helper Functions
function generateNanoId() {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return result;
}

function isValidNanoId(id) {
    return typeof id === 'string' && /^[0-9A-Za-z]{8}$/.test(id);
}

function getStationIdentifier(station) {
    return station.nanoid || station.id?.toString();
}

function findStationById(stations, stationId) {
    return stations.find(s => {
        const identifier = getStationIdentifier(s);
        return identifier === stationId || identifier === stationId.toString();
    });
}

import { GenreManager } from './modules/station-editor-genres.js';
import { ScrapingManager } from './modules/station-editor-scraping.js';
import { ValidationManager } from './modules/station-editor-validation.js';
import { GoogleBusinessManager } from './modules/station-editor-google.js';
import { AnalysisManager } from './modules/station-editor-analysis.js';
import { MetadataManager } from './modules/station-editor-metadata.js';

// Global state
let currentEditingStation = null;
let originalStationData = null;

// Initialize manager instances
const genreManager = new GenreManager();
const scrapingManager = new ScrapingManager();
const validationManager = new ValidationManager();
const googleBusinessManager = new GoogleBusinessManager();
const analysisManager = new AnalysisManager();
const metadataManager = new MetadataManager();

// Expose managers globally for onclick handlers (temporary until we convert all onclick to proper event listeners)
window.genreManager = genreManager;
window.scrapingManager = scrapingManager;
window.validationManager = validationManager;
window.googleBusinessManager = googleBusinessManager;
window.analysisManager = analysisManager;
window.metadataManager = metadataManager;

// Expose state for modules that need it
window.StationEditorCore = {
    get currentEditingStation() { return currentEditingStation; },
    set currentEditingStation(value) { currentEditingStation = value; },
    get originalStationData() { return originalStationData; },
    set originalStationData(value) { originalStationData = value; },
    get currentScrapedData() { return scrapingManager.currentScrapedData; },
    set currentScrapedData(value) { scrapingManager.currentScrapedData = value; }
};

// Core station editor functions
async function editStation(stationId) {
    console.log('Opening station editor for station:', stationId);
    const station = findStationById(stations, stationId);
    if (!station) {
        alert('Station not found');
        return;
    }
    
    // Ensure modal is loaded
    await ensureModalLoaded();
    
    // Load genre constants
    await genreManager.loadConstants();
    
    currentEditingStation = station;
    originalStationData = { ...station }; // Store original data for reset
    populateStationEditor(station);
    
    // Initialize collapsible sections after modal content is loaded
    setTimeout(() => {
        initializeCollapsibleSections();
    }, 100);
    
    const modal = document.getElementById('station-editor-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function populateStationEditor(station) {
    // Update header
    document.getElementById('editor-station-name').textContent = station.name || 'Unnamed Station';
    document.getElementById('editor-station-id').textContent = getStationIdentifier(station);

    // Show/hide delete buttons based on whether this is a new station
    const stationIdentifier = getStationIdentifier(station);
    const isNewStation = stationIdentifier === 'NEW' || !stationIdentifier;
    const deleteButtons = document.querySelectorAll('#delete-station-btn, #delete-station-btn-footer');
    deleteButtons.forEach(btn => {
        if (btn) {
            btn.style.display = isNewStation ? 'none' : 'block';
        }
    });

    // Basic Info
    document.getElementById('edit-name').value = station.name || '';
    document.getElementById('edit-country').value = station.country || '';
    document.getElementById('edit-city').value = station.city || '';
    document.getElementById('edit-stream-url').value = station.streamUrl || '';
    document.getElementById('edit-homepage').value = station.homepage || '';
    document.getElementById('edit-language').value = station.language || '';
    document.getElementById('edit-bitrate').value = station.bitrate || '';
    document.getElementById('edit-codec').value = station.codec || '';
    document.getElementById('edit-frequency').value = station.frequency || '';

    // Initialize genre system using the manager
    genreManager.initializeSystem(station);

    // Location & Tags
    document.getElementById('edit-tags').value = station.tags || '';
    document.getElementById('edit-latitude').value = station.latitude || '';
    document.getElementById('edit-longitude').value = station.longitude || '';

    // Advanced Fields
    document.getElementById('edit-description').value = station.description || '';
    document.getElementById('edit-facebook').value = station.facebookUrl || '';
    document.getElementById('edit-twitter').value = station.twitterUrl || '';
    document.getElementById('edit-instagram').value = station.instagramUrl || '';
    document.getElementById('edit-youtube').value = station.youtubeUrl || '';
    document.getElementById('edit-owner').value = station.owner || '';
    document.getElementById('edit-established').value = station.establishedYear || '';
    document.getElementById('edit-email').value = station.email || '';
    document.getElementById('edit-phone').value = station.phone || '';
    document.getElementById('edit-favicon').value = station.favicon || '';
    document.getElementById('edit-logo').value = station.logo || '';
    document.getElementById('edit-local-image').value = station.local_image_url || '';
    document.getElementById('edit-address').value = station.address || '';

    // Initialize metadata system using the manager
    metadataManager.loadMetadataConfig(station);

    // Quality & Curation
    document.getElementById('edit-quality-score').value = station.qualityScore || '';
    document.getElementById('edit-editors-pick').checked = station.editorsPick || false;
    document.getElementById('edit-featured').checked = station.featured || false;
    document.getElementById('edit-is-active').checked = station.isActive !== false; // Default to true

    // Clear and reset scraper tools for new station
    document.getElementById('scraper-url').value = '';
    const normalizationSuggestions = document.getElementById('normalization-suggestions');
    if (normalizationSuggestions) {
        normalizationSuggestions.classList.add('hidden');
    }
    const scrapedDataPreview = document.getElementById('scraped-data-preview');
    if (scrapedDataPreview) {
        scrapedDataPreview.style.display = 'none';
    }
    
    // Reset scraper button
    const scraperButton = document.querySelector('button[onclick="autoScrapeData()"]');
    if (scraperButton) {
        scraperButton.innerHTML = '<i class="fas fa-globe mr-1"></i>Auto-Scrape';
        scraperButton.disabled = false;
    }
    
    // Clear scraped data
    scrapingManager.currentScrapedData = null;

    // Load current image
    loadStationImage(station);
    
    // Update preview to match current download source selection
    setTimeout(() => {
        if (typeof updateImagePreview === 'function') {
            updateImagePreview();
        }
    }, 100);

    // Load stream health
    loadStreamHealth(station);
    
    // Clear any previous Google search results
    googleBusinessManager.clearGoogleBusinessResults();
    
    // Check for normalization suggestions
    analysisManager.checkNormalizationSuggestions(station);
}

function loadStreamHealth(station) {
    const statusElement = document.getElementById('stream-status');
    const lastCheckElement = document.getElementById('last-check');
    
    if (station.lastPingSuccess === true) {
        statusElement.innerHTML = '<span class="health-indicator health-green mr-2"></span><span class="text-sm text-green-600">Healthy</span>';
    } else if (station.lastPingSuccess === false) {
        statusElement.innerHTML = '<span class="health-indicator health-red mr-2"></span><span class="text-sm text-red-600">Offline</span>';
    } else {
        statusElement.innerHTML = '<span class="health-indicator health-gray mr-2"></span><span class="text-sm text-gray-600">Unknown</span>';
    }
    
    if (station.lastPingCheck) {
        const lastCheck = new Date(station.lastPingCheck);
        const now = new Date();
        const diffHours = Math.floor((now - lastCheck) / (1000 * 60 * 60));
        lastCheckElement.textContent = diffHours > 0 ? `${diffHours} hours ago` : 'Recently';
    } else {
        lastCheckElement.textContent = 'Never';
    }
}

// Station saving and validation functions
async function saveStation() {
    try {
        console.log('Saving station...');
        const formData = collectStationFormData();
        
        // Validate required fields
        if (!formData.name.trim()) {
            showError('Station name is required');
            return;
        }
        
        if (!formData.streamUrl.trim()) {
            showError('Stream URL is required');
            return;
        }
        
        // Validate URLs
        try {
            new URL(formData.streamUrl);
        } catch (e) {
            showError('Stream URL must be a valid URL');
            return;
        }
        
        if (formData.homepage && formData.homepage.trim()) {
            try {
                new URL(formData.homepage);
            } catch (e) {
                showError('Homepage URL must be a valid URL');
                return;
            }
        }

        let response;
        let successMessage;
        
        // Check if we're in manual mode (creating new station)
        if (window.manualMode && currentEditingStation.id === 'NEW') {
            // Create new station
            response = await fetch('/stations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            successMessage = 'Station created successfully!';
        } else {
            // Update existing station
            response = await fetch(`/stations/${getStationIdentifier(currentEditingStation)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            successMessage = 'Station saved successfully!';
        }

        if (response.ok) {
            const station = await response.json();
            
            // Update the station in our local data (only if stations exists)
            if (typeof stations !== 'undefined' && Array.isArray(stations)) {
                if (window.manualMode && currentEditingStation.id === 'NEW') {
                    // Add new station to the list
                    stations.push(station);
                } else {
                    // Update existing station
                    const stationIndex = stations.findIndex(s => getStationIdentifier(s) === getStationIdentifier(currentEditingStation));
                    if (stationIndex !== -1) {
                        stations[stationIndex] = station;
                    }
                }
            }

            // Update filtered stations (only if filteredStations exists)
            if (typeof filteredStations !== 'undefined' && Array.isArray(filteredStations)) {
                if (window.manualMode && currentEditingStation.id === 'NEW') {
                    // Add new station to filtered list
                    filteredStations.push(station);
                } else {
                    // Update existing station
                    const filteredIndex = filteredStations.findIndex(s => getStationIdentifier(s) === getStationIdentifier(currentEditingStation));
                    if (filteredIndex !== -1) {
                        filteredStations[filteredIndex] = station;
                    }
                }
            }
            
            // Reset manual mode
            if (window.manualMode) {
                window.manualMode = false;
            }
            
            showSuccess(successMessage);
            closeStationEditor();
            renderStations(); // Re-render to show updated data
        } else {
            const error = await response.json();
            showError(`Failed to save station: ${error.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error saving station:', error);
        showError('Error saving station');
    }
}

function collectStationFormData() {
    // Get current genre selections from the manager
    const genreSelections = genreManager.getCurrentSelections();
    
    return {
        name: document.getElementById('edit-name').value.trim(),
        country: document.getElementById('edit-country').value.trim(),
        city: document.getElementById('edit-city').value.trim(),
        streamUrl: document.getElementById('edit-stream-url').value.trim(),
        homepage: document.getElementById('edit-homepage').value.trim(),
        language: document.getElementById('edit-language').value.trim(),
        bitrate: parseInt(document.getElementById('edit-bitrate').value) || null,
        codec: document.getElementById('edit-codec').value.trim(),
        frequency: document.getElementById('edit-frequency').value.trim(),
        
        // Genre data from the manager
        genre: genreSelections.genres,
        subgenre: genreSelections.subgenres,  
        type: genreSelections.types,
        
        // Location
        tags: document.getElementById('edit-tags').value.trim(),
        latitude: parseFloat(document.getElementById('edit-latitude').value) || null,
        longitude: parseFloat(document.getElementById('edit-longitude').value) || null,
        
        // Advanced fields
        description: document.getElementById('edit-description').value.trim(),
        facebookUrl: document.getElementById('edit-facebook').value.trim(),
        twitterUrl: document.getElementById('edit-twitter').value.trim(),
        instagramUrl: document.getElementById('edit-instagram').value.trim(),
        youtubeUrl: document.getElementById('edit-youtube').value.trim(),
        owner: document.getElementById('edit-owner').value.trim(),
        establishedYear: parseInt(document.getElementById('edit-established').value) || null,
        email: document.getElementById('edit-email').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
        favicon: document.getElementById('edit-favicon').value.trim(),
        logo: document.getElementById('edit-logo').value.trim(),
        local_image_url: document.getElementById('edit-local-image').value.trim(),
        address: document.getElementById('edit-address').value.trim(),
        
        // Metadata (from manager)
        ...metadataManager.getMetadataConfig(),
        
        // Quality & Curation
        qualityScore: parseFloat(document.getElementById('edit-quality-score').value) || null,
        editorsPick: document.getElementById('edit-editors-pick').checked,
        featured: document.getElementById('edit-featured').checked,
        isActive: document.getElementById('edit-is-active').checked
    };
}

// Delete station function
async function deleteStation() {
    if (!currentEditingStation || !getStationIdentifier(currentEditingStation)) {
        showError('No station selected for deletion');
        return;
    }

    // Confirm deletion
    const stationName = currentEditingStation.name || 'this station';
    const confirmDelete = confirm(`Are you sure you want to delete "${stationName}"?\n\nThis action cannot be undone and will permanently remove the station from the database.`);
    
    if (!confirmDelete) {
        return;
    }

    try {
        console.log('Deleting station:', getStationIdentifier(currentEditingStation));
        
        const response = await fetch(`/stations/${getStationIdentifier(currentEditingStation)}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            // Remove the station from local data arrays
            if (typeof stations !== 'undefined' && Array.isArray(stations)) {
                const stationIndex = stations.findIndex(s => getStationIdentifier(s) === getStationIdentifier(currentEditingStation));
                if (stationIndex !== -1) {
                    stations.splice(stationIndex, 1);
                }
            }

            if (typeof filteredStations !== 'undefined' && Array.isArray(filteredStations)) {
                const filteredIndex = filteredStations.findIndex(s => getStationIdentifier(s) === getStationIdentifier(currentEditingStation));
                if (filteredIndex !== -1) {
                    filteredStations.splice(filteredIndex, 1);
                }
            }
            
            showSuccess(`Station "${stationName}" deleted successfully!`);
            closeStationEditor();
            
            // Re-render the stations list if function exists
            if (typeof renderStations === 'function') {
                renderStations();
            }
        } else {
            const error = await response.json();
            showError(`Failed to delete station: ${error.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error deleting station:', error);
        showError('Error deleting station');
    }
}

// Modal management functions
function closeStationEditor() {
    const modal = document.getElementById('station-editor-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
    
    // Clear all form data
    clearStationEditor();
    
    // Reset state
    currentEditingStation = null;
    originalStationData = null;
    scrapingManager.currentScrapedData = null;
}

function resetStationForm() {
    if (originalStationData) {
        populateStationEditor(originalStationData);
    }
}

// Clear all form data
function clearStationEditor() {
    // Basic Info
    document.getElementById('edit-name').value = '';
    document.getElementById('edit-country').value = '';
    document.getElementById('edit-city').value = '';
    document.getElementById('edit-stream-url').value = '';
    document.getElementById('edit-homepage').value = '';
    document.getElementById('edit-language').value = '';
    document.getElementById('edit-bitrate').value = '';
    document.getElementById('edit-codec').value = '';

    // Clear genre system
    genreManager.currentGenres = [];
    genreManager.currentSubgenres = [];
    genreManager.currentTypes = [];
    genreManager.renderTagsForField('genres', []);
    genreManager.renderTagsForField('subgenres', []);
    genreManager.renderTagsForField('types', []);

    // Location & Tags
    document.getElementById('edit-tags').value = '';
    document.getElementById('edit-latitude').value = '';
    document.getElementById('edit-longitude').value = '';

    // Advanced Fields
    document.getElementById('edit-description').value = '';
    document.getElementById('edit-facebook').value = '';
    document.getElementById('edit-twitter').value = '';
    document.getElementById('edit-instagram').value = '';
    document.getElementById('edit-youtube').value = '';
    document.getElementById('edit-owner').value = '';
    document.getElementById('edit-established').value = '';
    document.getElementById('edit-email').value = '';
    document.getElementById('edit-phone').value = '';
    document.getElementById('edit-favicon').value = '';
    document.getElementById('edit-logo').value = '';
    document.getElementById('edit-local-image').value = '';
    document.getElementById('edit-address').value = '';

    // Metadata Configuration
    document.getElementById('edit-metadata-url').value = '';
    document.getElementById('edit-metadata-type').value = '';
    document.getElementById('edit-metadata-format').value = '';
    document.getElementById('edit-metadata-fields').value = '';

    // Quality & Curation
    document.getElementById('edit-quality-score').value = '';
    document.getElementById('edit-editors-pick').checked = false;
    document.getElementById('edit-featured').checked = false;
    document.getElementById('edit-is-active').checked = true;

    // Clear metadata test results
    metadataManager.clearMetadataTestResults();

    // Clear analysis results
    analysisManager.clearAnalysisResults();

    // Clear normalization suggestions
    const suggestionsContainer = document.getElementById('normalization-suggestions');
    if (suggestionsContainer) {
        suggestionsContainer.classList.add('hidden');
    }

    // Clear Google Business results
    googleBusinessManager.clearGoogleBusinessResults();

    // Clear scraped data preview
    const scrapedDataPreview = document.getElementById('scraped-data-preview');
    if (scrapedDataPreview) {
        scrapedDataPreview.style.display = 'none';
    }

    // Reset scraper URL
    document.getElementById('scraper-url').value = '';

    // Clear stream status
    const statusElement = document.getElementById('stream-status');
    const lastCheckElement = document.getElementById('last-check');
    if (statusElement) statusElement.innerHTML = '';
    if (lastCheckElement) lastCheckElement.textContent = '';

    // Clear header info
    document.getElementById('editor-station-name').textContent = '';
    document.getElementById('editor-station-id').textContent = '';
}

// Utility functions
function showError(message) {
    console.error('Error:', message);
    alert(message);
}

function showSuccess(message) {
    console.log('Success:', message);
    alert(message);
}

// Stream testing functions
async function testStreamHealth() {
    const streamUrl = document.getElementById('edit-stream-url').value.trim();
    if (!streamUrl) {
        alert('Please enter a stream URL first');
        return;
    }
    
    try {
        const response = await fetch('/health/test-stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ streamUrl })
        });
        
        const result = await response.json();
        alert(result.success ? 'Stream is accessible!' : `Stream test failed: ${result.error}`);
    } catch (error) {
        alert(`Stream test failed: ${error.message}`);
    }
}

// Test stream connectivity (alias for compatibility)
async function testStreamConnectivity() {
    return testStreamHealth();
}

// Expose functions globally for onclick handlers (temporary)
window.editStation = editStation;
window.populateStationEditor = populateStationEditor;
window.saveStation = saveStation;
window.deleteStation = deleteStation;
window.closeStationEditor = closeStationEditor;
window.resetStationForm = resetStationForm;
window.testStreamHealth = testStreamHealth;
window.testStreamConnectivity = testStreamConnectivity;

// Expose state for other scripts that need it (as properties, not functions)
Object.defineProperty(window, 'currentEditingStation', {
    get() { return currentEditingStation; },
    set(value) { currentEditingStation = value; }
});

// Analysis functions
window.analyzeStation = () => analysisManager.analyzeStation();
window.recalculateQualityScore = () => analysisManager.recalculateQualityScore();
window.applyNormalizationSuggestions = () => analysisManager.applyNormalizationSuggestions();

// Metadata functions
window.testMetadataUrl = () => metadataManager.testMetadataUrl();
window.discoverMetadataUrls = () => metadataManager.discoverMetadataUrls();

// Expose manager methods globally for onclick handlers (temporary until we convert all onclick)
// Genre functions
window.addGenre = (value) => genreManager.addGenre(value);
window.addSubgenre = (value) => genreManager.addSubgenre(value);
window.addType = (value) => genreManager.addType(value);
window.removeGenres = (index) => genreManager.removeGenres(index);
window.removeSubgenres = (index) => genreManager.removeSubgenres(index);
window.removeTypes = (index) => genreManager.removeTypes(index);
// Singular versions for HTML onclick handlers
window.removeGenre = (index) => genreManager.removeGenres(index);
window.removeSubgenre = (index) => genreManager.removeSubgenres(index);
window.removeType = (index) => genreManager.removeTypes(index);
window.showCustomGenreInput = () => genreManager.showCustomGenreInput();
window.cancelCustomGenre = () => genreManager.cancelCustomGenre();
window.addCustomGenre = () => genreManager.addCustomGenre();
window.showCustomSubgenreInput = () => genreManager.showCustomSubgenreInput();
window.cancelCustomSubgenre = () => genreManager.cancelCustomSubgenre();
window.addCustomSubgenre = () => genreManager.addCustomSubgenre();
window.showCustomTypeInput = () => genreManager.showCustomTypeInput();
window.cancelCustomType = () => genreManager.cancelCustomType();
window.addCustomType = () => genreManager.addCustomType();

// Scraping functions
window.autoScrapeData = () => scrapingManager.autoScrapeData();
window.applyScrapedData = () => scrapingManager.applyScrapedData();
window.clearScrapedData = () => scrapingManager.clearScrapedData();
window.useHomepageUrl = () => scrapingManager.useHomepageUrl();
window.testScrapingUrl = () => scrapingManager.testScrapingUrl();

// Google Business functions
window.findGoogleBusiness = () => googleBusinessManager.findGoogleBusiness();

// Validation functions
window.resetForm = () => validationManager.resetForm();
window.validateStationForm = () => validationManager.validateStationForm();

// Collapsible functionality for right column cards
function toggleCollapse(sectionId) {
    const content = document.getElementById(sectionId);
    const chevron = document.getElementById(sectionId + '-chevron');
    
    if (!content || !chevron) {
        console.log('Missing elements for collapse:', sectionId);
        return;
    }
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        chevron.classList.remove('rotated');
    } else {
        content.classList.remove('expanded');
        content.classList.add('collapsed');
        chevron.classList.add('rotated');
    }
}

// Initialize collapsible sections when modal loads (now just for verification)
function initializeCollapsibleSections() {
    // Sections now start collapsed by default in HTML
    // This function is kept for potential future use
    console.log('Collapsible sections initialized');
}

// Expose collapsible functions globally
window.toggleCollapse = toggleCollapse;
window.initializeCollapsibleSections = initializeCollapsibleSections;

console.log('✅ Station Editor ES6 modules loaded successfully');