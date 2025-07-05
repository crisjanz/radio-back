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

        // Get input values - prioritizes logo URL over favicon URL
        const faviconUrl = faviconInput.value?.trim() || '';
        const logoUrl = logoInput.value?.trim() || '';
        const imageUrl = logoUrl || faviconUrl; // Prioritizes logo URL over favicon URL

        if (!imageUrl) {
            console.error('No valid URL found in Logo URL or Favicon URL fields');
            alert('Please enter a valid URL in either the Logo URL or Favicon URL field.');
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

        console.log('Selected Size:', selectedSize, 'Download Size:', downloadSize);

        // Determine endpoint and payload
        const stationId = currentEditingStation?.id && typeof currentEditingStation.id === 'number' ? currentEditingStation.id : null;
        let endpoint = '/images/download';
        let payload = { url: imageUrl, size: downloadSize };

        if (stationId) {
            endpoint = `/images/download/${stationId}`;
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

            // Store the image data for later use
            if (currentEditingStation) {
                currentEditingStation._downloadedImageData = result.imageData || result.imageUrl || imageUrl;
                currentEditingStation._downloadedImageUrl = imageUrl;
            }

            // Show success message
            const stationName = stationNameInput?.value?.trim() || `Station ${stationId || 'Unknown'}`;
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
        if (event.data && event.data.type === 'imageUpdated' && event.data.stationId === currentEditingStation.id) {
            // Reload the station image in the modal
            setTimeout(async () => {
                // Refresh station data from server to get updated image path
                const response = await fetch(`/stations/${currentEditingStation.id}`);
                if (response.ok) {
                    const updatedStation = await response.json();
                    currentEditingStation = updatedStation;
                    loadStationImage(updatedStation);
                    
                    // Update the preview if the same image
                    const previewImage = document.getElementById('preview-image');
                    const currentImage = document.getElementById('current-image');
                    if (!previewImage.classList.contains('hidden')) {
                        previewImage.src = currentImage.src + '?t=' + Date.now(); // Cache bust
                    }
                }
            }, 1000); // Small delay to ensure image is processed
            
            // Remove the listener
            window.removeEventListener('message', messageListener);
        }
    };
    
    window.addEventListener('message', messageListener);
    
    // Open the simple image editor with pre-loaded station
    const editorUrl = `/admin/simple-image-editor?stationId=${currentEditingStation.id}&stationName=${encodeURIComponent(currentEditingStation.name)}`;
    window.open(editorUrl, '_blank', 'width=1000,height=700');
}

function loadStationImage(station) {
    const currentImage = document.getElementById('current-image');
    const noImagePlaceholder = document.getElementById('no-image-placeholder');
    
    if (!currentImage || !noImagePlaceholder) {
        console.warn('Image preview elements not found');
        return;
    }

    const imageUrl = getFaviconUrl(station);
    
    if (imageUrl) {
        currentImage.src = imageUrl;
        currentImage.classList.remove('hidden');
        noImagePlaceholder.classList.add('hidden');
        
        // Handle image load errors
        currentImage.onerror = () => {
            currentImage.classList.add('hidden');
            noImagePlaceholder.classList.remove('hidden');
        };
    } else {
        currentImage.classList.add('hidden');
        noImagePlaceholder.classList.remove('hidden');
    }
}

// Handle file upload
document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('image-upload-input');
    if (fileInput) {
        fileInput.addEventListener('change', handleImageUpload);
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
        if (currentEditingStation?.id) {
            endpoint = `/images/upload/${currentEditingStation.id}`;
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