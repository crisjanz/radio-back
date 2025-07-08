// UI Rendering Module
// Handles DOM manipulation, station rows, forms, and visual elements

function renderStations() {
    const container = document.getElementById('stations-list');
    const loading = document.getElementById('loading-state');
    const empty = document.getElementById('empty-state');
    const pagination = document.getElementById('pagination');

    // Check if we're on a page that has the stations list (edit page)
    if (!container || !loading || !empty || !pagination) {
        console.log('📝 renderStations called on page without stations list - no action needed');
        return;
    }

    // Check if filteredStations exists (should exist on edit page)
    if (typeof filteredStations === 'undefined') {
        console.log('📝 No filteredStations available - skipping render');
        return;
    }

    loading.style.display = 'none';

    if (filteredStations.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        pagination.classList.add('hidden');
        return;
    }

    empty.classList.add('hidden');

    const startIndex = (currentPage - 1) * stationsPerPage;
    const endIndex = Math.min(startIndex + stationsPerPage, filteredStations.length);
    const pageStations = filteredStations.slice(startIndex, endIndex);

    container.innerHTML = pageStations.map(station => createStationRow(station)).join('');

    // Update pagination
    updatePagination();
    pagination.classList.remove('hidden');
}

function createStationRow(station) {
    const hasImage = station.favicon || station.logo || station.local_image_url;
    const imageUrl = getFaviconUrl(station, { cacheBust: true });
    const isSelected = selectedStations.has(station.id);

    return `
        <div class="station-row grid grid-cols-1 md:grid-cols-12 gap-4 px-6 py-4 items-center">
            <!-- Mobile Layout -->
            <div class="md:hidden space-y-3">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" ${isSelected ? 'checked' : ''} 
                               onchange="toggleStationSelection(${station.id})"
                               class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                        <div class="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                            ${hasImage ? `<img src="${imageUrl}" alt="${station.name}" class="w-full h-full object-contain">` : 
                              '<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-radio text-lg"></i></div>'}
                        </div>
                        <div>
                            <h3 class="font-medium text-gray-900">${station.name}</h3>
                            <p class="text-sm text-gray-600">${station.country || 'Unknown'}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="health-indicator health-gray" title="Health status unknown"></span>
                        <button onclick="editStation(${station.id})" 
                                class="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700">
                            Edit
                        </button>
                    </div>
                </div>
                ${station.genre || station.type ? `
                <div class="flex flex-wrap gap-1">
                    ${station.genre ? `<span class="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">${station.genre}</span>` : ''}
                    ${station.type ? `<span class="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">${station.type}</span>` : ''}
                </div>
                ` : ''}
            </div>

            <!-- Desktop Layout -->
            <div class="hidden md:contents">
                <div class="col-span-1">
                    <input type="checkbox" ${isSelected ? 'checked' : ''} 
                           onchange="toggleStationSelection(${station.id})"
                           class="rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                </div>
                <div class="col-span-1">
                    <div class="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                        ${hasImage ? `<img src="${imageUrl}" alt="${station.name}" class="w-full h-full object-contain">` : 
                          '<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fas fa-radio"></i></div>'}
                    </div>
                </div>
                <div class="col-span-3">
                    <h3 class="font-medium text-gray-900 truncate">${station.name}</h3>
                    <p class="text-sm text-gray-600 truncate">${station.bitrate ? `${station.bitrate} kbps` : 'Unknown bitrate'}</p>
                </div>
                <div class="col-span-2">
                    <span class="text-gray-900">${station.country || 'Unknown'}</span>
                    ${station.city ? `<p class="text-sm text-gray-600">${station.city}</p>` : ''}
                </div>
                <div class="col-span-2">
                    <div class="space-y-1">
                        ${station.genre ? `<span class="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">${station.genre}</span>` : ''}
                        ${station.type ? `<span class="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">${station.type}</span>` : ''}
                    </div>
                </div>
                <div class="col-span-1">
                    <span class="health-indicator health-gray" title="Health status unknown"></span>
                </div>
                <div class="col-span-2">
                    <div class="flex space-x-2">
                        <button onclick="editStation(${station.id})" 
                                class="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button onclick="testStream(${station.id})" 
                                class="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                                title="Test stream">
                            <i class="fas fa-play"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}


function updatePagination() {
    const totalPages = Math.ceil(filteredStations.length / stationsPerPage);
    const startIndex = (currentPage - 1) * stationsPerPage;
    const endIndex = Math.min(startIndex + stationsPerPage, filteredStations.length);

    document.getElementById('page-start').textContent = startIndex + 1;
    document.getElementById('page-end').textContent = endIndex;
    document.getElementById('total-stations').textContent = filteredStations.length;
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;

    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
}

function showError(message) {
    // Create and show error notification
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50';
    errorDiv.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-exclamation-triangle mr-2"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-red-500 hover:text-red-700">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    document.body.appendChild(errorDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

function showSuccess(message) {
    // Create and show success notification
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded z-50';
    successDiv.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-check-circle mr-2"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-green-500 hover:text-green-700">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    document.body.appendChild(successDiv);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (successDiv.parentElement) {
            successDiv.remove();
        }
    }, 3000);
}

function resetStationForm() {
    // Reset form elements if they exist
    const form = document.querySelector('#station-editor-modal form');
    if (form) {
        form.reset();
    }
    
    // Reset image preview elements
    const imagePreview = document.getElementById('current-image');
    const imagePlaceholder = document.getElementById('no-image-placeholder');
    if (imagePreview && imagePlaceholder) {
        imagePreview.classList.add('hidden');
        imagePlaceholder.classList.remove('hidden');
    }
    
    // Reset other elements safely
    const normalizationSuggestions = document.getElementById('normalization-suggestions');
    if (normalizationSuggestions) {
        normalizationSuggestions.classList.add('hidden');
    }
    
    const scrapedDataPreview = document.getElementById('scraped-data-preview');
    if (scrapedDataPreview) {
        scrapedDataPreview.style.display = 'none';
    }
}

function closeStationEditor() {
    const modal = document.getElementById('station-editor-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    document.body.style.overflow = 'auto';
    currentEditingStation = null;
    originalStationData = null;
    resetStationForm();
}

// Modal and form utilities
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

function testStream(stationId) {
    const station = stations.find(s => s.id === stationId);
    if (!station) return;
    
    // Create a temporary audio element to test the stream
    const audio = new Audio(station.streamUrl);
    audio.load();
    
    audio.addEventListener('loadstart', () => {
        showSuccess(`Testing stream for ${station.name}...`);
    });
    
    audio.addEventListener('canplay', () => {
        showSuccess(`Stream for ${station.name} is working!`);
        audio.remove();
    });
    
    audio.addEventListener('error', (e) => {
        showError(`Stream test failed for ${station.name}: ${e.message || 'Unknown error'}`);
        audio.remove();
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
        if (audio.parentElement) {
            audio.remove();
            showError(`Stream test timed out for ${station.name}`);
        }
    }, 10000);
}