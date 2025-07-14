/**
 * Station Editor - Scraping Module  
 * Handles web scraping, data merging, and conflict resolution
 */

export class ScrapingManager {
    constructor() {
        this.currentScrapedData = null;
        this.currentConflictData = null;
    }

    // Main scraping function
    async autoScrapeData() {
        let primaryUrl = document.getElementById('scraper-url').value.trim();
        let secondaryUrl = null;
        
        // Get current editing station from shared state
        const currentEditingStation = window.StationEditorCore?.currentEditingStation;
        
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
            const mergedData = this.mergeScrapedData(primaryData, secondaryData);
            console.log('Merged data result:', mergedData);
            
            // Check if scraping was successful
            if (!mergedData || !mergedData.success) {
                console.log('Scraping failed for both URLs');
                this.displayScrapedData(null);
            } else {
                this.displayScrapedData(mergedData);
            }
            
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

    mergeScrapedData(primaryResult, secondaryResult) {
        // If only one result is successful, return it
        if (!primaryResult || !primaryResult.success) {
            return secondaryResult || { success: false, data: {}, source: 'Unknown' };
        }
        if (!secondaryResult || !secondaryResult.success) {
            return primaryResult || { success: false, data: {}, source: 'Unknown' };
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

    displayScrapedData(responseData) {
        console.log('displayScrapedData called with:', responseData);
        const preview = document.getElementById('scraped-data-preview');
        const content = document.getElementById('scraped-content');
        
        console.log('Preview element:', preview);
        console.log('Content element:', content);
        
        // Handle null or undefined responseData
        if (!responseData) {
            console.log('No response data available');
            if (content) {
                content.innerHTML = '<div class="text-center py-8 text-gray-500">No data could be scraped from the website.</div>';
            }
            if (preview) {
                preview.classList.remove('hidden');
                preview.style.display = 'block'; // Force display
            }
            return;
        }
        
        // Check if there are conflicts that need resolution
        if (responseData.hasConflicts) {
            console.log('Has conflicts, showing conflict resolution');
            this.displayConflictResolution(responseData);
            return;
        }
        
        // Extract data from the response structure
        const data = responseData.data || responseData;
        this.currentScrapedData = data;
        
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

    applyScrapedData() {
        if (!this.currentScrapedData) return;
        
        let appliedCount = 0;
        
        // Apply basic fields based on checkbox selection
        const basicFields = ['name', 'description', 'website', 'email', 'phone', 'address'];
        basicFields.forEach(field => {
            const checkbox = document.getElementById(`apply_${field}`);
            if (checkbox && checkbox.checked && this.currentScrapedData[field]) {
                const targetField = field === 'website' ? 'edit-homepage' : `edit-${field}`;
                const targetElement = document.getElementById(targetField);
                if (targetElement) {
                    targetElement.value = this.currentScrapedData[field];
                    appliedCount++;
                }
            }
        });
        
        // Apply coordinates
        const coordCheckbox = document.getElementById('apply_coordinates');
        if (coordCheckbox && coordCheckbox.checked && this.currentScrapedData.coordinates) {
            const latElement = document.getElementById('edit-latitude');
            const lngElement = document.getElementById('edit-longitude');
            if (latElement && lngElement) {
                latElement.value = this.currentScrapedData.coordinates.latitude;
                lngElement.value = this.currentScrapedData.coordinates.longitude;
                appliedCount++;
            }
        }
        
        // Apply social media
        if (this.currentScrapedData.socialMedia) {
            const socialFields = ['facebook', 'twitter', 'instagram', 'youtube'];
            socialFields.forEach(platform => {
                const checkbox = document.getElementById(`apply_social_${platform}`);
                if (checkbox && checkbox.checked && this.currentScrapedData.socialMedia[platform]) {
                    const targetElement = document.getElementById(`edit-${platform}`);
                    if (targetElement) {
                        targetElement.value = this.currentScrapedData.socialMedia[platform];
                        appliedCount++;
                    }
                }
            });
        }
        
        // Apply favicon/logo
        const faviconCheckbox = document.getElementById('apply_favicon');
        if (faviconCheckbox && faviconCheckbox.checked && this.currentScrapedData.favicon) {
            const faviconElement = document.getElementById('edit-favicon');
            if (faviconElement) {
                faviconElement.value = this.currentScrapedData.favicon;
                appliedCount++;
            }
        }
        
        const logoCheckbox = document.getElementById('apply_logo');
        if (logoCheckbox && logoCheckbox.checked && this.currentScrapedData.logo) {
            const logoElement = document.getElementById('edit-logo');
            if (logoElement) {
                logoElement.value = this.currentScrapedData.logo;
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

    clearScrapedData() {
        this.currentScrapedData = null;
        const scrapedDataPreview = document.getElementById('scraped-data-preview');
        if (scrapedDataPreview) {
            scrapedDataPreview.classList.add('hidden');
        }
        
        const scrapedContent = document.getElementById('scraped-content');
        if (scrapedContent) {
            scrapedContent.innerHTML = '';
        }
    }

    useHomepageUrl() {
        const currentEditingStation = window.StationEditorCore?.currentEditingStation;
        if (currentEditingStation && currentEditingStation.homepage) {
            document.getElementById('scraper-url').value = currentEditingStation.homepage;
        } else {
            alert('No homepage URL available for this station');
        }
    }

    testScrapingUrl() {
        const url = document.getElementById('scraper-url').value.trim();
        if (!url) {
            alert('Please enter a URL to test');
            return;
        }
        
        try {
            new URL(url);
            window.open(url, '_blank');
        } catch (e) {
            alert('Please enter a valid URL (include http:// or https://)');
        }
    }

    getSourceDisplayName(source, isPrimary) {
        if (!source) return isPrimary ? 'Primary Source' : 'Secondary Source';
        
        // Clean up source names for display
        const cleanSource = source.replace(/^https?:\/\//, '').replace(/\/$/, '');
        return isPrimary ? `Primary (${cleanSource})` : `Secondary (${cleanSource})`;
    }

    // Conflict resolution functions
    displayConflictResolution(conflictData) {
        const preview = document.getElementById('scraped-data-preview');
        const content = document.getElementById('scraped-content');
        
        let html = `
            <div class="mb-4">
                <div class="text-lg font-semibold text-orange-600 mb-2">
                    <i class="fas fa-exclamation-triangle mr-2"></i>Data Conflicts Found
                </div>
                <div class="text-sm text-gray-600 mb-4">
                    Multiple sources provided different information for some fields. Please choose which version to use:
                </div>
            </div>
        `;
        
        // Display conflicts
        Object.entries(conflictData.conflicts).forEach(([field, conflict]) => {
            html += `<div class="mb-4 p-4 border border-orange-200 rounded-lg bg-orange-50">`;
            html += `<div class="font-semibold text-sm mb-3">${field.charAt(0).toUpperCase() + field.slice(1)} Conflict:</div>`;
            
            if (field === 'coordinates') {
                // Handle coordinates specially
                html += `
                    <div class="space-y-2">
                        <label class="flex items-start">
                            <input type="radio" name="conflict_${field}" value="primary" checked class="mr-3 mt-1">
                            <div>
                                <div class="font-medium text-sm">${this.getSourceDisplayName(conflict.primary.source, true)}</div>
                                <div class="text-sm text-gray-700">${conflict.primary.value.latitude}, ${conflict.primary.value.longitude}</div>
                            </div>
                        </label>
                        <label class="flex items-start">
                            <input type="radio" name="conflict_${field}" value="secondary" class="mr-3 mt-1">
                            <div>
                                <div class="font-medium text-sm">${this.getSourceDisplayName(conflict.secondary.source, false)}</div>
                                <div class="text-sm text-gray-700">${conflict.secondary.value.latitude}, ${conflict.secondary.value.longitude}</div>
                            </div>
                        </label>
                    </div>
                `;
            } else if (field === 'socialMedia') {
                // Handle social media conflicts
                Object.entries(conflict).forEach(([platform, platformConflict]) => {
                    html += `
                        <div class="mb-3">
                            <div class="font-medium text-sm mb-2">${platform.charAt(0).toUpperCase() + platform.slice(1)}:</div>
                            <div class="space-y-2 ml-4">
                                <label class="flex items-start">
                                    <input type="radio" name="conflict_social_${platform}" value="primary" checked class="mr-3 mt-1">
                                    <div>
                                        <div class="font-medium text-sm">${this.getSourceDisplayName(platformConflict.primary.source, true)}</div>
                                        <div class="text-sm text-gray-700">${platformConflict.primary.value}</div>
                                    </div>
                                </label>
                                <label class="flex items-start">
                                    <input type="radio" name="conflict_social_${platform}" value="secondary" class="mr-3 mt-1">
                                    <div>
                                        <div class="font-medium text-sm">${this.getSourceDisplayName(platformConflict.secondary.source, false)}</div>
                                        <div class="text-sm text-gray-700">${platformConflict.secondary.value}</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    `;
                });
            } else {
                // Handle regular field conflicts
                html += `
                    <div class="space-y-2">
                        <label class="flex items-start">
                            <input type="radio" name="conflict_${field}" value="primary" checked class="mr-3 mt-1">
                            <div>
                                <div class="font-medium text-sm">${this.getSourceDisplayName(conflict.primary.source, true)}</div>
                                <div class="text-sm text-gray-700">${conflict.primary.value}</div>
                            </div>
                        </label>
                        <label class="flex items-start">
                            <input type="radio" name="conflict_${field}" value="secondary" class="mr-3 mt-1">
                            <div>
                                <div class="font-medium text-sm">${this.getSourceDisplayName(conflict.secondary.source, false)}</div>
                                <div class="text-sm text-gray-700">${conflict.secondary.value}</div>
                            </div>
                        </label>
                    </div>
                `;
            }
            
            html += '</div>';
        });
        
        // Add action buttons
        html += `
            <div class="flex space-x-3 mt-6">
                <button onclick="scrapingManager.resolveConflicts()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-check mr-2"></i>Resolve Conflicts
                </button>
                <button onclick="scrapingManager.cancelConflictResolution()" class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100">
                    <i class="fas fa-times mr-2"></i>Cancel
                </button>
            </div>
        `;
        
        content.innerHTML = html;
        preview.classList.remove('hidden');
        preview.style.display = 'block';
        
        // Store conflict data for resolution
        this.currentConflictData = conflictData;
    }

    resolveConflicts() {
        if (!this.currentConflictData) return;
        
        const resolvedData = { ...this.currentConflictData.mergedData };
        
        // Resolve each conflict based on user selection
        Object.entries(this.currentConflictData.conflicts).forEach(([field, conflict]) => {
            if (field === 'coordinates') {
                const selected = document.querySelector(`input[name="conflict_${field}"]:checked`);
                if (selected) {
                    resolvedData.coordinates = selected.value === 'primary' ? 
                        conflict.primary.value : conflict.secondary.value;
                }
            } else if (field === 'socialMedia') {
                if (!resolvedData.socialMedia) resolvedData.socialMedia = {};
                Object.entries(conflict).forEach(([platform, platformConflict]) => {
                    const selected = document.querySelector(`input[name="conflict_social_${platform}"]:checked`);
                    if (selected) {
                        resolvedData.socialMedia[platform] = selected.value === 'primary' ?
                            platformConflict.primary.value : platformConflict.secondary.value;
                    }
                });
            } else {
                const selected = document.querySelector(`input[name="conflict_${field}"]:checked`);
                if (selected) {
                    resolvedData[field] = selected.value === 'primary' ?
                        conflict.primary.value : conflict.secondary.value;
                }
            }
        });
        
        // Create resolved response data
        const resolvedResponse = {
            success: true,
            data: resolvedData,
            source: `${this.currentConflictData.primaryResult.source} + ${this.currentConflictData.secondaryResult.source} (conflicts resolved)`,
            merged: true,
            resolved: true
        };
        
        // Display the resolved data
        this.displayScrapedData(resolvedResponse);
        
        // Clean up
        this.currentConflictData = null;
    }

    cancelConflictResolution() {
        // Hide the conflict resolution UI
        const scrapedDataPreview = document.getElementById('scraped-data-preview');
        if (scrapedDataPreview) {
            scrapedDataPreview.classList.add('hidden');
        }
        
        // Clean up
        this.currentConflictData = null;
    }
}