// Station Editor Module
// Handles station editing modal, form validation, saving, and data management

let currentEditingStation = null;
let originalStationData = null;
let currentNormalizationSuggestions = null;
let currentScrapedData = null;

async function editStation(stationId) {
    console.log('Opening station editor for station:', stationId);
    const station = stations.find(s => s.id === stationId);
    if (!station) {
        alert('Station not found');
        return;
    }
    
    // Ensure modal is loaded
    await ensureModalLoaded();
    
    currentEditingStation = station;
    originalStationData = { ...station }; // Store original data for reset
    populateStationEditor(station);
    const modal = document.getElementById('station-editor-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function populateStationEditor(station) {
    // Update header
    document.getElementById('editor-station-name').textContent = station.name || 'Unnamed Station';
    document.getElementById('editor-station-id').textContent = station.id;

    // Basic Info
    document.getElementById('edit-name').value = station.name || '';
    document.getElementById('edit-country').value = station.country || '';
    document.getElementById('edit-city').value = station.city || '';
    document.getElementById('edit-genre').value = station.genre || '';
    document.getElementById('edit-type').value = station.type || '';
    document.getElementById('edit-stream-url').value = station.streamUrl || '';
    document.getElementById('edit-homepage').value = station.homepage || '';
    document.getElementById('edit-language').value = station.language || '';
    document.getElementById('edit-bitrate').value = station.bitrate || '';
    document.getElementById('edit-codec').value = station.codec || '';

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
    currentScrapedData = null;

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

    // Check for normalization suggestions
    checkNormalizationSuggestions(station);
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

async function checkNormalizationSuggestions(station) {
    const suggestionsContainer = document.getElementById('normalization-suggestions');
    const genreSuggestion = document.getElementById('genre-suggestion');
    const typeSuggestion = document.getElementById('type-suggestion');
    
    try {
        // Call the normalizer API to get suggestions
        const response = await fetch('/admin/normalize-preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                genre: station.genre,
                type: station.type,
                name: station.name
            })
        });
        
        if (response.ok) {
            const suggestions = await response.json();
            currentNormalizationSuggestions = suggestions;
            
            let hasSuggestions = false;
            
            // Show genre suggestion if different
            if (suggestions.genre && suggestions.genre !== station.genre) {
                genreSuggestion.innerHTML = `<span class="text-gray-600">Genre:</span> <span class="text-purple-600">${station.genre || 'empty'} → ${suggestions.genre}</span>`;
                hasSuggestions = true;
            } else {
                genreSuggestion.innerHTML = '';
            }
            
            // Show type suggestion if different
            if (suggestions.type && suggestions.type !== station.type) {
                typeSuggestion.innerHTML = `<span class="text-gray-600">Type:</span> <span class="text-purple-600">${station.type || 'empty'} → ${suggestions.type}</span>`;
                hasSuggestions = true;
            } else {
                typeSuggestion.innerHTML = '';
            }
            
            // Show or hide suggestions container
            if (hasSuggestions) {
                suggestionsContainer.classList.remove('hidden');
            } else {
                suggestionsContainer.classList.add('hidden');
            }
        }
    } catch (error) {
        console.error('Error checking normalization suggestions:', error);
    }
}

