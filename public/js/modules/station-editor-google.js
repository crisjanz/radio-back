/**
 * Station Editor - Google Business Module
 * Handles Google Maps/Business search functionality
 */

export class GoogleBusinessManager {
    constructor() {
        // No persistent state needed for this module
    }

    // Find Google Business/Maps entry for station
    findGoogleBusiness() {
        // Get station info for search
        const stationName = document.getElementById('edit-name').value.trim();
        const city = document.getElementById('edit-city').value.trim();
        const country = document.getElementById('edit-country').value.trim();
        
        if (!stationName) {
            alert('Please enter a station name before searching');
            return;
        }
        
        // Build Google Maps search query with improved location handling
        let searchQuery = `${stationName} radio station`;
        
        if (city && country) {
            searchQuery += ` ${city}, ${country}`;
        } else if (country) {
            searchQuery += ` ${country}`;
        } else if (city) {
            searchQuery += ` ${city}`;
        }
        
        const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        
        console.log(`🗺️ Opening Google Maps search for: ${searchQuery}`);
        
        // Open Google Maps search in a reasonably sized popup window
        const popup = window.open(
            googleMapsUrl,
            'GoogleMapsSearch',
            'width=1200,height=800,scrollbars=yes,resizable=yes,location=yes,menubar=no,toolbar=yes,status=no'
        );
        
        if (!popup) {
            alert('Popup blocked! Please allow popups for this site or manually search Google Maps for:\\n\\n' + searchQuery);
            return;
        }
        
        // Show helpful instructions
        this.showGoogleSearchInstructions(stationName);
    }

    // Show instructions for Google Maps search
    showGoogleSearchInstructions(stationName) {
        const instructionsDiv = document.getElementById('google-search-instructions');
        if (!instructionsDiv) return;
        
        instructionsDiv.innerHTML = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <div class="flex items-start">
                    <i class="fas fa-map-marker-alt text-green-600 mr-2 mt-1"></i>
                    <div class="text-sm text-green-800">
                        <div class="font-medium mb-1">Google Maps opened for "${stationName}"</div>
                        <div class="space-y-1">
                            <div>1. Look through the radio station results</div>
                            <div>2. Click the station you want</div>
                            <div>3. Copy the URL from the address bar (maps.google.com/...)</div>
                            <div>4. Close the Google Maps tab</div>
                            <div>5. Paste the URL in the "Website/Google Maps URL" field below</div>
                            <div>6. Click "Auto-Scrape" to extract information</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        instructionsDiv.classList.remove('hidden');
        
        // Auto-hide instructions after 15 seconds
        setTimeout(() => {
            if (instructionsDiv) {
                instructionsDiv.classList.add('hidden');
            }
        }, 15000);
    }

    // Clear Google search instructions and results
    clearGoogleBusinessResults() {
        // Clear any instructions from the Google search
        const instructionsDiv = document.getElementById('google-search-instructions');
        if (instructionsDiv) {
            instructionsDiv.classList.add('hidden');
            instructionsDiv.innerHTML = '';
        }
    }

    // Build search query for Google Maps
    buildGoogleSearchQuery(stationName, city, country) {
        let searchQuery = `${stationName} radio station`;
        
        if (city && country) {
            searchQuery += ` ${city}, ${country}`;
        } else if (country) {
            searchQuery += ` ${country}`;
        } else if (city) {
            searchQuery += ` ${city}`;
        }
        
        return searchQuery;
    }

    // Open Google Maps with custom query
    openGoogleMapsSearch(customQuery) {
        const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(customQuery)}`;
        
        const popup = window.open(
            googleMapsUrl,
            'GoogleMapsSearch',
            'width=1200,height=800,scrollbars=yes,resizable=yes,location=yes,menubar=no,toolbar=yes,status=no'
        );
        
        if (!popup) {
            alert('Popup blocked! Please allow popups for this site or manually search Google Maps for:\\n\\n' + customQuery);
            return false;
        }
        
        return true;
    }

    // Get Google Maps URL from clipboard (future functionality)
    async getGoogleMapsFromClipboard() {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                if (text.includes('maps.google.com') || text.includes('google.com/maps')) {
                    return text;
                }
            }
        } catch (error) {
            console.log('Could not read from clipboard:', error);
        }
        return null;
    }

    // Validate Google Maps URL
    isValidGoogleMapsUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.includes('google.com') && 
                   (url.includes('/maps') || url.includes('maps.google.com'));
        } catch (e) {
            return false;
        }
    }

    // Extract place ID from Google Maps URL (future functionality)
    extractPlaceIdFromMapsUrl(url) {
        const placeIdMatch = url.match(/place\/[^\/]+\/data=.*?0x[a-f0-9]+:0x[a-f0-9]+/);
        if (placeIdMatch) {
            return placeIdMatch[0];
        }
        return null;
    }
}