/**
 * Station Editor - Genre Management Module
 * Handles genre, subgenre, and type multi-select functionality
 */

export class GenreManager {
    constructor() {
        this.currentGenres = [];
        this.currentSubgenres = [];
        this.currentTypes = [];
        this.genreConstants = null;
        this.stationTypeConstants = null;
        this.collectionTagConstants = null;
    }

    // Load genre constants from API
    async loadConstants() {
        try {
            const [genreResponse, typeResponse, tagResponse] = await Promise.all([
                fetch('/admin/constants/genres'),
                fetch('/admin/constants/station-types'),
                fetch('/admin/constants/collection-tags')
            ]);
            
            if (genreResponse.ok && typeResponse.ok && tagResponse.ok) {
                this.genreConstants = await genreResponse.json();
                this.stationTypeConstants = await typeResponse.json();
                this.collectionTagConstants = await tagResponse.json();
            } else {
                throw new Error('Failed to load classification constants');
            }
        } catch (error) {
            console.error('Error loading classification constants:', error);
            // Fallback to basic values
            this.genreConstants = { allGenres: ['music', 'news', 'talk', 'sports'] };
            this.stationTypeConstants = { allTypes: ['music', 'news', 'talk', 'sports'] };
            this.collectionTagConstants = { allTags: [] };
        }
    }

    // Multi-select utility functions
    parseCommaSeparatedValues(str) {
        if (!str || str.trim() === '') return [];
        return str.split(',').map(item => item.trim()).filter(item => item.length > 0);
    }

    renderTagsForField(fieldName, values) {
        const container = document.getElementById(`current-${fieldName}`);
        if (!container) {
            console.error(`Container not found: current-${fieldName}`);
            return;
        }
        
        if (!values || values.length === 0) {
            container.innerHTML = `<span class="tag-placeholder">No ${fieldName} selected</span>`;
            return;
        }
        
        container.innerHTML = values.map((value, index) => `
            <div class="tag-item">
                <span>${value}</span>
                <span class="tag-remove" onclick="remove${fieldName.charAt(0).toUpperCase() + fieldName.slice(1,-1)}(${index})" title="Remove">×</span>
            </div>
        `).join('');
    }

    // Populate dropdowns with available options
    populateGenreDropdown() {
        const genreSelect = document.getElementById('add-genre-select');
        if (!genreSelect || !this.genreConstants) return;
        
        // Clear existing options except the first one
        genreSelect.innerHTML = '<option value="">Add Genre...</option>';
        
        // Add predefined genres
        this.genreConstants.allGenres.forEach(genre => {
            const option = document.createElement('option');
            option.value = genre;
            option.textContent = this.genreConstants.genres[genre]?.name || genre.charAt(0).toUpperCase() + genre.slice(1);
            genreSelect.appendChild(option);
        });
        
        // Remove any existing event listeners to prevent duplicates
        const newGenreSelect = genreSelect.cloneNode(true);
        genreSelect.parentNode.replaceChild(newGenreSelect, genreSelect);
        
        // Add event listener for adding genres
        const self = this;
        newGenreSelect.addEventListener('change', function() {
            if (this.value) {
                self.addGenre(this.value);
                this.value = ''; // Reset dropdown
            }
        });
    }

    populateSubgenreDropdown() {
        const subgenreSelect = document.getElementById('add-subgenre-select');
        if (!subgenreSelect) {
            console.warn('Subgenre select element not found');
            return;
        }
        
        console.log('Populating subgenre dropdown, genreConstants:', !!this.genreConstants);
        console.log('Current genres:', this.currentGenres);
        
        // Clear existing options
        subgenreSelect.innerHTML = '<option value="">Add Subgenre...</option>';
        
        // Get all possible subgenres from current genres, or all subgenres if no genres selected
        const availableSubgenres = new Set();
        
        if (this.genreConstants) {
            if (this.currentGenres.length > 0) {
                // Show subgenres for selected genres
                console.log('Showing subgenres for selected genres');
                this.currentGenres.forEach(genre => {
                    const genreData = this.genreConstants.genres[genre];
                    if (genreData && genreData.subgenres) {
                        genreData.subgenres.forEach(subgenre => availableSubgenres.add(subgenre));
                    }
                });
            } else {
                // No genres selected, show all subgenres
                console.log('No genres selected, showing all subgenres');
                Object.values(this.genreConstants.genres).forEach(genreData => {
                    if (genreData.subgenres) {
                        genreData.subgenres.forEach(subgenre => availableSubgenres.add(subgenre));
                    }
                });
            }
        } else {
            console.warn('Genre constants not loaded yet');
        }
        
        console.log('Available subgenres:', availableSubgenres.size);
        
        // Add subgenre options
        Array.from(availableSubgenres).sort().forEach(subgenre => {
            const option = document.createElement('option');
            option.value = subgenre;
            option.textContent = subgenre.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            subgenreSelect.appendChild(option);
        });
        
        // Remove any existing event listeners to prevent duplicates
        const newSelect = subgenreSelect.cloneNode(true);
        subgenreSelect.parentNode.replaceChild(newSelect, subgenreSelect);
        
        // Add event listener to the new element
        const self = this;
        newSelect.addEventListener('change', function() {
            if (this.value) {
                self.addSubgenre(this.value);
                this.value = '';
            }
        });
    }