function applyNormalizationSuggestions() {
    if (!currentNormalizationSuggestions) return;
    
    if (currentNormalizationSuggestions.genre) {
        document.getElementById('edit-genre').value = currentNormalizationSuggestions.genre;
    }
    
    if (currentNormalizationSuggestions.type) {
        document.getElementById('edit-type').value = currentNormalizationSuggestions.type;
    }
    
    // Hide suggestions after applying
    document.getElementById('normalization-suggestions').classList.add('hidden');
    showSuccess('Normalization suggestions applied!');
}

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
            response = await fetch(`/stations/${currentEditingStation.id}`, {
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
                    const stationIndex = stations.findIndex(s => s.id === currentEditingStation.id);
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
                    const filteredIndex = filteredStations.findIndex(s => s.id === currentEditingStation.id);
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
    return {
        name: document.getElementById('edit-name').value.trim(),
        country: document.getElementById('edit-country').value.trim(),
        city: document.getElementById('edit-city').value.trim(),
        genre: document.getElementById('edit-genre').value.trim(),
        type: document.getElementById('edit-type').value.trim(),
        streamUrl: document.getElementById('edit-stream-url').value.trim(),
        homepage: document.getElementById('edit-homepage').value.trim(),
        language: document.getElementById('edit-language').value.trim(),
        bitrate: document.getElementById('edit-bitrate').value ? parseInt(document.getElementById('edit-bitrate').value) : null,
        codec: document.getElementById('edit-codec').value.trim(),
        tags: document.getElementById('edit-tags').value.trim(),
        latitude: document.getElementById('edit-latitude').value ? parseFloat(document.getElementById('edit-latitude').value) : null,
        longitude: document.getElementById('edit-longitude').value ? parseFloat(document.getElementById('edit-longitude').value) : null,
        description: document.getElementById('edit-description').value.trim(),
        facebookUrl: document.getElementById('edit-facebook').value.trim(),
        twitterUrl: document.getElementById('edit-twitter').value.trim(),
        instagramUrl: document.getElementById('edit-instagram').value.trim(),
        youtubeUrl: document.getElementById('edit-youtube').value.trim(),
        owner: document.getElementById('edit-owner').value.trim(),
        establishedYear: document.getElementById('edit-established').value ? parseInt(document.getElementById('edit-established').value) : null,
        email: document.getElementById('edit-email').value.trim(),
        phone: document.getElementById('edit-phone').value.trim(),
        favicon: document.getElementById('edit-favicon').value.trim(),
        logo: document.getElementById('edit-logo').value.trim(),
        local_image_url: document.getElementById('edit-local-image').value.trim(),
        address: document.getElementById('edit-address').value.trim()
    };
}

// Scraper Functions
async function autoScrapeData() {
    let primaryUrl = document.getElementById('scraper-url').value.trim();
    let secondaryUrl = null;
    
    // Determine primary and secondary URLs
    if (primaryUrl) {
        // If URL is provided, check if we should also use homepage as secondary
        if (currentEditingStation && currentEditingStation.homepage && 
            currentEditingStation.homepage !== primaryUrl) {
            secondaryUrl = currentEditingStation.homepage;
        }
    } else {
        // If no URL provided, use homepage as primary
        if (currentEditingStation && currentEditingStation.homepage) {
            primaryUrl = currentEditingStation.homepage;
            document.getElementById('scraper-url').value = primaryUrl;
        }
    }
    
    if (!primaryUrl) {
        alert('Please enter a URL to scrape or ensure the station has a homepage URL');
        return;
    }
    
    // Validate URLs
    try {
        new URL(primaryUrl);
        if (secondaryUrl) new URL(secondaryUrl);
    } catch (e) {
        alert('Please enter valid URLs (include http:// or https://)');
        return;
    }
    
    try {
        console.log('Scraping primary URL:', primaryUrl);
        if (secondaryUrl) console.log('Scraping secondary URL:', secondaryUrl);
        
        // Show loading state
        const button = event?.target || document.querySelector('button[onclick="autoScrapeData()"]');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Scraping...';
        button.disabled = true;
        
        // Scrape primary URL
        const primaryResponse = await fetch('/admin/scrape-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: primaryUrl })
        });
        
        let primaryData = null;
        if (primaryResponse.ok) {
            primaryData = await primaryResponse.json();
            console.log('Primary scrape result:', primaryData);
        }
        
        // Scrape secondary URL if provided
        let secondaryData = null;
        if (secondaryUrl) {
            const secondaryResponse = await fetch('/admin/scrape-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url: secondaryUrl })
            });
            
            if (secondaryResponse.ok) {
                secondaryData = await secondaryResponse.json();
                console.log('Secondary scrape result:', secondaryData);
            }
        }
        
        // Merge the data
        const mergedData = mergeScrapedData(primaryData, secondaryData);
        console.log('Merged data result:', mergedData);
        displayScrapedData(mergedData);
        
        // Restore button state
        button.innerHTML = originalText;
        button.disabled = false;
    } catch (error) {
        console.error('Error scraping data:', error);
        alert(`Failed to scrape website: ${error.message}`);
        
        // Restore button state
        const button = event?.target || document.querySelector('button[onclick="autoScrapeData()"]');
        if (button) {
            button.innerHTML = '<i class="fas fa-search mr-2"></i>Auto-Scrape';
            button.disabled = false;
        }
    }
}

