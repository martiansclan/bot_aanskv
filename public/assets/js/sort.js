// public/assets/js/sort.js
class SortModule {
    constructor() {
        this.apiBaseUrl = '/api/sort';
        this.currentFilters = {
            synergyLevels: [],
            rarityLevels: [],
            attributeFilters: {},
            attributeValues: [],
            saleFilter: 'all'
        };
        this.currentPage = 1; // Всегда начинаем с 1
        this.totalPages = 1;
        this.filterOptions = {};
        
        this.init();
    }
    
    async init() {
        console.log('🔍 Инициализация модуля сортировки...');
        
        try {
            await this.loadFilterOptions();
            this.setupEventListeners();
            this.updateSelectedFiltersDisplay();
            
            // Скрываем панель фильтров при старте
            this.updateFiltersPanelVisibility();
            
        } catch (error) {
            console.error('Ошибка инициализации:', error);
            this.showError('Не удалось загрузить данные для сортировки');
        }
    }
    
    async loadFilterOptions() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/filter-options`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                this.filterOptions = result.data;
                this.populateAllFilterOptions();
                document.getElementById('initialLoading').style.display = 'none';
                document.getElementById('resultsContent').style.display = 'block';
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
            
        } catch (error) {
            console.error('Ошибка загрузки опций фильтрации:', error);
            throw error;
        }
    }
    
    populateAllFilterOptions() {
        // 1. Заполняем уровни синергий
        this.populateFilterContainer('synergyOptions', this.filterOptions.synergyLevels, 'synergyLevels');
        
        // 2. Заполняем уровни редкости
        this.populateFilterContainer('rarityOptions', this.filterOptions.rarityLevels, 'rarityLevels');
        
        // 3. Создаем динамические категории атрибутов
        this.createDynamicCategories();
        
        // 4. Заполняем "По атрибутам"
        this.populateAllAttributes();
        
        // 5. Настраиваем поиск по атрибутам
        this.setupAttributeSearch();
    }
    
    createDynamicCategories() {
        const container = document.getElementById('dynamicCategories');
        if (!container || !this.filterOptions.attributeCategories) return;
        
        container.innerHTML = '';
        
        const sortedCategories = Object.keys(this.filterOptions.attributeCategories)
            .sort((a, b) => a.localeCompare(b));
        
        sortedCategories.forEach(category => {
            const values = this.filterOptions.attributeCategories[category] || [];
            
            const categoryHtml = `
                <div class="filter-section">
                    <div class="filter-header" data-filter="${category}">
                        <h3 class="filter-title">${this.getCategoryIcon(category)} ${category}</h3>
                        <span class="filter-arrow">▼</span>
                    </div>
                    <div class="filter-content" id="${category}Filter">
                        ${values.length === 0 ? 
                            '<p style="color: #999; text-align: center; padding: 10px;">Нет данных</p>' : 
                            `<div class="checkbox-group" data-category="${category}">
                                ${values.map(value => `
                                    <label class="checkbox-item">
                                        <input type="checkbox" 
                                               name="category_${category}" 
                                               value="${value}"
                                               ${this.isCategoryValueSelected(category, value) ? 'checked' : ''}>
                                        <span class="checkbox-custom"></span>
                                        <span class="checkbox-label">${value}</span>
                                    </label>
                                `).join('')}
                            </div>`
                        }
                    </div>
                </div>
            `;
            
            container.innerHTML += categoryHtml;
        });
    }
    
    getCategoryIcon(category) {
        const icons = {
            'Skin Tone': '🎨',
            'Earrings': '💎',
            'Earring': '💎',
            'Bracelet': '📿',
            'Cup': '🏆',
            'Glasses': '👓',
            'Pendant Chain': '⛓️',
            'Armor': '🛡️',
            'Heart': '❤️',
            'Cap': '🧢',
            'Ring': '💍',
            'Sign': '📜',
            'Stick': '🏑',
            'Hamster': '🐹'
        };
        
        return icons[category] || '🏷️';
    }
    
    populateFilterContainer(containerId, options, filterName) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        (options || []).forEach(option => {
            const isChecked = this.currentFilters[filterName]?.includes(option) || false;
            container.innerHTML += `
                <label class="checkbox-item">
                    <input type="checkbox" 
                           name="${filterName}" 
                           value="${option}"
                           ${isChecked ? 'checked' : ''}>
                    <span class="checkbox-custom"></span>
                    <span class="checkbox-label">${option}</span>
                </label>
            `;
        });
    }
    
    populateAllAttributes() {
        const container = document.getElementById('allAttributesOptions');
        if (!container || !this.filterOptions.allAttributeValues) return;
        
        container.innerHTML = '';
        
        this.filterOptions.allAttributeValues.forEach(value => {
            const isChecked = this.currentFilters.attributeValues.includes(value);
            container.innerHTML += `
                <label class="checkbox-item">
                    <input type="checkbox" 
                           name="attributeValues" 
                           value="${value}"
                           ${isChecked ? 'checked' : ''}>
                    <span class="checkbox-custom"></span>
                    <span class="checkbox-label">${value}</span>
                </label>
            `;
        });
    }
    
    setupAttributeSearch() {
        const searchInput = document.getElementById('attributeSearch');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const checkboxes = document.querySelectorAll('#allAttributesOptions .checkbox-item');
            
            checkboxes.forEach(checkbox => {
                const label = checkbox.querySelector('.checkbox-label');
                if (label) {
                    const text = label.textContent.toLowerCase();
                    checkbox.style.display = text.includes(searchTerm) ? 'flex' : 'none';
                }
            });
        });
    }
    
    setupEventListeners() {
        // Кнопка применения фильтров
        const applyBtn = document.getElementById('applyBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.executeSort());
        }
        
        // Кнопка глобального поиска
        const globalSearchBtn = document.getElementById('globalSearchBtn');
        if (globalSearchBtn) {
            globalSearchBtn.addEventListener('click', () => this.handleGlobalSearch());
        }
        
        // Поиск по Enter
        const globalSearchInput = document.getElementById('globalSearch');
        if (globalSearchInput) {
            globalSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleGlobalSearch();
                }
            });
        }
        
        // Кнопка очистки фильтров
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAllFilters());
        }
        
        // Кнопка сворачивания фильтров
        const toggleBtn = document.getElementById('toggleFiltersBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleFilters());
        }
        
        // Делегирование событий для дропдаунов фильтров
        document.addEventListener('click', (e) => {
            // Обработка кликов на заголовки фильтров
            if (e.target.closest('.filter-header')) {
                const header = e.target.closest('.filter-header');
                const filterType = header.getAttribute('data-filter');
                const content = document.getElementById(`${filterType}Filter`);
                if (content) {
                    content.classList.toggle('show');
                    const arrow = header.querySelector('.filter-arrow');
                    if (arrow) {
                        arrow.textContent = content.classList.contains('show') ? '▲' : '▼';
                    }
                }
            }
            
            // Обработка удаления фильтров
            if (e.target.classList.contains('remove-filter')) {
                const type = e.target.getAttribute('data-type');
                const category = e.target.getAttribute('data-category') || '';
                const value = e.target.getAttribute('data-value');
                this.removeFilter(type, category, value);
            }
        });
        
        // Изменения в фильтрах
        document.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox' || e.target.type === 'radio') {
                this.updateCurrentFilters();
                this.updateSelectedFiltersDisplay();
                this.updateFiltersPanelVisibility();
            }
        });
    }
    
    updateCurrentFilters() {
        const filters = {
            synergyLevels: this.getCheckedValues('synergyLevels'),
            rarityLevels: this.getCheckedValues('rarityLevels'),
            attributeValues: this.getCheckedValues('attributeValues'),
            saleFilter: this.getSelectedRadioValue('saleFilter'),
            attributeFilters: this.getCategoryFilters()
        };
        
        this.currentFilters = filters;
        console.log('Обновленные фильтры:', filters);
    }
    
    getCategoryFilters() {
        const categoryFilters = {};
        
        if (!this.filterOptions.attributeCategories) return categoryFilters;
        
        Object.keys(this.filterOptions.attributeCategories).forEach(category => {
            const values = this.getCheckedValues(`category_${category}`);
            if (values.length > 0) {
                categoryFilters[category] = values;
            }
        });
        
        return categoryFilters;
    }
    
    isCategoryValueSelected(category, value) {
        return this.currentFilters.attributeFilters?.[category]?.includes(value) || false;
    }
    
    getCheckedValues(name) {
        const checkboxes = document.querySelectorAll(`input[name="${name}"]:checked`);
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    getSelectedRadioValue(name) {
        const radio = document.querySelector(`input[name="${name}"]:checked`);
        return radio ? radio.value : 'all';
    }
    
    updateFiltersPanelVisibility() {
        const resultsHeader = document.getElementById('resultsHeader');
        const selectedFilters = this.getAllSelectedFilters();
        
        if (!resultsHeader) return;
        
        if (selectedFilters.length === 0) {
            resultsHeader.style.display = 'none';
        } else {
            resultsHeader.style.display = 'block';
        }
    }
    
    updateSelectedFiltersDisplay() {
        const container = document.getElementById('selectedFilters');
        if (!container) return;
        
        const selected = this.getAllSelectedFilters();
        
        if (selected.length === 0) {
            container.innerHTML = '<p class="no-filters">Фильтры не выбраны</p>';
            return;
        }
        
        let html = '';
        selected.forEach(filter => {
            const label = this.getFilterLabel(filter);
            html += `
                <div class="selected-filter">
                    <span class="filter-label">${label}</span>
                    <button class="remove-filter" 
                            data-type="${filter.type}"
                            data-category="${filter.category || ''}"
                            data-value="${filter.value}">×</button>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    getAllSelectedFilters() {
        const selected = [];
        
        // Синергии
        this.currentFilters.synergyLevels.forEach(value => {
            selected.push({ type: 'synergy', value });
        });
        
        // Редкость
        this.currentFilters.rarityLevels.forEach(value => {
            selected.push({ type: 'rarity', value });
        });
        
        // Категории атрибутов
        Object.entries(this.currentFilters.attributeFilters).forEach(([category, values]) => {
            values.forEach(value => {
                selected.push({ type: 'category', category, value });
            });
        });
        
        // Отдельные атрибуты
        this.currentFilters.attributeValues.forEach(value => {
            selected.push({ type: 'attribute', value });
        });
        
        // Фильтр продажи
        if (this.currentFilters.saleFilter !== 'all') {
            selected.push({ type: 'sale', value: this.currentFilters.saleFilter });
        }
        
        return selected;
    }
    
