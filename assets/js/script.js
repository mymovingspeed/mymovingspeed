/**
 * My Moving Speed - Core Logic
 */

class SpeedManager {
    constructor() {
        this.speed = 0; // m/s
        this.unit = localStorage.getItem('unit') || 'km/h';
        this.mode = 'digital'; // digital or analog
        this.toolMode = 'default'; // default, car, run, bike
        this.isTracking = false;
        this.watchId = null;
        this.theme = localStorage.getItem('theme') || 'light';
        this.lang = document.documentElement.lang || 'en';
        this.translations = null;
        
        // Tool Configurations
        this.toolConfigs = {
            'default': { maxSpeed: 220, step: 20, key: 'intro_title' },
            'car': { maxSpeed: 240, step: 20, key: 'mode_car_title' },
            'run': { maxSpeed: 40, step: 5, key: 'mode_run_title' },
            'bike': { maxSpeed: 80, step: 10, key: 'mode_bike_title' }
        };

        this.init();
    }

    async init() {
        // Detect tool mode from URL
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        if (this.toolConfigs[mode]) {
            this.toolMode = mode;
        }

        // Apply theme
        document.documentElement.setAttribute('data-theme', this.theme);
        
        // Load Translations
        await this.loadTranslations();

        // Setup Event Listeners
        this.setupEventListeners();
        
        // Update UI units
        this.updateUnitUI();

        // Apply Tool Mode UI & Gauge
        this.applyToolModeUI();
        this.renderGauge();
    }

    async loadTranslations() {
        try {
            // Use relative path for language files
            const response = await fetch(`lang/${this.lang}.json?v=${new Date().getTime()}`);
            this.translations = await response.json();
            this.updateLocalizedUI();
        } catch (err) {
            // Fallback for subfolders
            try {
                const response = await fetch(`../lang/${this.lang}.json?v=${new Date().getTime()}`);
                this.translations = await response.json();
                this.updateLocalizedUI();
            } catch (err2) {
                console.error('Translation error:', err2);
            }
        }
    }