function mergeScrapedData(primaryResult, secondaryResult) {
    // If only one result is successful, return it
    if (!primaryResult || !primaryResult.success) {
        return secondaryResult;
    }
    if (!secondaryResult || !secondaryResult.success) {
        return primaryResult;
    }
    
    // Both results are successful, check for conflicts
    const primaryData = primaryResult.data || {};
    const secondaryData = secondaryResult.data || {};
    
    // Find fields with conflicts (both sources have different data)
    const conflicts = {};
    const mergedData = {};
    
    const allFields = ['name', 'description', 'phone', 'email', 'website', 'address', 'favicon', 'logo'];
    
    for (const field of allFields) {
        const primaryValue = primaryData[field];
        const secondaryValue = secondaryData[field];
        
        if (primaryValue && secondaryValue && primaryValue !== secondaryValue) {
            // Conflict found - both sources have different values
            conflicts[field] = {
                primary: { value: primaryValue, source: primaryResult.source },
                secondary: { value: secondaryValue, source: secondaryResult.source }
            };
        } else {
            // No conflict - use the available value
            mergedData[field] = primaryValue || secondaryValue;
        }
    }
    
    // Handle coordinates separately
    if (primaryData.coordinates && secondaryData.coordinates) {
        if (primaryData.coordinates.latitude !== secondaryData.coordinates.latitude ||
            primaryData.coordinates.longitude !== secondaryData.coordinates.longitude) {
            conflicts.coordinates = {
                primary: { value: primaryData.coordinates, source: primaryResult.source },
                secondary: { value: secondaryData.coordinates, source: secondaryResult.source }
            };
        } else {
            mergedData.coordinates = primaryData.coordinates;
        }
    } else {
        mergedData.coordinates = primaryData.coordinates || secondaryData.coordinates;
    }
    
    // Handle social media conflicts
    if (primaryData.socialMedia || secondaryData.socialMedia) {
        const primarySocial = primaryData.socialMedia || {};
        const secondarySocial = secondaryData.socialMedia || {};
        const socialConflicts = {};
        const socialMerged = {};
        
        const socialFields = ['facebook', 'twitter', 'instagram', 'youtube'];
        for (const field of socialFields) {
            const primaryValue = primarySocial[field];
            const secondaryValue = secondarySocial[field];
            
            if (primaryValue && secondaryValue && primaryValue !== secondaryValue) {
                socialConflicts[field] = {
                    primary: { value: primaryValue, source: primaryResult.source },
                    secondary: { value: secondaryValue, source: secondaryResult.source }
                };
            } else {
                socialMerged[field] = primaryValue || secondaryValue;
            }
        }
        
        if (Object.keys(socialConflicts).length > 0) {
            conflicts.socialMedia = socialConflicts;
        }
        mergedData.socialMedia = socialMerged;
    }
    
    // If there are conflicts, show conflict resolution UI
    if (Object.keys(conflicts).length > 0) {
        return {
            success: true,
            hasConflicts: true,
            conflicts: conflicts,
            mergedData: mergedData,
            primaryResult: primaryResult,
            secondaryResult: secondaryResult
        };
    }
    
    // No conflicts, return merged data
    const sources = [];
    if (primaryResult.source) sources.push(primaryResult.source);
    if (secondaryResult.source) sources.push(secondaryResult.source);
    
    return {
        success: true,
        data: mergedData,
        source: sources.join(' + '),
        merged: true
    };
}

