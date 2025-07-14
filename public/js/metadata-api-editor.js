// Metadata API Editor Module
// Handles metadata API configuration, testing, and discovery

let currentMetadataStation = null;
let metadataApiModalLoaded = false;

// Main function to open the metadata API editor
async function openMetadataApiEditor(station) {
    console.log('Opening metadata API editor for station:', station.id);
    
    // Ensure the modal is loaded
    await ensureMetadataApiModalLoaded();
    
    currentMetadataStation = station;
    
    // Update header
    document.getElementById('metadata-editor-station-name').textContent = 
        `Configure metadata for "${station.name}" (ID: ${station.id})`;
    
    // Load current metadata configuration
    loadCurrentMetadataConfig(station);
    
    // Show the modal
    const modal = document.getElementById('metadata-api-editor-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

// Ensure the metadata API modal is loaded
async function ensureMetadataApiModalLoaded() {
    if (metadataApiModalLoaded || document.getElementById('metadata-api-editor-modal')) {
        return true;
    }
    
    try {
        console.log('🔄 Loading metadata API editor modal...');
        const response = await fetch('/components/metadata-api-editor.html');
        
        if (!response.ok) {
            throw new Error(`Failed to load metadata API modal: ${response.status}`);
        }
        
        const modalHTML = await response.text();
        console.log(`📄 Metadata API modal HTML loaded: ${modalHTML.length} characters`);
        
        // Create container and append to body
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = modalHTML;
        const modalElement = tempContainer.firstElementChild;
        
        if (!modalElement) {
            throw new Error('No metadata API modal element found in HTML');
        }
        
        document.body.appendChild(modalElement.cloneNode(true));
        
        // Small delay to ensure DOM is updated
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Verify modal was loaded
        const insertedModal = document.getElementById('metadata-api-editor-modal');
        if (!insertedModal) {
            throw new Error('Metadata API modal element not found after loading');
        }
        
        metadataApiModalLoaded = true;
        console.log('✅ Metadata API editor modal loaded successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Error loading metadata API editor modal:', error);
        alert('Failed to load metadata API editor: ' + error.message);
        return false;
    }
}

// Load current metadata configuration into the form
function loadCurrentMetadataConfig(station) {
    document.getElementById('metadata-api-url').value = station.metadataApiUrl || '';
    document.getElementById('metadata-api-type').value = station.metadataApiType || '';
    document.getElementById('metadata-response-format').value = station.metadataFormat || '';
    
    // Load metadata fields (JSON string)
    if (station.metadataFields) {
        try {
            const fields = typeof station.metadataFields === 'string' 
                ? JSON.parse(station.metadataFields) 
                : station.metadataFields;
            document.getElementById('metadata-field-mapping').value = JSON.stringify(fields, null, 2);
        } catch (error) {
            document.getElementById('metadata-field-mapping').value = station.metadataFields || '';
        }
    } else {
        document.getElementById('metadata-field-mapping').value = '';
    }
    
    // Add event listener for metadata type changes
    const metadataTypeSelect = document.getElementById('metadata-api-type');
    if (metadataTypeSelect && !metadataTypeSelect.hasAttribute('data-listener-added')) {
        metadataTypeSelect.addEventListener('change', function() {
            if (this.value === 'rogers-auto') {
                document.getElementById('metadata-api-url').value = 'automatic';
                document.getElementById('metadata-response-format').value = 'auto';
            }
        });
        metadataTypeSelect.setAttribute('data-listener-added', 'true');
    }
}

// Test the metadata API URL
async function testMetadataApiUrl() {
    const url = document.getElementById('metadata-api-url').value;
    const format = document.getElementById('metadata-response-format').value;
    const metadataType = document.getElementById('metadata-api-type').value;
    const resultsDiv = document.getElementById('metadata-api-test-results');
    const contentDiv = document.getElementById('metadata-api-test-content');
    
    // Special handling for rogers-auto
    if (metadataType === 'rogers-auto') {
        if (!currentMetadataStation || !currentMetadataStation.id) {
            alert('Please save the station first to test Rogers Auto mode');
            return;
        }
        
        try {
            resultsDiv.classList.remove('hidden');
            contentDiv.innerHTML = '<div class="text-sm text-gray-600">Testing Rogers Auto mapping...</div>';
            
            const response = await fetch('/admin/test-metadata-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    format: 'rogers-auto', 
                    stationId: currentMetadataStation.id 
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                contentDiv.innerHTML = `
                    <div class="text-sm text-green-600 mb-2">✅ Rogers Auto Success!</div>
                    <div class="text-xs text-gray-600">
                        <strong>Title:</strong> ${result.metadata.title || 'N/A'}<br>
                        <strong>Artist:</strong> ${result.metadata.artist || 'N/A'}<br>
                        <strong>Source:</strong> ${result.metadata.source || 'N/A'}<br>
                        ${result.metadata.rogersData ? `<strong>Call Letters:</strong> ${result.metadata.rogersData.callLetters}<br>` : ''}
                        ${result.metadata.rogersData ? `<strong>Station:</strong> ${result.metadata.rogersData.stationName}<br>` : ''}
                        ${result.metadata.rogersData ? `<strong>Cache Age:</strong> ${result.metadata.rogersData.cacheAge}s<br>` : ''}
                    </div>
                `;
            } else {
                contentDiv.innerHTML = `
                    <div class="text-sm text-red-600 mb-2">❌ Rogers Auto Failed</div>
                    <div class="text-xs text-gray-600">
                        Check if station ID ${currentMetadataStation.id} is mapped in rogers-stations.json<br>
                        Error: ${result.error || 'Unknown error'}
                    </div>
                `;
            }
            return;
        } catch (error) {
            contentDiv.innerHTML = `
                <div class="text-sm text-red-600 mb-2">❌ Rogers Auto Error</div>
                <div class="text-xs text-gray-600">
                    Error: ${error.message}<br>
                    Make sure the metadata server is running on port 3002
                </div>
            `;
            return;
        }
    }
    
    if (!url) {
        alert('Please enter a metadata URL to test');
        return;
    }
    
    try {
        resultsDiv.classList.remove('hidden');
        contentDiv.innerHTML = '<div class="text-sm text-gray-600">Testing URL...</div>';
        
        const response = await fetch('/admin/test-metadata-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, format })
        });
        
        const result = await response.json();
        
        if (result.success) {
            contentDiv.innerHTML = `
                <div class="text-sm text-green-600 mb-2">✅ Success!</div>
                <div class="text-xs text-gray-600">
                    <strong>Title:</strong> ${result.metadata.title || 'N/A'}<br>
                    <strong>Artist:</strong> ${result.metadata.artist || 'N/A'}<br>
                    <strong>Song:</strong> ${result.metadata.song || 'N/A'}<br>
                    ${result.metadata.artwork ? `<strong>Artwork:</strong> <a href="${result.metadata.artwork}" target="_blank" class="text-blue-600 hover:underline">View</a><br>` : ''}
                </div>
            `;
        } else {
            contentDiv.innerHTML = `<div class="text-sm text-red-600">❌ Error: ${result.error}</div>`;
        }
    } catch (error) {
        contentDiv.innerHTML = `<div class="text-sm text-red-600">❌ Test failed: ${error.message}</div>`;
    }
}

// Auto-discover metadata URLs
async function discoverMetadataApiUrls() {
    const streamUrl = currentMetadataStation?.streamUrl;
    const resultsDiv = document.getElementById('metadata-api-test-results');
    const contentDiv = document.getElementById('metadata-api-test-content');
    const discoveredSection = document.getElementById('discovered-urls-section');
    const discoveredList = document.getElementById('discovered-urls-list');
    
    if (!streamUrl) {
        alert('Please enter a stream URL first');
        return;
    }
    
    try {
        resultsDiv.classList.remove('hidden');
        contentDiv.innerHTML = '<div class="text-sm text-gray-600">Discovering metadata URLs...</div>';
        
        const response = await fetch('/admin/discover-metadata-urls', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ streamUrl })
        });
        
        const result = await response.json();
        
        if (result.success && result.urls && result.urls.length > 0) {
            contentDiv.innerHTML = `<div class="text-sm text-green-600 mb-2">✅ Found ${result.urls.length} URLs!</div>`;
            
            // Show discovered URLs section
            discoveredSection.classList.remove('hidden');
            discoveredList.innerHTML = '';
            
            result.urls.forEach((url, index) => {
                const urlDiv = document.createElement('div');
                urlDiv.className = 'flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg';
                urlDiv.innerHTML = `
                    <div class="flex-1">
                        <div class="text-sm font-medium text-gray-900 break-all">${url}</div>
                        <div class="text-xs text-gray-500">${detectUrlType(url)}</div>
                    </div>
                    <button onclick="applyDiscoveredUrl('${url.replace(/'/g, "\\'")}')" class="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">
                        <i class="fas fa-check mr-1"></i>Use This
                    </button>
                `;
                discoveredList.appendChild(urlDiv);
            });
        } else {
            contentDiv.innerHTML = '<div class="text-sm text-yellow-600">⚠️ No metadata URLs discovered</div>';
            discoveredSection.classList.add('hidden');
        }
    } catch (error) {
        contentDiv.innerHTML = `<div class="text-sm text-red-600">❌ Discovery failed: ${error.message}</div>`;
        discoveredSection.classList.add('hidden');
    }
}

