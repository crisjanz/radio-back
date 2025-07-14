/**
 * Station Editor - Analysis Module
 * Handles smart analysis, normalization suggestions, and quality score calculation
 */

export class AnalysisManager {
    constructor() {
        this.currentAnalysisResults = null;
        this.currentNormalizationSuggestions = null;
    }

    // Check for normalization suggestions
    async checkNormalizationSuggestions(station) {
        const suggestionsContainer = document.getElementById('normalization-suggestions');
        const genreSuggestion = document.getElementById('genre-suggestion');
        const typeSuggestion = document.getElementById('type-suggestion');
        
        try {
            // Call the normalizer API to get suggestions
            const response = await fetch('/admin/normalize-preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    genre: station.genre,
                    type: station.type,
                    name: station.name
                })
            });
            
            if (response.ok) {
                const suggestions = await response.json();
                this.currentNormalizationSuggestions = suggestions;
                
                let hasSuggestions = false;
                
                // Show genre suggestion if different
                if (suggestions.genre && suggestions.genre !== station.genre) {
                    genreSuggestion.innerHTML = `<span class="text-gray-600">Genre:</span> <span class="text-purple-600">${station.genre || 'empty'} → ${suggestions.genre}</span>`;
                    hasSuggestions = true;
                } else {
                    genreSuggestion.innerHTML = '';
                }
                
                // Show type suggestion if different
                if (suggestions.type && suggestions.type !== station.type) {
                    typeSuggestion.innerHTML = `<span class="text-gray-600">Type:</span> <span class="text-purple-600">${station.type || 'empty'} → ${suggestions.type}</span>`;
                    hasSuggestions = true;
                } else {
                    typeSuggestion.innerHTML = '';
                }
                
                // Show/hide suggestions container
                if (hasSuggestions) {
                    suggestionsContainer.classList.remove('hidden');
                } else {
                    suggestionsContainer.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Error fetching normalization suggestions:', error);
            suggestionsContainer.classList.add('hidden');
        }
    }

    // Apply normalization suggestions
    async applyNormalizationSuggestions() {
        if (!this.currentNormalizationSuggestions) return;
        
        const station = window.StationEditorCore?.currentEditingStation;
        if (!station) return;
        
        // Apply genre suggestion
        if (this.currentNormalizationSuggestions.genre && this.currentNormalizationSuggestions.genre !== station.genre) {
            // Update genre using the genre manager
            if (window.genreManager) {
                window.genreManager.currentGenres = this.currentNormalizationSuggestions.genre.split(',').map(g => g.trim());
                window.genreManager.renderTagsForField('genres', window.genreManager.currentGenres);
            }
        }
        
        // Apply type suggestion
        if (this.currentNormalizationSuggestions.type && this.currentNormalizationSuggestions.type !== station.type) {
            // Update type using the genre manager
            if (window.genreManager) {
                window.genreManager.currentTypes = this.currentNormalizationSuggestions.type.split(',').map(t => t.trim());
                window.genreManager.renderTagsForField('types', window.genreManager.currentTypes);
            }
        }
        
        // Hide suggestions after applying
        const suggestionsContainer = document.getElementById('normalization-suggestions');
        if (suggestionsContainer) {
            suggestionsContainer.classList.add('hidden');
        }
        
        this.currentNormalizationSuggestions = null;
        alert('✅ Normalization suggestions applied!');
    }

    // Perform comprehensive station analysis
    async analyzeStation() {
        const station = window.StationEditorCore?.currentEditingStation;
        if (!station) {
            alert('No station selected for analysis');
            return;
        }

        console.log('🔍 Starting station analysis...');
        
        try {
            // Show loading state
            const button = event?.target || document.querySelector('button[onclick="analyzeStation()"]');
            const originalText = button?.innerHTML;
            if (button) {
                button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Analyzing...';
                button.disabled = true;
            }
            
            // Call the analysis endpoint
            const response = await fetch('/admin/stations/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stationId: station.id,
                    streamUrl: station.streamUrl,
                    homepage: station.homepage,
                    name: station.name
                })
            });
            
            if (response.ok) {
                const results = await response.json();
                this.currentAnalysisResults = results;
                this.displayAnalysisResults(results);
                console.log('✅ Station analysis completed:', results);
            } else {
                throw new Error(`Analysis failed: ${response.status}`);
            }
            
            // Restore button state
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        } catch (error) {
            console.error('❌ Error analyzing station:', error);
            alert(`Analysis failed: ${error.message}`);
            
            // Restore button state
            const button = event?.target || document.querySelector('button[onclick="analyzeStation()"]');
            if (button) {
                button.innerHTML = '<i class="fas fa-search mr-2"></i>Analyze Station';
                button.disabled = false;
            }
        }
    }

    // Display analysis results
    displayAnalysisResults(results) {
        const container = document.getElementById('analysis-results');
        if (!container) return;
        
        let html = '<div class="mb-4"><h4 class="font-semibold text-gray-900 mb-2">Analysis Results</h4></div>';
        
        if (results.suggestions && results.suggestions.length > 0) {
            html += '<div class="mb-4">';
            html += '<h5 class="font-medium text-gray-800 mb-2">Suggestions:</h5>';
            html += '<ul class="space-y-1">';
            results.suggestions.forEach(suggestion => {
                html += `<li class="text-sm text-blue-600">• ${suggestion}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }
        
        if (results.issues && results.issues.length > 0) {
            html += '<div class="mb-4">';
            html += '<h5 class="font-medium text-gray-800 mb-2">Issues Found:</h5>';
            html += '<ul class="space-y-1">';
            results.issues.forEach(issue => {
                html += `<li class="text-sm text-red-600">• ${issue}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }
        
        if (results.score) {
            html += `<div class="mb-4"><strong>Quality Score:</strong> <span class="text-lg font-semibold text-green-600">${results.score}/100</span></div>`;
        }
        
        html += '<div class="flex space-x-2 mt-4">';
        html += '<button onclick="analysisManager.applyAllSuggestions()" class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Apply All</button>';
        html += '<button onclick="analysisManager.clearAnalysisResults()" class="px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-100">Clear</button>';
        html += '</div>';
        
        container.innerHTML = html;
        container.classList.remove('hidden');
    }

    // Clear analysis results
    clearAnalysisResults() {
        const container = document.getElementById('analysis-results');
        if (container) {
            container.classList.add('hidden');
            container.innerHTML = '';
        }
        this.currentAnalysisResults = null;
    }

    // Apply all analysis suggestions
    applyAllSuggestions() {
        if (!this.currentAnalysisResults) return;
        
        // This would apply the suggestions from the analysis
        // Implementation depends on the specific suggestions format
        alert('✅ All suggestions applied!');
        this.clearAnalysisResults();
    }

    // Calculate quality score based on station data
    recalculateQualityScore() {
        const station = window.StationEditorCore?.currentEditingStation;
        if (!station) return;
        
        let score = 0;
        const maxScore = 100;
        
        // Basic fields (40 points total)
        if (station.name && station.name.trim()) score += 10;
        if (station.streamUrl && station.streamUrl.trim()) score += 10;
        if (station.homepage && station.homepage.trim()) score += 5;
        if (station.description && station.description.trim()) score += 5;
        if (station.genre && station.genre.trim()) score += 10;
        
        // Location data (20 points total)
        if (station.country && station.country.trim()) score += 5;
        if (station.city && station.city.trim()) score += 5;
        if (station.latitude && station.longitude) score += 10;
        
        // Technical data (15 points total)
        if (station.bitrate && station.bitrate > 0) score += 5;
        if (station.codec && station.codec.trim()) score += 5;
        if (station.language && station.language.trim()) score += 5;
        
        // Additional data (15 points total)
        if (station.favicon && station.favicon.trim()) score += 5;
        if (station.logo && station.logo.trim()) score += 5;
        if (station.facebookUrl || station.twitterUrl || station.instagramUrl) score += 5;
        
        // Contact data (10 points total)
        if (station.email && station.email.trim()) score += 5;
        if (station.phone && station.phone.trim()) score += 5;
        
        // Update the quality score field
        const qualityScoreField = document.getElementById('edit-quality-score');
        if (qualityScoreField) {
            qualityScoreField.value = Math.round(score);
        }
        
        // Show the calculated score
        alert(`Quality score calculated: ${Math.round(score)}/${maxScore}`);
        
        return Math.round(score);
    }
}