function displayScrapedData(responseData) {
    console.log('displayScrapedData called with:', responseData);
    const preview = document.getElementById('scraped-data-preview');
    const content = document.getElementById('scraped-content');
    
    console.log('Preview element:', preview);
    console.log('Content element:', content);
    
    // Check if there are conflicts that need resolution
    if (responseData.hasConflicts) {
        console.log('Has conflicts, showing conflict resolution');
        displayConflictResolution(responseData);
        return;
    }
    
    // Extract data from the response structure
    const data = responseData.data || responseData;
    currentScrapedData = data;
    
    let html = '<div class="mb-4"><div class="text-sm text-gray-600 mb-3">Select which data you want to apply:</div></div>';
    
    // Basic fields with checkboxes
    const basicFields = [
        { key: 'name', label: 'Name' },
        { key: 'description', label: 'Description' },
        { key: 'website', label: 'Website' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'address', label: 'Address' }
    ];
    
    basicFields.forEach(field => {
        if (data[field.key]) {
            html += `
                <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                    <label class="flex items-start">
                        <input type="checkbox" id="apply_${field.key}" checked class="mr-3 mt-1">
                        <div>
                            <div class="font-semibold text-sm">${field.label}:</div>
                            <div class="text-sm text-gray-700">${data[field.key]}</div>
                        </div>
                    </label>
                </div>
            `;
        }
    });
    
    // Coordinates
    if (data.coordinates) {
        html += `
            <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <label class="flex items-start">
                    <input type="checkbox" id="apply_coordinates" checked class="mr-3 mt-1">
                    <div>
                        <div class="font-semibold text-sm">Coordinates:</div>
                        <div class="text-sm text-gray-700">${data.coordinates.latitude}, ${data.coordinates.longitude}</div>
                    </div>
                </label>
            </div>
        `;
    }
    
    // Social Media
    if (data.socialMedia && Object.keys(data.socialMedia).length > 0) {
        html += '<div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">';
        html += '<div class="font-semibold text-sm mb-2">Social Media:</div>';
        Object.entries(data.socialMedia).forEach(([platform, url]) => {
            html += `
                <label class="flex items-start mb-2">
                    <input type="checkbox" id="apply_social_${platform}" checked class="mr-3 mt-1">
                    <div>
                        <div class="font-medium text-sm">${platform.charAt(0).toUpperCase() + platform.slice(1)}:</div>
                        <div class="text-sm text-gray-700">${url}</div>
                    </div>
                </label>
            `;
        });
        html += '</div>';
    }
    
    // Images
    if (data.favicon) {
        html += `
            <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <label class="flex items-start">
                    <input type="checkbox" id="apply_favicon" checked class="mr-3 mt-1">
                    <div>
                        <div class="font-semibold text-sm">Favicon:</div>
                        <div class="text-sm text-gray-700">${data.favicon}</div>
                    </div>
                </label>
            </div>
        `;
    }
    
    if (data.logo) {
        html += `
            <div class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <label class="flex items-start">
                    <input type="checkbox" id="apply_logo" checked class="mr-3 mt-1">
                    <div>
                        <div class="font-semibold text-sm">Logo:</div>
                        <div class="text-sm text-gray-700">${data.logo}</div>
                    </div>
                </label>
            </div>
        `;
    }
    
    if (responseData.source) {
        const sourceClass = responseData.merged ? 'text-blue-600 font-semibold' : 'text-gray-600';
        const mergedIcon = responseData.merged ? '<i class="fas fa-layer-group mr-1"></i>' : '';
        html = `<div class="mb-2"><strong>Source:</strong> <span class="${sourceClass}">${mergedIcon}${responseData.source}</span></div>` + html;
    }
    
    content.innerHTML = html || 'No useful data found on this page';
    console.log('Setting preview content and showing preview');
    console.log('Content HTML:', content.innerHTML);
    preview.classList.remove('hidden');
    preview.style.display = 'block'; // Force display in case of CSS issues
    console.log('Preview classes after remove hidden:', preview.className);
    console.log('Preview style display:', preview.style.display);
}

