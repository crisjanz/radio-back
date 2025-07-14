// Utilities Module
// Helper functions, debounce, API calls, and general utilities

// Image URL Priority Helper
// Priority: local_image_url -> logo -> favicon
function getFaviconUrl(station, options = {}) {
    // Use priority: local_image_url -> logo -> favicon
    const imageUrl = station.local_image_url || station.logo || station.favicon;
    
    if (!imageUrl || imageUrl.trim() === '') {
        return null;
    }
    
    // If it's a Supabase URL, add cache busting if requested
    if (imageUrl.includes('supabase.co') && options.cacheBust) {
        return `${imageUrl}?t=${Date.now()}`;
    }
    
    return imageUrl;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// API Helper Functions
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

async function apiGet(url) {
    return apiRequest(url, { method: 'GET' });
}

async function apiPost(url, data) {
    return apiRequest(url, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function apiPut(url, data) {
    return apiRequest(url, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function apiDelete(url) {
    return apiRequest(url, { method: 'DELETE' });
}

// Form validation utilities
function validateRequired(value, fieldName) {
    if (!value || value.trim() === '') {
        throw new Error(`${fieldName} is required`);
    }
    return value.trim();
}

function validateUrl(url, fieldName) {
    if (!url) return '';
    
    try {
        new URL(url);
        return url;
    } catch (e) {
        throw new Error(`${fieldName} must be a valid URL`);
    }
}

function validateEmail(email, fieldName) {
    if (!email) return '';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error(`${fieldName} must be a valid email address`);
    }
    return email;
}

function validatePhone(phone, fieldName) {
    if (!phone) return '';
    
    // Basic phone validation - allows various formats
    const phoneRegex = /^[\+]?[\d\s\-\(\)\.]+$/;
    if (!phoneRegex.test(phone)) {
        throw new Error(`${fieldName} must be a valid phone number`);
    }
    return phone;
}

// String utilities
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function slugify(text) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// Date utilities
function formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString();
}

function formatDateTime(date) {
    if (!date) return '';
    return new Date(date).toLocaleString();
}

function timeAgo(date) {
    if (!date) return '';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    
    return formatDate(date);
}

// DOM utilities
function createElement(tag, className, innerHTML) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (innerHTML) element.innerHTML = innerHTML;
    return element;
}

function removeElement(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

function toggleClass(element, className) {
    if (element.classList.contains(className)) {
        element.classList.remove(className);
    } else {
        element.classList.add(className);
    }
}

// File utilities
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
}

function isImageFile(filename) {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    return imageExtensions.includes(getFileExtension(filename));
}

// URL utilities
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

function setQueryParam(param, value) {
    const url = new URL(window.location);
    url.searchParams.set(param, value);
    window.history.pushState({}, '', url);
}

function removeQueryParam(param) {
    const url = new URL(window.location);
    url.searchParams.delete(param);
    window.history.pushState({}, '', url);
}

// Local storage utilities
function setLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
}

function getLocalStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Failed to read from localStorage:', e);
        return defaultValue;
    }
}

function removeLocalStorage(key) {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.error('Failed to remove from localStorage:', e);
    }
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showSuccess('Copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        showError('Failed to copy to clipboard');
    }
}

// Download utilities
function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, filename);
    URL.revokeObjectURL(url);
}

// Array utilities
function uniqueArray(arr) {
    return [...new Set(arr)];
}

function sortArray(arr, key, direction = 'asc') {
    return arr.sort((a, b) => {
        const aVal = key ? a[key] : a;
        const bVal = key ? b[key] : b;
        
        if (direction === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });
}

function groupBy(arr, key) {
    return arr.reduce((groups, item) => {
        const group = item[key];
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(item);
        return groups;
    }, {});
}

// Object utilities
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function pick(obj, keys) {
    return keys.reduce((picked, key) => {
        if (key in obj) {
            picked[key] = obj[key];
        }
        return picked;
    }, {});
}

function omit(obj, keys) {
    return Object.keys(obj).reduce((omitted, key) => {
        if (!keys.includes(key)) {
            omitted[key] = obj[key];
        }
        return omitted;
    }, {});
}

// Modal Loading Utilities
let modalLoaded = false;

async function loadStationEditorModal() {
    // Only load if not already loaded
    if (modalLoaded || document.getElementById('station-editor-modal')) {
        return true;
    }
    
    try {
        console.log('🔄 Loading station editor modal...');
        const response = await fetch('/components/station-editor-modal.html');
        
        if (!response.ok) {
            throw new Error(`Failed to load modal: ${response.status}`);
        }
        
        // Use arrayBuffer to avoid text encoding issues
        const arrayBuffer = await response.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const modalHTML = decoder.decode(arrayBuffer);
        
        console.log(`📄 Modal HTML loaded: ${modalHTML.length} characters`);
        
        // Create a temporary container and add all HTML content
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = modalHTML;
        
        // Append all children (styles, scripts, and modal) to the document
        while (tempContainer.firstChild) {
            if (tempContainer.firstChild.nodeType === Node.ELEMENT_NODE) {
                document.body.appendChild(tempContainer.firstChild);
            } else {
                tempContainer.removeChild(tempContainer.firstChild);
            }
        }
        
        // Small delay to ensure DOM is updated
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify the modal and all required elements were loaded correctly
        const insertedModal = document.getElementById('station-editor-modal');
        const stationIdElement = document.getElementById('editor-station-id');
        const stationNameElement = document.getElementById('editor-station-name');
        
        if (!insertedModal) {
            throw new Error('Modal element not found after loading');
        }
        
        if (!stationIdElement) {
            throw new Error('Station ID element not found after loading');
        }
        
        if (!stationNameElement) {
            throw new Error('Station name element not found after loading');
        }
        
        modalLoaded = true;
        console.log('✅ Station editor modal loaded successfully');
        console.log(`📋 Modal element inserted: ${insertedModal.outerHTML.length} characters`);
        return true;
    } catch (error) {
        console.error('❌ Error loading station editor modal:', error);
        return false;
    }
}

// Ensure modal is loaded before opening
async function ensureModalLoaded() {
    if (!modalLoaded) {
        return await loadStationEditorModal();
    }
    return true;
}