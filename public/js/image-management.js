// Image Management Module
// Handles image download, upload, editing, and preview functionality

async function downloadStationImage(event) {
    event.preventDefault(); // Prevent any default behavior

    try {
        const button = event.target.closest('button');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Downloading...';
        button.disabled = true;

        // Get input elements
        const faviconInput = document.querySelector('#edit-favicon');
        const logoInput = document.querySelector('#edit-logo');
        const stationNameInput = document.querySelector('#edit-name');

        // Log for debugging
        console.log('Favicon Input:', faviconInput);
        console.log('Logo Input:', logoInput);
        console.log('Station Name Input:', stationNameInput);
        console.log('Favicon URL Value:', faviconInput?.value);
        console.log('Logo URL Value:', logoInput?.value);
        console.log('Station Name Value:', stationNameInput?.value);
        console.log('Station ID:', currentEditingStation?.id);

        // Check if inputs exist
        if (!faviconInput || !logoInput) {
            console.error('Input elements for Favicon URL or Logo URL not found');
            alert('Error: Favicon URL or Logo URL input fields are missing. Please check the form.');
            button.innerHTML = originalText;
            button.disabled = false;
            return;
        }

        // Get input values and download source selection
        const faviconUrl = faviconInput.value?.trim() || '';
        const logoUrl = logoInput.value?.trim() || '';
        const downloadSourceSelect = document.getElementById('download-source');
        const downloadSource = downloadSourceSelect ? downloadSourceSelect.value : 'auto';
        
        // Determine which URL to use based on source selection
        let imageUrl = '';
        if (downloadSource === 'logo' && logoUrl) {
            imageUrl = logoUrl;
        } else if (downloadSource === 'favicon' && faviconUrl) {
            imageUrl = faviconUrl;
        } else {
            // Auto mode - prioritize logo over favicon
            imageUrl = logoUrl || faviconUrl;
        }

        if (!imageUrl) {
            const sourceMsg = downloadSource === 'logo' ? 'Logo URL field' : 
                             downloadSource === 'favicon' ? 'Favicon URL field' : 
                             'Logo URL or Favicon URL field';
            console.error(`No valid URL found in ${sourceMsg}`);
            alert(`Please enter a valid URL in the ${sourceMsg}.`);
            button.innerHTML = originalText;
            button.disabled = false;
            return;
        }

        // Validate URL format
        try {
            new URL(imageUrl);
        } catch (e) {
            console.error('Invalid URL format:', imageUrl);
            alert('Invalid URL format. Please enter a valid URL.');
            button.innerHTML = originalText;
            button.disabled = false;
            return;
        }

        // Get selected download size
        const sizeSelect = document.getElementById('download-size');
        const selectedSize = sizeSelect ? sizeSelect.value : '512';
        const downloadSize = selectedSize === 'original' ? 2048 : parseInt(selectedSize);

        console.log('Download Settings:', {
            source: downloadSource,
            size: selectedSize,
            downloadSize: downloadSize,
            selectedUrl: imageUrl,
            logoUrl: logoUrl,
            faviconUrl: faviconUrl
        });

        // Determine endpoint and payload - use NanoID if available, otherwise use numeric ID
        const stationIdentifier = currentEditingStation?.nanoid || currentEditingStation?.id;
        let endpoint = '/images/download';
        let payload = { url: imageUrl, size: downloadSize };

        if (stationIdentifier) {
            endpoint = `/images/download/${stationIdentifier}`;
            payload = { url: imageUrl, size: downloadSize }; // Send URL for existing stations
        }

        // Fetch the image and save to server
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();

            // Update the current image preview
            const currentImage = document.getElementById('current-image');
            const noImagePlaceholder = document.getElementById('no-image-placeholder');

            if (currentImage && noImagePlaceholder) {
                currentImage.src = result.imageUrl || imageUrl;
                currentImage.classList.remove('hidden');
                noImagePlaceholder.classList.add('hidden');
            } else {
                console.warn('Image preview elements not found');
            }

            // Update the local image URL field in the editor
            const localImageField = document.getElementById('edit-local-image');
            if (localImageField && result.imageUrl) {
                localImageField.value = result.imageUrl;
                console.log('Updated local image URL field:', result.imageUrl);
            }

            // Update current editing station data
            if (currentEditingStation) {
                currentEditingStation.local_image_url = result.imageUrl;
                currentEditingStation._downloadedImageData = result.imageData || result.imageUrl || imageUrl;
                currentEditingStation._downloadedImageUrl = imageUrl;
            }

            // Update preview to reflect the new local image
            if (typeof updateImagePreview === 'function') {
                updateImagePreview();
            }

            // Show success message
            const stationName = stationNameInput?.value?.trim() || `Station ${stationIdentifier || 'Unknown'}`;
            const originalInfo = result.dimensions?.original ? ` (original: ${result.dimensions.original.width}x${result.dimensions.original.height}px)` : '';
            showSuccess(`Image saved for ${stationName} (${result.dimensions?.width || downloadSize}x${result.dimensions?.height || downloadSize}px)${originalInfo}`);
        } else {
            const error = await response.json();
            console.error('Failed to save image:', error);
            showError(`Failed to save image: ${error.error}`);
        }

        // Reset button
        button.innerHTML = originalText;
        button.disabled = false;
    } catch (error) {
        console.error('Error saving image to server:', error);
        showError('Error saving image to server');

        // Reset button
        const button = event.target.closest('button');
        if (button) {
            button.innerHTML = '<i class="fas fa-download mr-1"></i>Download';
            button.disabled = false;
        }
    }
}