function applyScrapedData() {
    if (!currentScrapedData) return;
    
    let appliedCount = 0;
    
    // Apply basic fields based on checkbox selection
    const basicFields = ['name', 'description', 'website', 'email', 'phone', 'address'];
    basicFields.forEach(field => {
        const checkbox = document.getElementById(`apply_${field}`);
        if (checkbox && checkbox.checked && currentScrapedData[field]) {
            const targetField = field === 'website' ? 'edit-homepage' : `edit-${field}`;
            const targetElement = document.getElementById(targetField);
            if (targetElement) {
                targetElement.value = currentScrapedData[field];
                appliedCount++;
            }
        }
    });
    
    // Apply coordinates
    const coordCheckbox = document.getElementById('apply_coordinates');
    if (coordCheckbox && coordCheckbox.checked && currentScrapedData.coordinates) {
        const latElement = document.getElementById('edit-latitude');
        const lngElement = document.getElementById('edit-longitude');
        if (latElement && lngElement) {
            latElement.value = currentScrapedData.coordinates.latitude;
            lngElement.value = currentScrapedData.coordinates.longitude;
            appliedCount++;
        }
    }
    
    // Apply social media
    if (currentScrapedData.socialMedia) {
        const socialFields = ['facebook', 'twitter', 'instagram', 'youtube'];
        socialFields.forEach(platform => {
            const checkbox = document.getElementById(`apply_social_${platform}`);
            if (checkbox && checkbox.checked && currentScrapedData.socialMedia[platform]) {
                const targetElement = document.getElementById(`edit-${platform}`);
                if (targetElement) {
                    targetElement.value = currentScrapedData.socialMedia[platform];
                    appliedCount++;
                }
            }
        });
    }
    
    // Apply favicon/logo
    const faviconCheckbox = document.getElementById('apply_favicon');
    if (faviconCheckbox && faviconCheckbox.checked && currentScrapedData.favicon) {
        const faviconElement = document.getElementById('edit-favicon');
        if (faviconElement) {
            faviconElement.value = currentScrapedData.favicon;
            appliedCount++;
        }
    }
    
    const logoCheckbox = document.getElementById('apply_logo');
    if (logoCheckbox && logoCheckbox.checked && currentScrapedData.logo) {
        const logoElement = document.getElementById('edit-logo');
        if (logoElement) {
            logoElement.value = currentScrapedData.logo;
            appliedCount++;
        }
    }
    
    alert(`✅ Applied ${appliedCount} selected fields to the station!`);
    
    // Hide scraped data section
    const scrapedDataPreview = document.getElementById('scraped-data-preview');
    if (scrapedDataPreview) {
        scrapedDataPreview.classList.add('hidden');
    }
}

function clearScrapedData() {
    const scrapedDataPreview = document.getElementById('scraped-data-preview');
    if (scrapedDataPreview) {
        scrapedDataPreview.classList.add('hidden');
    }
    currentScrapedData = null;
}

function useHomepageUrl() {
    if (currentEditingStation && currentEditingStation.homepage) {
        document.getElementById('scraper-url').value = currentEditingStation.homepage;
    } else {
        alert('No homepage URL available for this station');
    }
}

function testScrapingUrl() {
    const url = document.getElementById('scraper-url').value;
    if (url) {
        window.open(url, '_blank');
    }
}

let currentConflictData = null;

function getSourceDisplayName(source, isPrimary) {
    if (source === 'Google Maps') return 'Google Maps';
    if (source === 'Website') return isPrimary ? 'Entered URL' : 'Homepage';
    return source;
}