    updateLocalizedUI() {
        if (!this.translations) return;
        
        // Generic localization by data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (this.translations[key]) {
                el.textContent = this.translations[key];
            }
        });

        // Specialized localization
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.textContent = this.isTracking ? 
                (this.translations.stop || 'STOP') : (this.translations.start || 'START');
        }
            
        // Update Unit Labels
        this.updateUnitUI();
    }

    setupEventListeners() {
        // Theme Toggle
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => this.toggleTheme());
        }

        // Mode Toggles
        document.getElementById('btn-digital').addEventListener('click', () => this.setMode('digital'));
        document.getElementById('btn-analog').addEventListener('click', () => this.setMode('analog'));

        // Unit Toggles
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.setUnit(e.target.dataset.unit));
        });

        // Start/Stop
        document.getElementById('start-btn').addEventListener('click', () => this.toggleTracking());
        
        // Language Switcher
        const langSelect = document.getElementById('lang-select');
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                const newLang = e.target.value;
                const currentLang = document.documentElement.lang || 'en';
                
                if (newLang === currentLang) return;

                let newPath = '';
                if (currentLang === 'en') {
                    // We are at root, moving to subfolder or root
                    newPath = newLang === 'en' ? './' : `./${newLang}/`;
                } else {
                    // We are in a subfolder, moving to root or another subfolder
                    newPath = newLang === 'en' ? '../' : `../${newLang}/`;
                }
                
                window.location.href = newPath;
            });
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.theme);
        localStorage.setItem('theme', this.theme);
    }

    setMode(mode) {
        this.mode = mode;
        document.getElementById('btn-digital').classList.toggle('active', mode === 'digital');
        document.getElementById('btn-analog').classList.toggle('active', mode === 'analog');
        
        document.getElementById('digital-container').style.display = mode === 'digital' ? 'block' : 'none';
        document.getElementById('analog-container').style.display = mode === 'analog' ? 'block' : 'none';
    }

    setUnit(unit) {
        this.unit = unit;
        localStorage.setItem('unit', unit);
        this.updateUnitUI();
        this.updateDisplays();
    }

    updateUnitUI() {
        document.querySelectorAll('.unit-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.unit === this.unit);
        });
        
        const unitLabel = this.unit.toUpperCase();
        const mainUnit = document.getElementById('main-unit-label');
        const overlayUnit = document.getElementById('overlay-unit-label');
        
        if (mainUnit) mainUnit.textContent = unitLabel;
        if (overlayUnit) overlayUnit.textContent = unitLabel;
    }

    toggleTracking() {
        if (this.isTracking) {
            this.stopTracking();
        } else {
            this.startTracking();
        }
    }

    startTracking() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };

        this.isTracking = true;
        this.updateLocalizedUI(); // Refreshes button text
        
        const btn = document.getElementById('start-btn');
        btn.classList.add('stop');
        
        document.getElementById('accuracy-indicator').classList.add('accuracy-good');

        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.handlePosition(pos),
            (err) => this.handleError(err),
            options
        );
    }

    stopTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.isTracking = false;
        this.speed = 0;
        this.updateLocalizedUI(); // Refreshes button text
        
        const btn = document.getElementById('start-btn');
        btn.classList.remove('stop');
        document.getElementById('accuracy-indicator').classList.remove('accuracy-good');
        this.updateDisplays();
    }

    handlePosition(pos) {
        this.speed = pos.coords.speed || 0;
        document.getElementById('accuracy-val').textContent = pos.coords.accuracy.toFixed(1) + 'm';
        this.updateDisplays();
    }

    handleError(err) {
        console.error('GPS error:', err.message);
        this.stopTracking();
    }

    applyToolModeUI() {
        const config = this.toolConfigs[this.toolMode];
        if (!config || !this.translations) return;

        const titleEl = document.getElementById('hero-title');
        const descEl = document.getElementById('hero-desc');
        
        const titleKey = config.key;
        const descKey = config.key.replace('_title', '_desc');

        if (this.translations[titleKey]) titleEl.textContent = this.translations[titleKey];
        if (this.translations[descKey]) descEl.textContent = this.translations[descKey];
    }

    renderGauge() {
        const config = this.toolConfigs[this.toolMode];
        const max = config.maxSpeed;
        const step = config.step;
        const container = document.getElementById('dial-dots');
        if (!container) return;

        // Clear existing
        container.innerHTML = '';

        const minAngle = -120;
        const maxAngle = 120;
        const totalAngle = maxAngle - minAngle;

        // Draw Ticks & Numbers
        for (let s = 0; s <= max; s += step / 2) {
            const angle = minAngle + (s / max) * totalAngle;
            const isMajor = s % step === 0;
            
            // Create Tick (Circle Dot)
            const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            dot.setAttribute("cx", "150");
            dot.setAttribute("cy", "16");
            dot.setAttribute("r", isMajor ? "1.8" : "1");
            dot.className.baseVal = isMajor ? "dial-dot major" : "dial-dot";
            dot.setAttribute("transform", `rotate(${angle} 150 150)`);
            container.appendChild(dot);

            // Create Text for Major
            if (isMajor) {
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute("x", "150");
                text.setAttribute("y", "45");
                text.setAttribute("text-anchor", "middle");
                text.className.baseVal = (s === max) ? "dial-text red" : "dial-text";
                text.setAttribute("transform", `rotate(${angle} 150 150)`);
                text.textContent = s;
                container.appendChild(text);
            }
        }
    }

    convertSpeed(mps) {
        switch (this.unit) {
            case 'km/h': return mps * 3.6;
            case 'mph': return mps * 2.23694;
            case 'm/s': return mps;
            default: return mps;
        }
    }

    updateDisplays() {
        const converted = this.convertSpeed(this.speed);
        const rounded = Math.round(converted);

        // Update Digital
        const speedVal = document.getElementById('speed-val');
        if (speedVal) speedVal.textContent = rounded;
        
        // Update Analog
        const overlay = document.getElementById('analog-speed-overlay');
        if (overlay) overlay.textContent = rounded;
        this.rotateNeedle(converted);

        // Pulsing behavior
        const card = document.querySelector('.tool-card');
        if (card) {
            card.classList.toggle('is-moving', this.speed > 0.5);
        }
    }

    rotateNeedle(speed) {
        const config = this.toolConfigs[this.toolMode];
        const maxSpeed = config.maxSpeed;
        const minAngle = -120;
        const maxAngle = 120;
        
        const clampedSpeed = Math.min(speed, maxSpeed);
        const angle = minAngle + (clampedSpeed / maxSpeed) * (maxAngle - minAngle);
        
        const needle = document.getElementById('needle');
        if (needle) {
            needle.style.transform = `rotate(${angle}deg)`;
        }
    }
}

// Initializing the app
document.addEventListener('DOMContentLoaded', () => {
    window.speedManager = new SpeedManager();
});

