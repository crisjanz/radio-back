/**
 * Station Editor - Validation Module
 * Handles form validation, auto-save, and form utilities
 */

export class ValidationManager {
    constructor() {
        this.autoSaveTimeout = null;
        this.autoSaveEnabled = false;
    }

    // Reset form to original values
    resetForm() {
        // Get original data from core module
        if (window.StationEditorCore?.originalStationData) {
            const originalData = window.StationEditorCore.originalStationData;
            // Trigger the populateStationEditor function from main file
            if (typeof populateStationEditor === 'function') {
                populateStationEditor(originalData);
                this.showFormSuccess('Form reset to original values');
            }
        } else {
            alert('No original data available to reset to');
        }
    }

    // Comprehensive form validation
    validateStationForm() {
        const errors = [];
        
        // Required fields
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
        if (email && !this.validateEmail(email)) {
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
        
        // Validate bitrate
        const bitrate = document.getElementById('edit-bitrate').value;
        if (bitrate && (isNaN(bitrate) || bitrate < 8 || bitrate > 1000)) {
            errors.push('Bitrate must be a number between 8 and 1000');
        }
        
        // Validate established year
        const established = document.getElementById('edit-established').value;
        if (established) {
            const year = parseInt(established);
            const currentYear = new Date().getFullYear();
            if (isNaN(year) || year < 1900 || year > currentYear) {
                errors.push(`Established year must be between 1900 and ${currentYear}`);
            }
        }
        
        // Validate quality score
        const qualityScore = document.getElementById('edit-quality-score').value;
        if (qualityScore && (isNaN(qualityScore) || qualityScore < 0 || qualityScore > 100)) {
            errors.push('Quality score must be a number between 0 and 100');
        }
        
        // Validate metadata fields JSON
        const metadataFields = document.getElementById('edit-metadata-fields').value.trim();
        if (metadataFields) {
            try {
                JSON.parse(metadataFields);
            } catch (e) {
                errors.push('Metadata fields must be valid JSON');
            }
        }
        
        return errors;
    }

    // Email validation helper
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Auto-save functionality
    enableAutoSave() {
        if (this.autoSaveEnabled) return; // Already enabled
        
        const formInputs = document.querySelectorAll('#station-editor-modal input, #station-editor-modal textarea, #station-editor-modal select');
        
        formInputs.forEach(input => {
            input.addEventListener('input', () => {
                clearTimeout(this.autoSaveTimeout);
                
                // Show pending changes indicator
                this.showFormPendingChanges();
                
                this.autoSaveTimeout = setTimeout(() => {
                    // Auto-save after 3 seconds of inactivity
                    if (typeof saveStation === 'function') {
                        console.log('Auto-saving changes...');
                        // Could implement auto-save here, but for now just clear indicator
                        this.clearFormPendingChanges();
                    }
                }, 3000);
            });
        });
        
        this.autoSaveEnabled = true;
        console.log('Auto-save enabled');
    }

    // Disable auto-save
    disableAutoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveEnabled = false;
        this.clearFormPendingChanges();
        console.log('Auto-save disabled');
    }

    // Show pending changes indicator
    showFormPendingChanges() {
        const saveButton = document.querySelector('button[onclick="saveStation()"]');
        if (saveButton && !saveButton.classList.contains('bg-yellow-500')) {
            saveButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            saveButton.classList.add('bg-yellow-500', 'hover:bg-yellow-600');
            saveButton.innerHTML = '<i class="fas fa-save mr-2"></i>Save Changes (Modified)';
        }
    }

    // Clear pending changes indicator
    clearFormPendingChanges() {
        const saveButton = document.querySelector('button[onclick="saveStation()"]');
        if (saveButton) {
            saveButton.classList.remove('bg-yellow-500', 'hover:bg-yellow-600');
            saveButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
            saveButton.innerHTML = '<i class="fas fa-save mr-2"></i>Save Changes';
        }
    }

    // Show validation errors
    showValidationErrors(errors) {
        if (errors.length === 0) return;
        
        const errorMessage = `Please fix the following errors:\n\n• ${errors.join('\n• ')}`;
        alert(errorMessage);
    }

    // Form success message
    showFormSuccess(message) {
        console.log('Success:', message);
        
        // Could implement a toast notification here
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.innerHTML = `<i class="fas fa-check mr-2"></i>${message}`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Form error message
    showFormError(message) {
        console.error('Error:', message);
        
        // Could implement a toast notification here
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        notification.innerHTML = `<i class="fas fa-exclamation-triangle mr-2"></i>${message}`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    // Check if form has unsaved changes
    hasUnsavedChanges() {
        const currentEditingStation = window.StationEditorCore?.currentEditingStation;
        const originalStationData = window.StationEditorCore?.originalStationData;
        
        if (!currentEditingStation || !originalStationData) return false;
        
        // Compare current form values with original data
        const currentFormData = this.collectCurrentFormData();
        
        // Compare key fields
        const fieldsToCompare = ['name', 'streamUrl', 'homepage', 'description', 'genre', 'type'];
        
        for (const field of fieldsToCompare) {
            if (currentFormData[field] !== originalStationData[field]) {
                return true;
            }
        }
        
        return false;
    }

    // Collect current form data for comparison
    collectCurrentFormData() {
        return {
            name: document.getElementById('edit-name').value.trim(),
            streamUrl: document.getElementById('edit-stream-url').value.trim(),
            homepage: document.getElementById('edit-homepage').value.trim(),
            description: document.getElementById('edit-description').value.trim(),
            genre: window.genreManager?.getCurrentSelections()?.genres || '',
            type: window.genreManager?.getCurrentSelections()?.types || ''
        };
    }

    // Warn about unsaved changes when closing
    checkUnsavedChangesBeforeClose() {
        if (this.hasUnsavedChanges()) {
            return confirm('You have unsaved changes. Are you sure you want to close without saving?');
        }
        return true;
    }
}