function uploadStationImage() {
    document.getElementById('image-upload-input').click();
}

function editStationImage() {
    if (!currentEditingStation) return;
    
    // Create a message listener for when the image editor saves
    const messageListener = (event) => {
        if (event.data && event.data.type === 'imageUpdated' && (event.data.stationId === currentEditingStation.id || event.data.stationId === currentEditingStation.nanoid)) {
            // Reload the station image in the modal
            setTimeout(async () => {
                console.log('🔄 Image editor saved, refreshing station data...');
                
                // Refresh station data from server to get updated image path - use NanoID if available
                const stationIdentifier = currentEditingStation.nanoid || currentEditingStation.id;
                const response = await fetch(`/stations/${stationIdentifier}`);
                if (response.ok) {
                    const updatedStation = await response.json();
                    console.log('📊 Updated station data:', updatedStation);
                    
                    currentEditingStation = updatedStation;
                    
                    // Update the local image URL field
                    const localImageField = document.getElementById('edit-local-image');
                    if (localImageField && updatedStation.local_image_url) {
                        localImageField.value = updatedStation.local_image_url;
                        console.log('✅ Updated local image URL field:', updatedStation.local_image_url);
                    }
                    
                    // Reload current image with cache busting
                    loadStationImage(updatedStation);
                    
                    // Update the preview
                    if (typeof updateImagePreview === 'function') {
                        updateImagePreview();
                    }
                    
                    console.log('✅ Image display refreshed after edit');
                } else {
                    console.error('❌ Failed to refresh station data');
                }
            }, 1000); // Small delay to ensure image is processed
            
            // Remove the listener
            window.removeEventListener('message', messageListener);
        }
    };
    
    window.addEventListener('message', messageListener);
    
    // Open the simple image editor with pre-loaded station - use NanoID if available
    const stationIdentifier = currentEditingStation.nanoid || currentEditingStation.id;
    const editorUrl = `/admin/simple-image-editor?stationId=${stationIdentifier}&stationName=${encodeURIComponent(currentEditingStation.name)}`;
    window.open(editorUrl, '_blank', 'width=1000,height=700');
}

function loadStationImage(station) {
    const currentImage = document.getElementById('current-image');
    const noImagePlaceholder = document.getElementById('no-image-placeholder');
    
    if (!currentImage || !noImagePlaceholder) {
        console.warn('Image preview elements not found');
        return;
    }

    // Use priority logic with cache busting for updated images
    const imageUrl = getFaviconUrl(station, { cacheBust: true });
    
    console.log('Loading station image with priority:', {
        local: station.local_image_url,
        logo: station.logo,
        favicon: station.favicon,
        selected: imageUrl
    });
    
    if (imageUrl) {
        currentImage.src = imageUrl;
        currentImage.classList.remove('hidden');
        noImagePlaceholder.classList.add('hidden');
        
        // Handle image load errors
        currentImage.onerror = () => {
            console.warn('Failed to load image:', imageUrl);
            currentImage.classList.add('hidden');
            noImagePlaceholder.classList.remove('hidden');
        };
    } else {
        currentImage.classList.add('hidden');
        noImagePlaceholder.classList.remove('hidden');
    }
}