// Detect URL type for display
function detectUrlType(url) {
    if (url.includes('socast-public.s3.amazonaws.com')) return 'SoCast (JSONP)';
    if (url.includes('radio.rogersdigitalmedia.com')) return 'Rogers (JSON)';
    if (url.includes('radio.co')) return 'Radio.co (JSON)';
    if (url.includes('laut.fm')) return 'Laut.fm (JSON)';
    if (url.includes('status-json.xsl')) return 'Icecast (JSON)';
    if (url.includes('status.xml')) return 'Icecast (XML)';
    if (url.includes('admin.cgi')) return 'Shoutcast (XML)';
    return 'Custom API';
}

// Apply a discovered URL
function applyDiscoveredUrl(url) {
    document.getElementById('metadata-api-url').value = url;
    
    // Auto-detect the type based on URL
    if (url.includes('socast-public.s3.amazonaws.com')) {
        document.getElementById('metadata-api-type').value = 'socast';
        document.getElementById('metadata-response-format').value = 'jsonp';
    } else if (url.includes('radio.rogersdigitalmedia.com')) {
        document.getElementById('metadata-api-type').value = 'rogers-auto';
        document.getElementById('metadata-response-format').value = 'auto';
    } else if (url.includes('radio.co')) {
        document.getElementById('metadata-api-type').value = 'radio-co';
        document.getElementById('metadata-response-format').value = 'json';
    } else if (url.includes('laut.fm')) {
        document.getElementById('metadata-api-type').value = 'laut-fm';
        document.getElementById('metadata-response-format').value = 'json';
    } else if (url.includes('status-json.xsl')) {
        document.getElementById('metadata-api-type').value = 'icecast-json';
        document.getElementById('metadata-response-format').value = 'json';
    } else if (url.includes('status.xml')) {
        document.getElementById('metadata-api-type').value = 'icecast-xml';
        document.getElementById('metadata-response-format').value = 'xml';
    } else if (url.includes('admin.cgi')) {
        document.getElementById('metadata-api-type').value = 'shoutcast';
        document.getElementById('metadata-response-format').value = 'xml';
    } else {
        document.getElementById('metadata-api-type').value = 'custom-api';
        document.getElementById('metadata-response-format').value = 'json';
    }
    
    alert('Metadata URL applied! Click "Test API URL" to verify it works.');
}

