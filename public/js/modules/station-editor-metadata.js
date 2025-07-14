/**
 * Station Editor - Metadata Module
 * Handles metadata API configuration, testing, and discovery
 */

export class MetadataManager {
    constructor() {
        // No persistent state needed for this module
    }

    // Load metadata configuration for a station
    loadMetadataConfig(station) {
        document.getElementById('edit-metadata-url').value = station.metadataApiUrl || '';
        document.getElementById('edit-metadata-type').value = station.metadataApiType || '';
        document.getElementById('edit-metadata-format').value = station.metadataFormat || '';
        
        // Load metadata fields (JSON string)
        if (station.metadataFields) {
            try {
                const fields = typeof station.metadataFields === 'string' 
                    ? JSON.parse(station.metadataFields) 
                    : station.metadataFields;
                document.getElementById('edit-metadata-fields').value = JSON.stringify(fields, null, 2);
            } catch (error) {
                document.getElementById('edit-metadata-fields').value = station.metadataFields || '';
            }
        } else {
            document.getElementById('edit-metadata-fields').value = '';
        }
        
        // Add event listener for metadata type changes
        const metadataTypeSelect = document.getElementById('edit-metadata-type');
        if (metadataTypeSelect && !metadataTypeSelect.hasAttribute('data-listener-added')) {
            metadataTypeSelect.addEventListener('change', function() {
                if (this.value === 'rogers-auto') {
                    document.getElementById('edit-metadata-url').value = 'automatic';
                    document.getElementById('edit-metadata-format').value = 'auto';
                }
            });
            metadataTypeSelect.setAttribute('data-listener-added', 'true');
        }
    }

    // Test metadata URL functionality
    async testMetadataUrl() {
        const url = document.getElementById('edit-metadata-url').value;
        const format = document.getElementById('edit-metadata-format').value;
        const metadataType = document.getElementById('edit-metadata-type').value;
        const resultsDiv = document.getElementById('metadata-test-results');
        const contentDiv = document.getElementById('metadata-test-content');
        
        if (!url && metadataType !== 'rogers-auto') {
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
                        <strong>Song:</strong> ${result.metadata.song || 'N/A'}
                    </div>
                `;
            } else {
                contentDiv.innerHTML = `<div class="text-sm text-red-600">❌ Error: ${result.error}</div>`;
            }
        } catch (error) {
            contentDiv.innerHTML = `<div class="text-sm text-red-600">❌ Test failed: ${error.message}</div>`;
        }
    }

    // Discover metadata URLs automatically
    async discoverMetadataUrls() {
        const streamUrl = document.getElementById('edit-stream-url').value;
        const resultsDiv = document.getElementById('metadata-test-results');
        const contentDiv = document.getElementById('metadata-test-content');
        
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
                let html = '<div class="text-sm text-green-600 mb-2">✅ Found URLs:</div>';
                result.urls.forEach(url => {
                    html += `
                        <div class="text-xs mb-1">
                            <button onclick="metadataManager.applyMetadataUrl('${url}')" class="text-blue-600 hover:underline text-left">
                                ${url}
                            </button>
                        </div>
                    `;
                });
                contentDiv.innerHTML = html;
            } else {
                contentDiv.innerHTML = '<div class="text-sm text-yellow-600">⚠️ No metadata URLs discovered</div>';
            }
        } catch (error) {
            contentDiv.innerHTML = `<div class="text-sm text-red-600">❌ Discovery failed: ${error.message}</div>`;
        }
    }

    // Apply discovered metadata URL with auto-detection
    applyMetadataUrl(url) {
        document.getElementById('edit-metadata-url').value = url;
        
        // Try to auto-detect the type based on URL patterns
        if (url.includes('socast-public.s3.amazonaws.com')) {
            document.getElementById('edit-metadata-type').value = 'socast';
            document.getElementById('edit-metadata-format').value = 'jsonp';
        } else if (url.includes('radio.rogersdigitalmedia.com')) {
            document.getElementById('edit-metadata-type').value = 'rogers-auto';
            document.getElementById('edit-metadata-format').value = 'auto';
        } else if (url.includes('radio.co')) {
            document.getElementById('edit-metadata-type').value = 'radio-co';
            document.getElementById('edit-metadata-format').value = 'json';
        } else if (url.includes('laut.fm')) {
            document.getElementById('edit-metadata-type').value = 'laut-fm';
            document.getElementById('edit-metadata-format').value = 'json';
        } else if (url.includes('status-json.xsl')) {
            document.getElementById('edit-metadata-type').value = 'icecast-json';
            document.getElementById('edit-metadata-format').value = 'json';
        } else if (url.includes('status.xml')) {
            document.getElementById('edit-metadata-type').value = 'icecast-xml';
            document.getElementById('edit-metadata-format').value = 'xml';
        } else if (url.includes('admin.cgi')) {
            document.getElementById('edit-metadata-type').value = 'shoutcast';
            document.getElementById('edit-metadata-format').value = 'xml';
        } else {
            document.getElementById('edit-metadata-type').value = 'custom-api';
            document.getElementById('edit-metadata-format').value = 'json';
        }
        
        alert('Metadata URL applied! Click "Test URL" to verify it works.');
    }

    // Get metadata configuration from form
    getMetadataConfig() {
        const url = document.getElementById('edit-metadata-url').value.trim();
        const type = document.getElementById('edit-metadata-type').value.trim();
        const format = document.getElementById('edit-metadata-format').value.trim();
        const fields = document.getElementById('edit-metadata-fields').value.trim();
        
        return {
            metadataApiUrl: url || null,
            metadataApiType: type || null,
            metadataFormat: format || null,
            metadataFields: fields || null
        };
    }

    // Validate metadata configuration
    validateMetadataConfig() {
        const config = this.getMetadataConfig();
        const errors = [];
        
        // If URL is provided, type and format should also be provided
        if (config.metadataApiUrl && config.metadataApiUrl !== 'automatic') {
            if (!config.metadataApiType) {
                errors.push('Metadata type is required when URL is specified');
            }
            if (!config.metadataFormat) {
                errors.push('Metadata format is required when URL is specified');
            }
            
            // Validate URL format
            try {
                new URL(config.metadataApiUrl);
            } catch (e) {
                errors.push('Metadata URL must be a valid URL');
            }
        }
        
        // Validate JSON fields if provided
        if (config.metadataFields) {
            try {
                JSON.parse(config.metadataFields);
            } catch (e) {
                errors.push('Metadata fields must be valid JSON');
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            config: config
        };
    }

    // Clear metadata test results
    clearMetadataTestResults() {
        const resultsDiv = document.getElementById('metadata-test-results');
        const contentDiv = document.getElementById('metadata-test-content');
        
        if (resultsDiv) {
            resultsDiv.classList.add('hidden');
        }
        if (contentDiv) {
            contentDiv.innerHTML = '';
        }
    }
}