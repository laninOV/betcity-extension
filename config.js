// Configuration file for Tennis Stats Calculator
// Advanced users can modify these settings

const DEFAULT_SETTINGS = {
    // Formula coefficients
    tau: 0.05,          // Exponential decay rate
    matchCount: 5,      // Number of recent matches to analyze
    fMax: 5,           // Maximum handicap value

    // Contribution coefficients
    a1: 1.0,           // Win coefficient
    a2: 0.5,           // Sets ratio coefficient  
    a3: 0.3,           // Points ratio coefficient
    a4: 0.2,           // Handicap coefficient

    // Parsing settings
    requestDelay: 1000, // Delay between requests (ms)
    maxRetries: 3,      // Maximum retry attempts
    timeout: 10000,     // Request timeout (ms)

    // UI settings
    showInlineResults: true,  // Show results directly on page
    autoCalculate: false,     // Auto-calculate on page load
    exportFormat: 'csv',      // Export format: 'csv', 'json'

    // Debug settings
    debugMode: false,         // Enable debug logging
    verboseLogging: false     // Detailed logging
};

// CSS selectors for different site layouts
const SELECTORS = {
    // Main live table
    matchRows: [
        'tr[class*="event"]',
        '.live-event',
        '.match-row',
        'tr.event'
    ],

    // Player names
    playerNames: [
        '.player-name',
        '.team-name',
        '.participant'
    ],

    // Statistics links
    statsLinks: [
        'a[href*="/mstat/"]',
        'a[href*="/statistics/"]',
        '.stats-link'
    ],

    // Match tables on stats pages
    matchTables: [
        'table.matches',
        '.match-history table',
        '.statistics-table'
    ]
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DEFAULT_SETTINGS, SELECTORS };
}