// Open the metadata discovery tool
function openMetadataDiscoveryTool() {
    const streamUrl = currentMetadataStation?.streamUrl;
    if (streamUrl) {
        window.open(`http://localhost:3002/admin.html?url=${encodeURIComponent(streamUrl)}`, '_blank');
    } else {
        window.open('http://localhost:3002/admin.html', '_blank');
    }
}

// Apply template configurations
function applyTemplate(templateType) {
    switch (templateType) {
        case 'socast':
            document.getElementById('metadata-api-url').value = '';
            document.getElementById('metadata-api-type').value = 'socast';
            document.getElementById('metadata-response-format').value = 'jsonp';
            document.getElementById('metadata-field-mapping').value = '';
            break;
        case 'rogers':
            document.getElementById('metadata-api-url').value = 'automatic';
            document.getElementById('metadata-api-type').value = 'rogers-auto';
            document.getElementById('metadata-response-format').value = 'auto';
            document.getElementById('metadata-field-mapping').value = '';
            break;
        case 'radio-co':
            document.getElementById('metadata-api-url').value = '';
            document.getElementById('metadata-api-type').value = 'radio-co';
            document.getElementById('metadata-response-format').value = 'json';
            document.getElementById('metadata-field-mapping').value = JSON.stringify({
                "title": "title",
                "artist": "artist"
            }, null, 2);
            break;
        case 'icecast-json':
            document.getElementById('metadata-api-url').value = '';
            document.getElementById('metadata-api-type').value = 'icecast-json';
            document.getElementById('metadata-response-format').value = 'json';
            document.getElementById('metadata-field-mapping').value = '';
            break;
        case 'icecast-xml':
            document.getElementById('metadata-api-url').value = '';
            document.getElementById('metadata-api-type').value = 'icecast-xml';
            document.getElementById('metadata-response-format').value = 'xml';
            document.getElementById('metadata-field-mapping').value = '';
            break;
        case 'custom':
            document.getElementById('metadata-api-url').value = '';
            document.getElementById('metadata-api-type').value = 'custom-api';
            document.getElementById('metadata-response-format').value = 'json';
            document.getElementById('metadata-field-mapping').value = JSON.stringify({
                "title": "now_playing.title",
                "artist": "now_playing.artist",
                "album": "now_playing.album"
            }, null, 2);
            break;
    }
    
    alert(`Applied ${templateType} template. Modify the URL and test to verify it works.`);
}