function displayConflictResolution(conflictData) {
    currentConflictData = conflictData;
    const preview = document.getElementById('scraped-data-preview');
    const content = document.getElementById('scraped-content');
    
    let html = `
        <div class="mb-4">
            <div class="text-orange-600 font-semibold mb-2">
                <i class="fas fa-exclamation-triangle mr-1"></i>
                Data Conflicts Found - Choose Which Values to Use:
            </div>
            <div class="text-sm text-gray-600 mb-3">
                Both sources have different values for some fields. Select which ones you want to use:
            </div>
        </div>
    `;
    
    // Display conflicts for each field
    Object.entries(conflictData.conflicts).forEach(([field, conflict]) => {
        if (field === 'socialMedia') {
            // Handle social media conflicts
            html += `<div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">`;
            html += `<div class="font-semibold mb-2">Social Media:</div>`;
            
            Object.entries(conflict).forEach(([platform, platformConflict]) => {
                const primarySourceName = getSourceDisplayName(platformConflict.primary.source, true);
                const secondarySourceName = getSourceDisplayName(platformConflict.secondary.source, false);
                
                html += `
                    <div class="mb-2 ml-4">
                        <div class="font-medium text-sm mb-1">${platform.charAt(0).toUpperCase() + platform.slice(1)}:</div>
                        <label class="flex items-center mb-1">
                            <input type="checkbox" id="conflict_social_${platform}_primary" class="mr-2">
                            <span class="text-blue-600 text-sm">${primarySourceName}:</span>
                            <span class="ml-2 text-sm">${platformConflict.primary.value}</span>
                        </label>
                        <label class="flex items-center">
                            <input type="checkbox" id="conflict_social_${platform}_secondary" class="mr-2">
                            <span class="text-green-600 text-sm">${secondarySourceName}:</span>
                            <span class="ml-2 text-sm">${platformConflict.secondary.value}</span>
                        </label>
                    </div>
                `;
            });
            html += `</div>`;
        } else if (field === 'coordinates') {
            // Handle coordinates conflict
            const primarySourceName = getSourceDisplayName(conflict.primary.source, true);
            const secondarySourceName = getSourceDisplayName(conflict.secondary.source, false);
            
            html += `
                <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div class="font-semibold mb-2">Coordinates:</div>
                    <label class="flex items-center mb-2">
                        <input type="checkbox" id="conflict_${field}_primary" class="mr-2">
                        <span class="text-blue-600 text-sm">${primarySourceName}:</span>
                        <span class="ml-2 text-sm">${conflict.primary.value.latitude}, ${conflict.primary.value.longitude}</span>
                    </label>
                    <label class="flex items-center">
                        <input type="checkbox" id="conflict_${field}_secondary" class="mr-2">
                        <span class="text-green-600 text-sm">${secondarySourceName}:</span>
                        <span class="ml-2 text-sm">${conflict.secondary.value.latitude}, ${conflict.secondary.value.longitude}</span>
                    </label>
                </div>
            `;
        } else {
            // Handle regular field conflicts
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
            const primarySourceName = getSourceDisplayName(conflict.primary.source, true);
            const secondarySourceName = getSourceDisplayName(conflict.secondary.source, false);
            
            html += `
                <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div class="font-semibold mb-2">${fieldName}:</div>
                    <label class="flex items-center mb-2">
                        <input type="checkbox" id="conflict_${field}_primary" class="mr-2">
                        <span class="text-blue-600 text-sm">${primarySourceName}:</span>
                        <span class="ml-2 text-sm">${conflict.primary.value}</span>
                    </label>
                    <label class="flex items-center">
                        <input type="checkbox" id="conflict_${field}_secondary" class="mr-2">
                        <span class="text-green-600 text-sm">${secondarySourceName}:</span>
                        <span class="ml-2 text-sm">${conflict.secondary.value}</span>
                    </label>
                </div>
            `;
        }
    });
    
    html += `
        <div class="mt-4 flex space-x-2">
            <button onclick="resolveConflicts()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <i class="fas fa-check mr-2"></i>Apply Selected Values
            </button>
            <button onclick="cancelConflictResolution()" class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors">
                <i class="fas fa-times mr-2"></i>Cancel
            </button>
        </div>
    `;
    
    content.innerHTML = html;
    console.log('Conflict resolution HTML set:', html.substring(0, 200) + '...');
    preview.classList.remove('hidden');
    preview.style.display = 'block'; // Force display in case of CSS issues
    console.log('Conflict resolution preview shown');
}