    getFilterLabel(filter) {
        const icons = {
            synergy: '🎯',
            rarity: '⭐',
            category: '🏷️',
            attribute: '🔍',
            sale: '💰'
        };
        
        const icon = icons[filter.type] || '🏷️';
        
        if (filter.type === 'category') {
            return `${icon} ${filter.category}: ${filter.value}`;
        }
        
        return `${icon} ${filter.value}`;
    }
    
    removeFilter(type, category, value) {
        let checkbox;
        
        if (type === 'category') {
            checkbox = document.querySelector(`input[name="category_${category}"][value="${value}"]`);
        } else if (type === 'synergy') {
            checkbox = document.querySelector(`input[name="synergyLevels"][value="${value}"]`);
        } else if (type === 'rarity') {
            checkbox = document.querySelector(`input[name="rarityLevels"][value="${value}"]`);
        } else if (type === 'attribute') {
            checkbox = document.querySelector(`input[name="attributeValues"][value="${value}"]`);
        } else if (type === 'sale') {
            const saleAllRadio = document.querySelector('input[name="saleFilter"][value="all"]');
            if (saleAllRadio) saleAllRadio.checked = true;
        }
        
        if (checkbox) {
            checkbox.checked = false;
        }
        
        this.updateCurrentFilters();
        this.updateSelectedFiltersDisplay();
        this.updateFiltersPanelVisibility();
    }
    