// Reset metadata API configuration
function resetMetadataApiConfig() {
    if (confirm('Are you sure you want to reset the metadata configuration? This will clear all current settings.')) {
        document.getElementById('metadata-api-url').value = '';
        document.getElementById('metadata-api-type').value = '';
        document.getElementById('metadata-response-format').value = '';
        document.getElementById('metadata-field-mapping').value = '';
        
        // Hide test results
        document.getElementById('metadata-api-test-results').classList.add('hidden');
        document.getElementById('discovered-urls-section').classList.add('hidden');
    }
}

// Save and close the metadata API editor
function saveAndCloseMetadataApiEditor() {
    // Collect metadata configuration
    const metadataConfig = {
        metadataApiUrl: document.getElementById('metadata-api-url').value.trim() || null,
        metadataApiType: document.getElementById('metadata-api-type').value.trim() || null,
        metadataFormat: document.getElementById('metadata-response-format').value.trim() || null,
        metadataFields: document.getElementById('metadata-field-mapping').value.trim() || null
    };
    
    // Update the current station if we're editing from station editor
    if (currentMetadataStation && typeof currentEditingStation !== 'undefined' && currentEditingStation) {
        Object.assign(currentEditingStation, metadataConfig);
        
        // Update the main station editor form if it exists
        const mainEditor = document.getElementById('edit-metadata-url');
        if (mainEditor) {
            mainEditor.value = metadataConfig.metadataApiUrl || '';
        }
    }
    
    console.log('💾 Metadata API configuration saved:', metadataConfig);
    closeMetadataApiEditor();
}

// Close the metadata API editor
function closeMetadataApiEditor() {
    const modal = document.getElementById('metadata-api-editor-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
    
    // Clear test results
    document.getElementById('metadata-api-test-results').classList.add('hidden');
    document.getElementById('discovered-urls-section').classList.add('hidden');
    
    currentMetadataStation = null;
    console.log('📝 Metadata API editor closed');
}