function resolveConflicts() {
    if (!currentConflictData) return;
    
    const resolvedData = { ...currentConflictData.mergedData };
    
    // Resolve each conflict based on user selection
    Object.entries(currentConflictData.conflicts).forEach(([field, conflict]) => {
        if (field === 'socialMedia') {
            resolvedData.socialMedia = resolvedData.socialMedia || {};
            Object.keys(conflict).forEach(platform => {
                const primaryBox = document.getElementById(`conflict_social_${platform}_primary`);
                const secondaryBox = document.getElementById(`conflict_social_${platform}_secondary`);
                if (primaryBox?.checked) {
                    resolvedData.socialMedia[platform] = conflict[platform].primary.value;
                } else if (secondaryBox?.checked) {
                    resolvedData.socialMedia[platform] = conflict[platform].secondary.value;
                }
            });
        } else {
            const primaryBox = document.getElementById(`conflict_${field}_primary`);
            const secondaryBox = document.getElementById(`conflict_${field}_secondary`);
            if (primaryBox?.checked) {
                resolvedData[field] = conflict.primary.value;
            } else if (secondaryBox?.checked) {
                resolvedData[field] = conflict.secondary.value;
            }
        }
    });
    
    // Create final result object
    const sources = [];
    if (currentConflictData.primaryResult.source) sources.push(currentConflictData.primaryResult.source);
    if (currentConflictData.secondaryResult.source) sources.push(currentConflictData.secondaryResult.source);
    
    const finalResult = {
        success: true,
        data: resolvedData,
        source: sources.join(' + '),
        merged: true,
        resolved: true
    };
    
    // Display the resolved data
    displayScrapedData(finalResult);
    currentConflictData = null;
}

function cancelConflictResolution() {
    const preview = document.getElementById('scraped-data-preview');
    if (preview) {
        preview.classList.add('hidden');
    }
    currentConflictData = null;
}

// Form utilities
function resetForm() {
    if (originalStationData) {
        populateStationEditor(originalStationData);
        showSuccess('Form reset to original values');
    }
}

function validateStationForm() {
    const errors = [];
    
    const name = document.getElementById('edit-name').value.trim();
    if (!name) errors.push('Station name is required');
    
    const streamUrl = document.getElementById('edit-stream-url').value.trim();
    if (!streamUrl) errors.push('Stream URL is required');
    
    // Validate stream URL format
    if (streamUrl) {
        try {
            new URL(streamUrl);
        } catch (e) {
            errors.push('Stream URL must be a valid URL');
        }
    }
    
    // Validate optional URLs
    const urlFields = ['homepage', 'facebook', 'twitter', 'instagram', 'youtube'];
    urlFields.forEach(field => {
        const element = document.getElementById(`edit-${field}`);
        const value = element?.value?.trim();
        if (value) {
            try {
                new URL(value);
            } catch (e) {
                errors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} URL must be a valid URL`);
            }
        }
    });
    
    // Validate email
    const email = document.getElementById('edit-email').value.trim();
    if (email && !validateEmail(email, 'Email')) {
        errors.push('Email must be a valid email address');
    }
    
    // Validate coordinates
    const latitude = document.getElementById('edit-latitude').value;
    const longitude = document.getElementById('edit-longitude').value;
    
    if (latitude && (isNaN(latitude) || latitude < -90 || latitude > 90)) {
        errors.push('Latitude must be a number between -90 and 90');
    }
    
    if (longitude && (isNaN(longitude) || longitude < -180 || longitude > 180)) {
        errors.push('Longitude must be a number between -180 and 180');
    }
    
    return errors;
}

// Auto-save functionality
let autoSaveTimeout;
function enableAutoSave() {
    const formInputs = document.querySelectorAll('#station-editor input, #station-editor textarea, #station-editor select');
    
    formInputs.forEach(input => {
        input.addEventListener('input', () => {
            clearTimeout(autoSaveTimeout);
            autoSaveTimeout = setTimeout(() => {
                // Visual indicator that changes are pending
                const saveButton = document.querySelector('#save-station');
                if (saveButton) {
                    saveButton.classList.add('bg-yellow-600', 'hover:bg-yellow-700');
                    saveButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
                    saveButton.textContent = 'Save Changes';
                }
            }, 1000);
        });
    });
}

function closeStationEditor() {
    // Reset manual mode if it was set
    if (window.manualMode) {
        window.manualMode = false;
    }
    
    // Clear current editing station
    currentEditingStation = null;
    originalStationData = null;
    
    // Hide the modal
    const modal = document.getElementById('station-editor-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    
    console.log('📝 Station editor closed');
}