    handleGlobalSearch() {
        const searchInput = document.getElementById('globalSearch');
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.trim();
        if (!searchTerm) return;
        
        console.log('Глобальный поиск:', searchTerm);
        // Сбрасываем страницу на 1 при новом поиске
        this.currentPage = 1;
        this.executeSort();
    }
    
    toggleFilters() {
        const filtersBody = document.getElementById('filtersBody');
        const toggleBtn = document.getElementById('toggleFiltersBtn');
        const toggleIcon = document.querySelector('.toggle-icon');
        const toggleText = document.querySelector('.toggle-text');
        
        if (filtersBody && toggleBtn && toggleIcon && toggleText) {
            const isVisible = filtersBody.style.display !== 'none';
            
            if (isVisible) {
                filtersBody.style.display = 'none';
                toggleIcon.textContent = '▶';
                toggleText.textContent = 'Развернуть';
                toggleBtn.title = 'Показать фильтры';
            } else {
                filtersBody.style.display = 'block';
                toggleIcon.textContent = '▼';
                toggleText.textContent = 'Свернуть';
                toggleBtn.title = 'Скрыть фильтры';
            }
        }
    }
    
    clearAllFilters() {
        // Сбрасываем все чекбоксы
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
        
        // Сбрасываем радиокнопки
        const saleAllRadio = document.querySelector('input[name="saleFilter"][value="all"]');
        if (saleAllRadio) saleAllRadio.checked = true;
        
        // Сбрасываем поиск
        const searchInput = document.getElementById('attributeSearch');
        if (searchInput) searchInput.value = '';
        
        // Сбрасываем глобальный поиск
        const globalSearchInput = document.getElementById('globalSearch');
        if (globalSearchInput) globalSearchInput.value = '';
        
        // Показываем все атрибуты
        document.querySelectorAll('#allAttributesOptions .checkbox-item').forEach(item => {
            item.style.display = 'flex';
        });
        
        // Обновляем фильтры
        this.updateCurrentFilters();
        this.updateSelectedFiltersDisplay();
        this.updateFiltersPanelVisibility();
        
        // Очищаем результаты
        this.clearResults();
        
        this.showMessage('Все фильтры очищены');
    }
    
