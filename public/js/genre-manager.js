/**
 * Genre Management Module
 * Handles multi-select genre, subgenre, and type UI for station editor
 */

class GenreManager {
    constructor() {
        this.genres = [];
        this.stationTypes = [];
        this.collectionTags = [];
        this.currentStation = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Load all constants from backend
            const [genresRes, typesRes, tagsRes] = await Promise.all([
                fetch('/admin/constants/genres'),
                fetch('/admin/constants/station-types'),
                fetch('/admin/constants/collection-tags')
            ]);

            if (!genresRes.ok) throw new Error('Failed to load genres');
            if (!typesRes.ok) throw new Error('Failed to load station types');
            if (!tagsRes.ok) throw new Error('Failed to load collection tags');

            this.genres = await genresRes.json();
            this.stationTypes = await typesRes.json();
            this.collectionTags = await tagsRes.json();

            this.populateDropdowns();
            this.setupEventListeners();
            this.initialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize GenreManager:', error);
        }
    }

    populateDropdowns() {
        // Populate genre dropdown
        const genreSelect = document.getElementById('add-genre-select');
        
        if (genreSelect && this.genres.allGenres) {
            genreSelect.innerHTML = '<option value="">Add Genre...</option>';
            this.genres.allGenres.forEach(genre => {
                const genreInfo = this.genres.genres[genre];
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genreInfo.name;
                genreSelect.appendChild(option);
            });
        }

        // Populate type dropdown
        const typeSelect = document.getElementById('add-type-select');
        if (typeSelect && this.stationTypes.allTypes) {
            typeSelect.innerHTML = '<option value="">Add Type...</option>';
            
            // Group by category
            const categories = {};
            this.stationTypes.allTypes.forEach(type => {
                const typeInfo = this.stationTypes.stationTypes[type];
                if (!categories[typeInfo.category]) {
                    categories[typeInfo.category] = [];
                }
                categories[typeInfo.category].push({key: type, info: typeInfo});
            });

            // Add options grouped by category
            Object.entries(categories).forEach(([category, types]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = category.charAt(0).toUpperCase() + category.slice(1);
                
                types.forEach(({key, info}) => {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = info.name;
                    optgroup.appendChild(option);
                });
                
                typeSelect.appendChild(optgroup);
            });
        }
    }

    setupEventListeners() {
        // Genre selection
        const genreSelect = document.getElementById('add-genre-select');
        if (genreSelect) {
            genreSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.addGenre(e.target.value);
                    e.target.value = '';
                }
            });
        }

        // Subgenre selection
        const subgenreSelect = document.getElementById('add-subgenre-select');
        if (subgenreSelect) {
            subgenreSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.addSubgenre(e.target.value);
                    e.target.value = '';
                }
            });
        }

        // Type selection
        const typeSelect = document.getElementById('add-type-select');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.addType(e.target.value);
                    e.target.value = '';
                }
            });
        }
    }

    loadStation(station) {
        this.currentStation = station;
        
        // Parse and display existing genres
        const genres = this.parseMultiValue(station.genre);
        const subgenres = this.parseMultiValue(station.subgenre);
        const types = this.parseMultiValue(station.type);
        
        this.displayCurrentGenres(genres);
        this.displayCurrentSubgenres(subgenres);
        this.displayCurrentTypes(types);
        
        // Update subgenre dropdown based on selected genres
        this.updateSubgenreDropdown();
    }

    parseMultiValue(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
    }

    addGenre(genre) {
        const container = document.getElementById('current-genres');
        const placeholder = container.querySelector('.genre-placeholder');
        
        // Remove placeholder if exists
        if (placeholder) {
            placeholder.remove();
        }

        // Check if already exists
        if (container.querySelector(`[data-genre="${genre}"]`)) {
            return;
        }

        const genreInfo = this.genres.genres[genre];
        const tag = this.createTag(genre, genreInfo.name, 'genre');
        container.appendChild(tag);

        this.updateSubgenreDropdown();
        this.updateHiddenFields();
    }

    addSubgenre(subgenre) {
        const container = document.getElementById('current-subgenres');
        const placeholder = container.querySelector('.subgenre-placeholder');
        
        if (placeholder) {
            placeholder.remove();
        }

        if (container.querySelector(`[data-subgenre="${subgenre}"]`)) {
            return;
        }

        const displayName = subgenre.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const tag = this.createTag(subgenre, displayName, 'subgenre');
        container.appendChild(tag);

        this.updateHiddenFields();
    }

    addType(type) {
        const container = document.getElementById('current-types');
        const placeholder = container.querySelector('.type-placeholder');
        
        if (placeholder) {
            placeholder.remove();
        }

        if (container.querySelector(`[data-type="${type}"]`)) {
            return;
        }

        const typeInfo = this.stationTypes.stationTypes[type];
        const tag = this.createTag(type, typeInfo.name, 'type');
        container.appendChild(tag);

        this.updateHiddenFields();
    }

    createTag(value, displayName, type) {
        const tag = document.createElement('span');
        tag.className = 'tag-item';
        tag.setAttribute(`data-${type}`, value);
        
        tag.innerHTML = `
            ${displayName}
            <span class="tag-remove" onclick="genreManager.remove${type.charAt(0).toUpperCase() + type.slice(1)}('${value}')">
                <i class="fas fa-times"></i>
            </span>
        `;
        
        return tag;
    }

    removeGenre(genre) {
        const container = document.getElementById('current-genres');
        const tag = container.querySelector(`[data-genre="${genre}"]`);
        if (tag) {
            tag.remove();
        }

        // Add placeholder if empty
        if (container.children.length === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500 genre-placeholder">No genres selected</span>';
        }

        this.updateSubgenreDropdown();
        this.updateHiddenFields();
    }

    removeSubgenre(subgenre) {
        const container = document.getElementById('current-subgenres');
        const tag = container.querySelector(`[data-subgenre="${subgenre}"]`);
        if (tag) {
            tag.remove();
        }

        if (container.children.length === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500 subgenre-placeholder">No subgenres selected</span>';
        }

        this.updateHiddenFields();
    }

    removeType(type) {
        const container = document.getElementById('current-types');
        const tag = container.querySelector(`[data-type="${type}"]`);
        if (tag) {
            tag.remove();
        }

        if (container.children.length === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500 type-placeholder">No types selected</span>';
        }

        this.updateHiddenFields();
    }

    updateSubgenreDropdown() {
        const subgenreSelect = document.getElementById('add-subgenre-select');
        if (!subgenreSelect) return;

        // Get currently selected genres
        const selectedGenres = this.getCurrentGenres();
        
        // Clear and repopulate subgenre dropdown
        subgenreSelect.innerHTML = '<option value="">Add Subgenre...</option>';

        if (selectedGenres.length === 0) {
            // If no genres selected, disable subgenre dropdown
            subgenreSelect.disabled = true;
            return;
        }

        subgenreSelect.disabled = false;

        // Get all available subgenres for selected genres
        const availableSubgenres = new Set();
        selectedGenres.forEach(genre => {
            const genreInfo = this.genres.genres[genre];
            if (genreInfo && genreInfo.subgenres) {
                genreInfo.subgenres.forEach(subgenre => {
                    availableSubgenres.add(subgenre);
                });
            }
        });

        // Add subgenres to dropdown
        Array.from(availableSubgenres).sort().forEach(subgenre => {
            const option = document.createElement('option');
            option.value = subgenre;
            option.textContent = subgenre.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
            subgenreSelect.appendChild(option);
        });
    }

    displayCurrentGenres(genres) {
        const container = document.getElementById('current-genres');
        container.innerHTML = '';

        if (genres.length === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500 genre-placeholder">No genres selected</span>';
            return;
        }

        genres.forEach(genre => {
            const genreInfo = this.genres.genres && this.genres.genres[genre];
            if (genreInfo) {
                const tag = this.createTag(genre, genreInfo.name, 'genre');
                container.appendChild(tag);
            } else {
                // Handle case where genre system isn't loaded yet or custom genre
                const tag = this.createTag(genre, genre.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()), 'genre');
                container.appendChild(tag);
            }
        });
    }

    displayCurrentSubgenres(subgenres) {
        const container = document.getElementById('current-subgenres');
        container.innerHTML = '';

        if (subgenres.length === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500 subgenre-placeholder">No subgenres selected</span>';
            return;
        }

        subgenres.forEach(subgenre => {
            const displayName = subgenre.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
            const tag = this.createTag(subgenre, displayName, 'subgenre');
            container.appendChild(tag);
        });
    }

    displayCurrentTypes(types) {
        const container = document.getElementById('current-types');
        container.innerHTML = '';

        if (types.length === 0) {
            container.innerHTML = '<span class="text-sm text-gray-500 type-placeholder">No types selected</span>';
            return;
        }

        types.forEach(type => {
            const typeInfo = this.stationTypes.stationTypes && this.stationTypes.stationTypes[type];
            if (typeInfo) {
                const tag = this.createTag(type, typeInfo.name, 'type');
                container.appendChild(tag);
            } else {
                // Handle case where type system isn't loaded yet or custom type
                const tag = this.createTag(type, type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()), 'type');
                container.appendChild(tag);
            }
        });
    }

    getCurrentGenres() {
        const container = document.getElementById('current-genres');
        const tags = container.querySelectorAll('[data-genre]');
        return Array.from(tags).map(tag => tag.getAttribute('data-genre'));
    }

    getCurrentSubgenres() {
        const container = document.getElementById('current-subgenres');
        const tags = container.querySelectorAll('[data-subgenre]');
        return Array.from(tags).map(tag => tag.getAttribute('data-subgenre'));
    }

    getCurrentTypes() {
        const container = document.getElementById('current-types');
        const tags = container.querySelectorAll('[data-type]');
        return Array.from(tags).map(tag => tag.getAttribute('data-type'));
    }

    updateHiddenFields() {
        // Update hidden form fields that the main station editor expects
        const genres = this.getCurrentGenres();
        const subgenres = this.getCurrentSubgenres();
        const types = this.getCurrentTypes();

        // Update the original form fields if they exist
        const genreField = document.getElementById('edit-genre');
        const typeField = document.getElementById('edit-type');
        
        if (genreField) genreField.value = genres.join(', ');
        if (typeField) typeField.value = types.join(', ');

        // Store subgenre data (you may need to add this field to your form)
        if (!document.getElementById('edit-subgenre')) {
            const subgenreField = document.createElement('input');
            subgenreField.type = 'hidden';
            subgenreField.id = 'edit-subgenre';
            subgenreField.name = 'subgenre';
            document.querySelector('#station-editor-modal form, #station-editor-modal').appendChild(subgenreField);
        }
        document.getElementById('edit-subgenre').value = subgenres.join(', ');
    }

    // Custom genre/subgenre/type functions
    showCustomGenreInput() {
        document.getElementById('custom-genre-input').classList.remove('hidden');
        document.getElementById('custom-genre').focus();
    }

    showCustomSubgenreInput() {
        document.getElementById('custom-subgenre-input').classList.remove('hidden');
        document.getElementById('custom-subgenre').focus();
    }

    showCustomTypeInput() {
        document.getElementById('custom-type-input').classList.remove('hidden');
        document.getElementById('custom-type').focus();
    }

    addCustomGenre() {
        const input = document.getElementById('custom-genre');
        const value = input.value.trim();
        if (value) {
            this.addGenre(value);
            input.value = '';
            this.cancelCustomGenre();
        }
    }

    addCustomSubgenre() {
        const input = document.getElementById('custom-subgenre');
        const value = input.value.trim();
        if (value) {
            this.addSubgenre(value);
            input.value = '';
            this.cancelCustomSubgenre();
        }
    }

    addCustomType() {
        const input = document.getElementById('custom-type');
        const value = input.value.trim();
        if (value) {
            this.addType(value);
            input.value = '';
            this.cancelCustomType();
        }
    }

    cancelCustomGenre() {
        document.getElementById('custom-genre-input').classList.add('hidden');
        document.getElementById('custom-genre').value = '';
    }

    cancelCustomSubgenre() {
        document.getElementById('custom-subgenre-input').classList.add('hidden');
        document.getElementById('custom-subgenre').value = '';
    }

    cancelCustomType() {
        document.getElementById('custom-type-input').classList.add('hidden');
        document.getElementById('custom-type').value = '';
    }

    // Analysis integration
    applySuggestion(type, value) {
        switch(type) {
            case 'genre':
                this.addGenre(value);
                break;
            case 'subgenre':
                this.addSubgenre(value);
                break;
            case 'type':
                this.addType(value);
                break;
        }
    }

    applyAllSuggestions(suggestions) {
        if (suggestions.genres) {
            suggestions.genres.forEach(genre => this.addGenre(genre));
        }
        if (suggestions.subgenres) {
            suggestions.subgenres.forEach(subgenre => this.addSubgenre(subgenre));
        }
        if (suggestions.types) {
            suggestions.types.forEach(type => this.addType(type));
        }
    }
}

// Global instance
const genreManager = new GenreManager();

// Custom input functions (global scope for onclick handlers)
function showCustomGenreInput() {
    genreManager.showCustomGenreInput();
}

function showCustomSubgenreInput() {
    genreManager.showCustomSubgenreInput();
}

function showCustomTypeInput() {
    genreManager.showCustomTypeInput();
}

function addCustomGenre() {
    genreManager.addCustomGenre();
}

function addCustomSubgenre() {
    genreManager.addCustomSubgenre();
}

function addCustomType() {
    genreManager.addCustomType();
}

function cancelCustomGenre() {
    genreManager.cancelCustomGenre();
}

function cancelCustomSubgenre() {
    genreManager.cancelCustomSubgenre();
}

function cancelCustomType() {
    genreManager.cancelCustomType();
}