// Preview function for download source selection
function updateImagePreview() {
    if (!currentEditingStation) return;
    
    const downloadSourceSelect = document.getElementById('download-source');
    const downloadSource = downloadSourceSelect ? downloadSourceSelect.value : 'auto';
    const previewImage = document.getElementById('preview-image');
    const previewPlaceholder = document.getElementById('preview-placeholder');
    
    if (!previewImage || !previewPlaceholder) return;
    
    // Get URLs from the form inputs (current values)
    const faviconUrl = document.getElementById('edit-favicon')?.value?.trim() || '';
    const logoUrl = document.getElementById('edit-logo')?.value?.trim() || '';
    const localImageUrl = document.getElementById('edit-local-image')?.value?.trim() || '';
    
    // Determine which URL to preview based on source selection
    let previewUrl = '';
    if (downloadSource === 'logo' && logoUrl) {
        previewUrl = logoUrl;
    } else if (downloadSource === 'favicon' && faviconUrl) {
        previewUrl = faviconUrl;
    } else {
        // Auto mode - use priority: local -> logo -> favicon
        previewUrl = localImageUrl || logoUrl || faviconUrl;
    }
    
    console.log('Preview update:', {
        source: downloadSource,
        url: previewUrl,
        available: { local: localImageUrl, logo: logoUrl, favicon: faviconUrl }
    });
    
    if (previewUrl) {
        // Add cache busting for Supabase URLs to ensure we get the latest image
        const cacheBustUrl = previewUrl.includes('supabase.co') ? 
            `${previewUrl}?t=${Date.now()}` : previewUrl;
            
        previewImage.src = cacheBustUrl;
        previewImage.classList.remove('hidden');
        previewPlaceholder.classList.add('hidden');
        
        previewImage.onerror = () => {
            console.warn('Preview image failed to load:', cacheBustUrl);
            previewImage.classList.add('hidden');
            previewPlaceholder.classList.remove('hidden');
        };
    } else {
        previewImage.classList.add('hidden');
        previewPlaceholder.classList.remove('hidden');
    }
}

// Handle file upload
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('image-upload-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
    }
    
    // Add event listener for download source selection
    const downloadSourceSelect = document.getElementById('download-source');
    if (downloadSourceSelect) {
        downloadSourceSelect.addEventListener('change', updateImagePreview);
    }

    // Note: downloadStationImage is called via onclick attribute, no duplicate listener needed
});

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!isImageFile(file.name)) {
        showError('Please select a valid image file (JPG, PNG, GIF, etc.)');
        return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showError('Image file size must be less than 10MB');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('image', file);

        let endpoint = '/images/upload';
        const stationIdentifier = currentEditingStation?.nanoid || currentEditingStation?.id;
        if (stationIdentifier) {
            endpoint = `/images/upload/${stationIdentifier}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            
            // Update image preview
            const currentImage = document.getElementById('current-image');
            const noImagePlaceholder = document.getElementById('no-image-placeholder');
            
            if (currentImage && noImagePlaceholder) {
                currentImage.src = result.imageUrl;
                currentImage.classList.remove('hidden');
                noImagePlaceholder.classList.add('hidden');
            }

            // Update station data
            if (currentEditingStation) {
                currentEditingStation.favicon = result.imageUrl;
                currentEditingStation._uploadedImage = true;
            }

            showSuccess('Image uploaded successfully!');
        } else {
            const error = await response.json();
            showError(`Failed to upload image: ${error.error}`);
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        showError('Error uploading image');
    } finally {
        // Clear the file input
        event.target.value = '';
    }
}

// Image preview utilities
function previewImage(imageUrl) {
    const modal = document.getElementById('image-preview-modal');
    const previewImg = document.getElementById('preview-image');
    
    if (modal && previewImg) {
        previewImg.src = imageUrl;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeImagePreview() {
    const modal = document.getElementById('image-preview-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Image processing utilities
function resizeImageCanvas(canvas, maxWidth, maxHeight) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    let newWidth = width;
    let newHeight = height;
    
    // Calculate new dimensions
    if (width > height) {
        if (width > maxWidth) {
            newHeight = (height * maxWidth) / width;
            newWidth = maxWidth;
        }
    } else {
        if (height > maxHeight) {
            newWidth = (width * maxHeight) / height;
            newHeight = maxHeight;
        }
    }
    
    // Create new canvas with resized dimensions
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;
    
    const resizedCtx = resizedCanvas.getContext('2d');
    resizedCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
    
    return resizedCanvas;
}

function canvasToBlob(canvas, quality = 0.8) {
    return new Promise(resolve => {
        canvas.toBlob(resolve, 'image/png', quality);
    });
}

// Drag and drop image upload
function setupImageDragAndDrop(dropZoneId) {
    const dropZone = document.getElementById(dropZoneId);
    if (!dropZone) return;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(file => isImageFile(file.name));

        if (imageFiles.length === 0) {
            showError('Please drop image files only');
            return;
        }

        // Handle the first image file
        const file = imageFiles[0];
        
        // Simulate file input change event
        const fileInput = document.getElementById('image-upload-input');
        if (fileInput) {
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            
            // Trigger the change event
            const changeEvent = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(changeEvent);
        }
    });
}