    populateTypeDropdown() {
        const typeSelect = document.getElementById('add-type-select');
        if (!typeSelect || !this.stationTypeConstants) return;
        
        // Clear existing options
        typeSelect.innerHTML = '<option value="">Add Type...</option>';
        
        // Add station types
        this.stationTypeConstants.allTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = this.stationTypeConstants.stationTypes[type]?.name || 
                               type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            typeSelect.appendChild(option);
        });
        
        // Remove any existing event listeners to prevent duplicates
        const newTypeSelect = typeSelect.cloneNode(true);
        typeSelect.parentNode.replaceChild(newTypeSelect, typeSelect);
        
        // Add event listener
        const self = this;
        newTypeSelect.addEventListener('change', function() {
            if (this.value) {
                self.addType(this.value);
                this.value = '';
            }
        });
    }

    // Add functions
    addGenre(value) {
        if (!this.currentGenres.includes(value)) {
            this.currentGenres.push(value);
            this.renderTagsForField('genres', this.currentGenres);
            this.populateSubgenreDropdown(); // Update subgenres based on new genre
        }
    }

    addSubgenre(value) {
        if (!this.currentSubgenres.includes(value)) {
            this.currentSubgenres.push(value);
            this.renderTagsForField('subgenres', this.currentSubgenres);
        }
    }

    addType(value) {
        if (!this.currentTypes.includes(value)) {
            this.currentTypes.push(value);
            this.renderTagsForField('types', this.currentTypes);
        }
    }

    // Remove functions
    removeGenres(index) {
        this.currentGenres.splice(index, 1);
        this.renderTagsForField('genres', this.currentGenres);
        this.populateSubgenreDropdown(); // Update subgenres when genres change
    }

    removeSubgenres(index) {
        this.currentSubgenres.splice(index, 1);
        this.renderTagsForField('subgenres', this.currentSubgenres);
    }

    removeTypes(index) {
        this.currentTypes.splice(index, 1);
        this.renderTagsForField('types', this.currentTypes);
    }

    // Custom input functions
    showCustomGenreInput() {
        const customInput = document.getElementById('custom-genre-input');
        const addButton = document.querySelector('button[onclick="showCustomGenreInput()"]');
        if (customInput && addButton) {
            customInput.classList.remove('hidden');
            addButton.classList.add('hidden');
            document.getElementById('custom-genre-text').focus();
        }
    }

    cancelCustomGenre() {
        const customInput = document.getElementById('custom-genre-input');
        const addButton = document.querySelector('button[onclick="showCustomGenreInput()"]');
        if (customInput && addButton) {
            customInput.classList.add('hidden');
            addButton.classList.remove('hidden');
            document.getElementById('custom-genre-text').value = '';
        }
    }

    addCustomGenre() {
        const customText = document.getElementById('custom-genre-text').value.trim();
        if (customText) {
            this.addGenre(customText.toLowerCase().replace(/\s+/g, '-'));
            this.cancelCustomGenre();
        }
    }

    showCustomSubgenreInput() {
        const customInput = document.getElementById('custom-subgenre-input');
        const addButton = document.querySelector('button[onclick="showCustomSubgenreInput()"]');
        if (customInput && addButton) {
            customInput.classList.remove('hidden');
            addButton.classList.add('hidden');
            document.getElementById('custom-subgenre-text').focus();
        }
    }

    cancelCustomSubgenre() {
        const customInput = document.getElementById('custom-subgenre-input');
        const addButton = document.querySelector('button[onclick="showCustomSubgenreInput()"]');
        if (customInput && addButton) {
            customInput.classList.add('hidden');
            addButton.classList.remove('hidden');
            document.getElementById('custom-subgenre-text').value = '';
        }
    }

    addCustomSubgenre() {
        const customText = document.getElementById('custom-subgenre-text').value.trim();
        if (customText) {
            this.addSubgenre(customText.toLowerCase().replace(/\s+/g, '-'));
            this.cancelCustomSubgenre();
        }
    }

    showCustomTypeInput() {
        const customInput = document.getElementById('custom-type-input');
        const addButton = document.querySelector('button[onclick="showCustomTypeInput()"]');
        if (customInput && addButton) {
            customInput.classList.remove('hidden');
            addButton.classList.add('hidden');
            document.getElementById('custom-type-text').focus();
        }
    }

    cancelCustomType() {
        const customInput = document.getElementById('custom-type-input');
        const addButton = document.querySelector('button[onclick="showCustomTypeInput()"]');
        if (customInput && addButton) {
            customInput.classList.add('hidden');
            addButton.classList.remove('hidden');
            document.getElementById('custom-type-text').value = '';
        }
    }

    addCustomType() {
        const customText = document.getElementById('custom-type-text').value.trim();
        if (customText) {
            this.addType(customText.toLowerCase().replace(/\s+/g, '-'));
            this.cancelCustomType();
        }
    }

    // Initialize genre system with station data
    initializeSystem(station) {
        // Initialize multi-select genre system
        this.currentGenres = this.parseCommaSeparatedValues(station.genre);
        this.currentSubgenres = this.parseCommaSeparatedValues(station.subgenre);
        this.currentTypes = this.parseCommaSeparatedValues(station.type);
        
        // Populate dropdowns
        this.populateGenreDropdown();
        this.populateSubgenreDropdown();
        this.populateTypeDropdown();
        
        // Display current values
        this.renderTagsForField('genres', this.currentGenres);
        this.renderTagsForField('subgenres', this.currentSubgenres);
        this.renderTagsForField('types', this.currentTypes);
    }

    // Get current selections for saving
    getCurrentSelections() {
        return {
            genres: this.currentGenres.join(', '),
            subgenres: this.currentSubgenres.join(', '),
            types: this.currentTypes.join(', ')
        };
    }
}