    clearResults() {
        const statsContainer = document.getElementById('resultsStats');
        const gridContainer = document.getElementById('resultsGrid');
        const paginationContainer = document.getElementById('pagination');
        
        if (statsContainer) statsContainer.innerHTML = '';
        if (gridContainer) gridContainer.innerHTML = '';
        if (paginationContainer) paginationContainer.innerHTML = '';
    }
    
    async executeSort() {
        try {
            this.showLoading();
            
            // Сбрасываем страницу на 1 при новом поиске
            this.currentPage = 1;
            
            const searchQuery = document.getElementById('globalSearch')?.value || '';
            
            const response = await fetch(`${this.apiBaseUrl}/sort`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filters: this.currentFilters,
                    page: this.currentPage,
                    searchQuery: searchQuery // Добавляем поисковый запрос
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.displayResults(result);
            } else {
                throw new Error(result.error || 'Неизвестная ошибка');
            }
            
        } catch (error) {
            console.error('Ошибка сортировки:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }
    
    displayResults(result) {
        const statsContainer = document.getElementById('resultsStats');
        const gridContainer = document.getElementById('resultsGrid');
        const paginationContainer = document.getElementById('pagination');
        
        if (!statsContainer || !gridContainer || !paginationContainer) return;
        
        const stats = result.pagination || {};
        statsContainer.innerHTML = `
            <div class="stats-card">
                <h3>📊 Результаты поиска</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">Найдено NFT:</span>
                        <span class="stat-value">${stats.totalNFTs || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Страниц:</span>
                        <span class="stat-value">${stats.totalPages || 1}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Текущая страница:</span>
                        <span class="stat-value">${stats.currentPage || 1}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Фильтров:</span>
                        <span class="stat-value">${this.getAllSelectedFilters().length}</span>
                    </div>
                </div>
            </div>
        `;
        
        const nfts = result.data || [];
        if (nfts.length === 0) {
            gridContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>NFT не найдены</h3>
                    <p>Попробуйте изменить параметры фильтрации</p>
                    <button onclick="window.sortModule.clearAllFilters()" class="clear-btn">
                        🗑️ Очистить все фильтры
                    </button>
                </div>
            `;
        } else {
            gridContainer.innerHTML = '';
            nfts.forEach(nft => {
                const nftCard = this.createNFTCard(nft);
                gridContainer.appendChild(nftCard);
            });
        }
        
        this.renderPagination(stats);
    }
    
    createNFTCard(nft) {
        const card = document.createElement('div');
        card.className = 'nft-card';
        
        const synergyAttrs = nft.synergy_attributes || [];
        
        // Форматируем атрибуты, добавляя звёздочки для синергийных
        const attributesHtml = this.formatAttributes(nft.attributes, synergyAttrs);
        
        card.innerHTML = `
            <div class="nft-image">
                ${nft.image_url ? 
                    `<img src="${nft.image_url}" alt="${nft.name || 'NFT'}" loading="lazy">` : 
                    `<div class="no-image">🖼️</div>`}
            </div>
            <div class="nft-info">
                <h4 class="nft-name">${nft.display_name || nft.name || `NFT #${nft.index || 'Unknown'}`}</h4>
                <div class="nft-power">
                    <span class="power-total">⚡ ${nft.power_total || 0}</span>
                    <span class="power-synergy">✨ ${nft.synergy_power || 0}</span>
                </div>
                <div class="nft-attributes">
                    ${attributesHtml}
                </div>
            </div>
        `;
        
        return card;
    }
    
    formatAttributes(attributes, synergyAttrs) {
        if (!attributes || !Array.isArray(attributes)) {
            return '<p class="no-attributes">Нет атрибутов</p>';
        }
        
        return attributes.slice(0, 4).map(attr => {
            const isSynergy = synergyAttrs.includes(attr.value);
            const starIcon = isSynergy ? ' ⭐' : '';
            
            return `
                <div class="attribute ${isSynergy ? 'synergy-attribute' : ''}">
                    <span class="attr-label">${attr.trait_type}:</span>
                    <span class="attr-value">
                        ${attr.value} 
                        ${starIcon}
                        ${attr.rarity ? `<span class="attr-rarity">(${attr.rarity})</span>` : ''}
                    </span>
                </div>
            `;
        }).join('');
    }
    
    renderPagination(stats) {
        const container = document.getElementById('pagination');
        if (!container) return;
        
        const currentPage = stats.currentPage || 1;
        const totalPages = stats.totalPages || 1;
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '<div class="pagination-controls">';
        
        if (currentPage > 1) {
            html += `<button class="page-btn" data-page="${currentPage - 1}">← Назад</button>`;
        }
        
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        
        if (currentPage < totalPages) {
            html += `<button class="page-btn" data-page="${currentPage + 1}">Вперед →</button>`;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-btn')) {
                const page = parseInt(e.target.getAttribute('data-page'));
                if (page && page !== this.currentPage) {
                    this.currentPage = page;
                    this.executeSort();
                }
            }
        });
    }
    
    showLoading() {
        const applyBtn = document.getElementById('applyBtn');
        if (applyBtn) {
            applyBtn.disabled = true;
            applyBtn.innerHTML = '⏳ Применяю...';
        }
    }
    
    hideLoading() {
        const applyBtn = document.getElementById('applyBtn');
        if (applyBtn) {
            applyBtn.disabled = false;
            applyBtn.innerHTML = '🚀 Применить фильтры';
        }
    }
    
    showError(message) {
        const resultsArea = document.getElementById('resultsArea');
        if (!resultsArea) return;
        
        resultsArea.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <h3>Ошибка</h3>
                <p>${message}</p>
                <button onclick="location.reload()" class="refresh-btn">🔄 Обновить страницу</button>
            </div>
        `;
    }
    
    showMessage(message) {
        // Временное уведомление
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 15px 25px;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                z-index: 1000;
                animation: slideIn 0.3s ease;
            ">
                ${message}
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Добавляем стили для уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    window.sortModule = new SortModule();
});