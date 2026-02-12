document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const loadRealDataBtn = document.getElementById('loadRealData');
    const optimizeBtn = document.getElementById('optimize');
    const stopOptimizationBtn = document.getElementById('stopOptimization');
    const resetBtn = document.getElementById('reset');
    const playersContainer = document.getElementById('playersContainer');
    const exchangesList = document.getElementById('exchangesList');
    const totalPowerEl = document.getElementById('totalPower');
    const improvementEl = document.getElementById('improvement');
    const exchangesCountEl = document.getElementById('exchangesCount');
    const playerCountEl = document.getElementById('playerCount');
    const totalCardsEl = document.getElementById('totalCards');
    const skinToneOptions = document.getElementById('skinToneOptions');
    const calculationStatus = document.getElementById('calculationStatus');
    const statusText = document.getElementById('statusText');
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const timeElapsed = document.getElementById('timeElapsed');
    
    // Поля настроек
    const maxIterationsInput = document.getElementById('maxIterations');
    const timeoutSecondsInput = document.getElementById('timeoutSeconds');
    const algorithmSelect = document.getElementById('algorithmSelect');
    
    // Модальное окно
    const modal = document.getElementById('exchangeDetailsModal');
    const modalClose = modal ? modal.querySelector('.close') : null;
    const exchangeDetails = document.getElementById('exchangeDetails');
    
    // Шаблоны
    const playerTemplate = document.getElementById('playerTemplate');
    const teamOrcTemplate = document.getElementById('teamOrcTemplate');
    const cardTemplate = document.getElementById('cardTemplate');
    const exchangeTemplate = document.getElementById('exchangeTemplate');
    
    // Текущие данные
    let currentPlayers = [];
    let currentOptimization = null;
    let currentSkinTone = 'Martian';
    let availableSkinTones = [];
    let playersOriginalData = {};
    
    // Контроль вычислений
    let calculationController = null;
    let calculationStartTime = null;
    let progressInterval = null;
    let isCalculationRunning = false;
    
    // Глобальные константы (будут загружены с сервера)
    let constants = {
        LOGO_TRAIT_TYPES: ['Cup', 'Glasses', 'Pendant Chain', 'Heart', 'Cap', 'Ring', 'Hamster'],
        LOGO_VALUES: ['Zargates Business', 'Zargates', 'Telegram', 'Tribo Games', 'Bitcoin', 'Professor TON', 'TON', 'ETH', 'RUB', 'Dollar', 'Elephant'],
        LOGO_EQUIVALENTS_FOR_GROUPING: {
            'Professor TON': 'TON',
            'Zargates Business': 'Zargates'
        }
    };

    // Типы орков для отображения
    const orcTypeNames = {
        1: 'Wen TGE',
        2: 'Greeting',
        3: 'Shoked',
        4: 'In Love',
        5: 'Capped',
        6: 'To The Moon',
        7: 'Do Something'
    };
    
    // Цвета для типов орков
    const typeColors = {
        1: '#dc3545',    // Wen TGE - красный
        2: '#28a745',    // Greeting - зеленый
        3: '#17a2b8',    // Shoked - голубой
        4: '#ffc107',    // In Love - желтый
        5: '#6f42c1',    // Capped - фиолетовый
        6: '#fd7e14',    // To The Moon - оранжевый
        7: '#20c997'     // Do Something - бирюзовый
    };

    // ================ ФУНКЦИИ ДЛЯ РАБОТЫ С ЭКВИВАЛЕНТНОСТЬЮ ЛОГОТИПОВ ================

    /**
     * Функция для проверки соответствия значений с учетом правил эквивалентности
     */
    function valuesMatchWithGrouping(value1, value2) {
        if (!value1 || !value2) return false;
        
        const str1 = value1.toString().trim();
        const str2 = value2.toString().trim();
        
        // Прямое совпадение
        if (str1 === str2) return true;
        
        // Проверяем по правилам эквивалентности из констант
        const equivalents = constants.LOGO_EQUIVALENTS_FOR_GROUPING || {};
        
        // Если value1 эквивалентно value2
        if (equivalents[str1] === str2) return true;
        
        // Если value2 эквивалентно value1
        if (equivalents[str2] === str1) return true;
        
        // Если оба значения эквивалентны одному и тому же
        if (equivalents[str1] && equivalents[str2] && equivalents[str1] === equivalents[str2]) return true;
        
        return false;
    }

    /**
     * Функция для получения нормализованного значения для группы
     */
    function getNormalizedValue(value) {
        if (!value) return value;
        const str = value.toString().trim();
        const equivalents = constants.LOGO_EQUIVALENTS_FOR_GROUPING || {};
        return equivalents[str] || str;
    }

    /**
     * Проверяет, является ли значение частью бонусной группы
     */
    function isValueInBonusGroup(bonusDetails, value, groupType) {
        if (!bonusDetails || !bonusDetails[groupType]) return false;
        
        return bonusDetails[groupType].some(detail => {
            // Проверяем прямое совпадение с нормализованным значением группы
            if (valuesMatchWithGrouping(detail.value, value)) {
                return true;
            }
            
            // Проверяем по оригинальным значениям
            if (detail.originalValues) {
                const originalValuesArray = Array.isArray(detail.originalValues) 
                    ? detail.originalValues 
                    : Array.from(detail.originalValues || []);
                return originalValuesArray.some(origVal => 
                    valuesMatchWithGrouping(origVal, value)
                );
            }
            
            return false;
        });
    }

    // ================ ИНИЦИАЛИЗАЦИЯ ================

    // Инициализация
    init();
    
    async function init() {
        // Загружаем константы
        await loadConstants();
        
        // Проверяем доступность модуля
        await checkModuleHealth();
        
        // Загружаем доступные Skin Tone
        await loadAvailableSkinTones();
        
        // Назначаем обработчики событий
        if (loadRealDataBtn) {
            loadRealDataBtn.addEventListener('click', loadRealData);
        }
        
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', optimizeExchanges);
        }
        
        if (stopOptimizationBtn) {
            stopOptimizationBtn.addEventListener('click', stopOptimization);
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', resetData);
        }
        
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                if (modal) modal.style.display = 'none';
            });
        }
        
        // Закрытие модального окна при клике вне его
        if (modal) {
            window.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        // Автоматически загружаем данные при загрузке страницы
        if (loadRealDataBtn) {
            setTimeout(() => loadRealDataBtn.click(), 500);
        }
    }
    
    // Функция загрузки констант
    async function loadConstants() {
        try {
            const response = await fetch('/api/orc-exchange/info');
            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data.constants) {
                    constants = result.data.constants;
                    console.log('✅ Константы загружены:', constants);
                }
            }
        } catch (error) {
            console.warn('⚠️ Не удалось загрузить константы, используем локальные:', error);
        }
    }
    
    // Функция для получения названия алгоритма
    function getAlgorithmName(algo) {
        const names = {
            'fast': 'Быстрая оптимизация',
            'synergy': 'Синергетическая оптимизация',
            'genetic': 'Генетический алгоритм',
            'step': 'Пошаговая оптимизация'
        };
        return names[algo] || 'Оптимизация';
    }
    
    // Загрузка доступных Skin Tone
    async function loadAvailableSkinTones() {
        try {
            const response = await fetch('/api/orc-exchange/available-skin-tones');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    availableSkinTones = result.data.availableSkinTones || [];
                    renderSkinToneOptions();
                }
            }
        } catch (error) {
            console.warn('Не удалось загрузить Skin Tone, используем по умолчанию:', error);
            // Используем дефолтные значения
            availableSkinTones = ['Golden', 'Lunar', 'Cosmic', 'Demonic', 'Cavern', 'Desert', 
                'Fairytale', 'Martian', 'Magical', 'Silver', 'Forest', 'Urban', 'Beach', 
                'Mountain', 'Meadow', 'Swamp', 'Tropical', 'Taiga'];
            renderSkinToneOptions();
        }
    }
    
    // Отрисовка опций Skin Tone
    function renderSkinToneOptions() {
        if (!skinToneOptions) return;
        
        skinToneOptions.innerHTML = '';
        
        if (availableSkinTones.length === 0) {
            skinToneOptions.innerHTML = '<div class="loading-skin-tones">Нет доступных Skin Tone</div>';
            return;
        }
        
        availableSkinTones.forEach(skinTone => {
            const option = document.createElement('div');
            option.className = `skin-tone-option ${skinTone === currentSkinTone ? 'selected' : ''}`;
            option.innerHTML = `
                <input type="radio" name="skinTone" value="${skinTone}" id="skinTone-${skinTone}" ${skinTone === currentSkinTone ? 'checked' : ''}>
                <label for="skinTone-${skinTone}">${skinTone}</label>
            `;
            
            option.addEventListener('click', (e) => {
                // Предотвращаем двойной клик
                if (e.target.tagName === 'INPUT') return;
                
                // Снимаем выделение со всех опций
                document.querySelectorAll('.skin-tone-option').forEach(opt => {
                    opt.classList.remove('selected');
                    const input = opt.querySelector('input');
                    if (input) input.checked = false;
                });
                
                // Выделяем выбранную опцию
                option.classList.add('selected');
                const input = option.querySelector('input');
                if (input) input.checked = true;
                
                // Обновляем текущий Skin Tone
                currentSkinTone = skinTone;
                
                // Перезагружаем данные с новым фильтром
                if (currentPlayers.length > 0 || loadRealDataBtn) {
                    loadRealData();
                }
            });
            
            skinToneOptions.appendChild(option);
        });
    }
    
    // Проверка здоровья модуля
    async function checkModuleHealth() {
        try {
            const response = await fetch('/api/orc-exchange/health');
            if (response.ok) {
                const result = await response.json();
                console.log('Модуль обмена орками доступен:', result);
                return true;
            }
        } catch (error) {
            console.warn('Модуль обмена орками недоступен:', error.message);
        }
        return false;
    }
    
    // Загрузка реальных данных
    async function loadRealData() {
        try {
            if (loadRealDataBtn) {
                loadRealDataBtn.disabled = true;
                loadRealDataBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
            }
            
            const response = await fetch(`/api/orc-exchange/real-data?skinTone=${encodeURIComponent(currentSkinTone)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                currentPlayers = result.data;
                console.log('Получены данные игроков:', currentPlayers);
                
                playersOriginalData = {}; // Сбрасываем сохраненные данные
                
                // Сохраняем оригинальные данные с nftData
                currentPlayers.forEach((player, index) => {
                    playersOriginalData[player.id] = {
                        cards: [...player.cards],
                        team: player.team ? {...player.team} : null,
                        teamPower: player.teamPower,
                        canFormTeam: player.canFormTeam
                    };
                });
                
                currentSkinTone = result.selectedSkinTone || currentSkinTone;
                availableSkinTones = result.availableSkinTones || availableSkinTones;
                
                renderPlayersWithTable();
                updateSummary();
                if (optimizeBtn) optimizeBtn.disabled = false;
                clearExchanges();
                
                showNotification(`✅ Загружены данные ${result.playerCount} игроков с ${result.totalCards} NFT карточками (Skin Tone: ${currentSkinTone})`, 'success');
            } else {
                showNotification(`❌ Ошибка загрузки данных: ${result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`❌ Ошибка сети: ${error.message}`, 'error');
            console.error('Error details:', error);
        } finally {
            if (loadRealDataBtn) {
                loadRealDataBtn.disabled = false;
                loadRealDataBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Загрузить данные NFT';
            }
        }
    }
    
    // Начать вычисления
    function startCalculation() {
        isCalculationRunning = true;
        calculationStartTime = Date.now();
        
        // Показываем элементы контроля
        if (calculationStatus) {
            calculationStatus.style.display = 'flex';
        }
        
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        
        if (stopOptimizationBtn) {
            stopOptimizationBtn.style.display = 'inline-block';
            stopOptimizationBtn.disabled = false;
        }
        
        if (optimizeBtn) {
            optimizeBtn.disabled = true;
        }
        
        // Запускаем обновление прогресса
        updateProgress();
        progressInterval = setInterval(updateProgress, 500);
    }
    
    // Остановить вычисления
    function stopCalculation() {
        isCalculationRunning = false;
        
        // Очищаем интервал прогресса
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        
        // Прячем элементы контроля
        if (calculationStatus) {
            calculationStatus.style.display = 'none';
        }
        
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
        
        if (stopOptimizationBtn) {
            stopOptimizationBtn.style.display = 'none';
            stopOptimizationBtn.disabled = true;
        }
        
        if (optimizeBtn) {
            optimizeBtn.disabled = false;
            optimizeBtn.innerHTML = '<i class="fas fa-magic"></i> Оптимизировать обмены';
        }
        
        // Отменяем запрос, если он есть
        if (calculationController) {
            calculationController.abort();
            calculationController = null;
        }
        
        showNotification('Расчет остановлен пользователем', 'warning');
    }
    
    // Обновить прогресс
    function updateProgress() {
        if (!isCalculationRunning) return;
        
        const elapsed = Date.now() - calculationStartTime;
        const elapsedSeconds = Math.floor(elapsed / 1000);
        
        // Обновляем время
        if (timeElapsed) {
            const minutes = Math.floor(elapsedSeconds / 60);
            const seconds = elapsedSeconds % 60;
            timeElapsed.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Обновляем прогресс-бар (основано на времени)
        const timeout = timeoutSecondsInput ? parseInt(timeoutSecondsInput.value) : 30;
        const progress = Math.min(95, (elapsedSeconds / timeout) * 100);
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
        
        // Обновляем статус
        if (statusText) {
            const algorithm = algorithmSelect ? algorithmSelect.value : 'fast';
            statusText.textContent = `${getAlgorithmName(algorithm)}... ${elapsedSeconds} сек`;
        }
    }
    
    // Оптимизация обменов с выбором алгоритма
    async function optimizeExchanges() {
        const maxIterations = maxIterationsInput ? parseInt(maxIterationsInput.value) : 50;
        const algorithm = algorithmSelect ? algorithmSelect.value : 'fast';
        const timeout = timeoutSecondsInput ? parseInt(timeoutSecondsInput.value) * 1000 : 30000;
        
        if (!currentPlayers || currentPlayers.length === 0) {
            showNotification('❌ Сначала загрузите данные игроков', 'warning');
            return;
        }
        
        const requestData = {
            players: currentPlayers.map(player => ({
                id: player.id,
                name: player.name,
                cards: player.cards.map(card => ({
                    id: card.id,
                    type: card.type,
                    typeName: card.typeName,
                    power: card.power,
                    earrings: card.earrings,
                    logo: card.logos,
                    bracelet: card.bracelet,
                    nftData: card.nftData || null
                }))
            })),
            maxIterations,
            algorithm
        };
        
        try {
            // Начинаем вычисления
            startCalculation();
            
            // Создаем AbortController для возможности отмены
            calculationController = new AbortController();
            const timeoutId = setTimeout(() => {
                if (calculationController) {
                    calculationController.abort();
                    showNotification('❌ Таймаут вычисления (слишком долго)', 'error');
                    stopCalculation();
                }
            }, timeout);
            
            const response = await fetch('/api/orc-exchange/optimize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData),
                signal: calculationController.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                if (response.status === 0) {
                    // Запрос был отменен
                    throw new Error('Запрос отменен');
                }
                const errorText = await response.text();
                console.error('Server response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                currentOptimization = result.data;
                
                // Обновляем данные игроков
                currentPlayers = result.data.players;
                
                renderPlayersWithTable();
                updateSummaryWithDetails(result.data.stats);
                
                // Создаем правильный объект для передачи в renderExchangesAsTable
                const exchangeData = {
                    exchanges: result.data.exchanges || [],
                    exchangeTable: result.data.exchangeTable || [],
                    recommendations: result.data.recommendations || [],
                    recommendationsTable: result.data.recommendationsTable || []
                };
                
                renderExchangesAsTable(exchangeData);
                
                // Показываем результат
                const improvement = result.data.stats.improvement.power;
                const percentage = result.data.stats.improvement.powerPercentage;
                const exchangeCount = result.data.exchanges ? result.data.exchanges.length : 0;
                const recommendationCount = result.data.recommendationsTable ? result.data.recommendationsTable.length : 0;
                
                showNotification(
                    `✅ ${getAlgorithmName(algorithm)} завершена!<br>` +
                    `Обменов: ${exchangeCount}, Рекомендаций: ${recommendationCount}<br>` +
                    `Улучшение: +${improvement} (${percentage})`,
                    'success'
                );
                
            } else {
                showNotification(`❌ Ошибка оптимизации: ${result.error}`, 'error');
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                // Пользователь отменил расчет
                showNotification('Расчет остановлен', 'warning');
            } else {
                showNotification(`❌ Ошибка сети: ${error.message}`, 'error');
                console.error('Error details:', error);
            }
        } finally {
            // Завершаем вычисления
            stopCalculation();
            calculationController = null;
        }
    }
    
    // Остановить оптимизацию
    function stopOptimization() {
        if (isCalculationRunning) {
            stopCalculation();
        }
    }
    
    // Сброс данных
    function resetData() {
        // Останавливаем вычисления, если они идут
        if (isCalculationRunning) {
            stopCalculation();
        }
        
        currentPlayers = [];
        currentOptimization = null;
        playersOriginalData = {};
        if (playersContainer) playersContainer.innerHTML = '';
        clearExchanges();
        updateSummary();
        if (optimizeBtn) optimizeBtn.disabled = true;
        showNotification('Данные сброшены', 'info');
    }

    // ================ ФУНКЦИИ ДЛЯ ОТРИСОВКИ UI ================

    // Функция для создания компактной бонусной плашки - ИСПРАВЛЕННАЯ
    function createMinimalBonusItem(bonusType, bonusData) {
        const typeTitles = {
            base: 'Базовая мощность:',
            earrings: 'Бонус за серьги:',
            logo: 'Бонус за логотипы:',
            bracelet: 'Бонус за браслеты:'
        };
        
        const colors = {
            earrings: '#e74c3c',
            logo: '#27ae60',
            bracelet: '#f39c12',
            base: '#2c3e50'
        };
        
        const title = typeTitles[bonusType] || 'Бонус';
        const color = colors[bonusType] || '#2c3e50';
        const value = bonusData.value || 0;
        const hasGroups = bonusData.groups && Object.keys(bonusData.groups).length > 0;
        
        let html = `
            <div class="bonus-item" data-type="${bonusType}">
                <div class="bonus-header">
                    <span class="bonus-title" style="color: ${color}">${title}</span>
                    <span class="bonus-value" style="color: ${value > 0 ? color : '#7f8c8d'}">${value}</span>
                </div>
        `;
        
        // ДЛЯ БАЗОВОЙ МОЩНОСТИ - добавляем бонус за полную команду второй строкой
        if (bonusType === 'base' && bonusData.fullTeamBonus) {
            html += `
            
                <div class="bonus-header">
                    <span class="bonus-title" style="color: #9b59b6">Бонус за команду:</span>
                    <span class="bonus-value" style="color: #9b59b6">${bonusData.fullTeamBonus}</span>
                </div>
               
            `;
        }
        
        if (hasGroups) {
            const groups = Object.entries(bonusData.groups)
                .map(([name, group]) => {
                    const isBonusGroup = group.count >= 4;
                    const groupColor = isBonusGroup ? color : '#2c3e50';
                    
                    // Получаем все оригинальные значения для этой группы
                    let originalValues = [];
                    if (group.originalValues) {
                        originalValues = Array.isArray(group.originalValues) 
                            ? group.originalValues 
                            : Array.from(group.originalValues || []);
                    }
                    
                    // Создаем тултип с оригинальными значениями
                    const tooltip = originalValues.length > 0 
                        ? `Оригинальные значения: ${originalValues.join(', ')}` 
                        : '';
                    
                    // Для отображения показываем нормализованное имя + количество
                    let displayName = name;
                    if (originalValues.length > 0) {
                        // Подсчитываем, сколько из них эквивалентных
                        const equivalents = constants.LOGO_EQUIVALENTS_FOR_GROUPING || {};
                        const equivalentCounts = {};
                        
                        originalValues.forEach(val => {
                            const normalized = equivalents[val] || val;
                            equivalentCounts[normalized] = (equivalentCounts[normalized] || 0) + 1;
                        });
                        
                        // Формируем строку с детализацией
                        const details = Object.entries(equivalentCounts)
                            .map(([norm, cnt]) => `${norm}: ${cnt}`)
                            .join(', ');
                        
                        displayName = `${name} (${details})`;
                    }
                    
                    return `<span class="group-item ${isBonusGroup ? 'bonus-group' : ''}" 
                            style="color: ${groupColor}" 
                            title="${tooltip}">
                        <span class="group-name">${displayName}:</span>
                        <span class="group-count">${group.count}</span>
                        
                    </span><br>`;
                }).join('');
            
            html += `<div class="bonus-groups">${groups}</div>`;
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Основная функция отрисовки игроков
     */
    function renderPlayers() {
        if (!playersContainer) return;
        
        playersContainer.innerHTML = '';
        
        if (!currentPlayers || currentPlayers.length === 0) {
            playersContainer.innerHTML = `
                <div class="empty-state">
                    <p class="empty-message">Нет данных игроков с выбранным Skin Tone: <strong>${currentSkinTone}</strong></p>
                    <p class="empty-submessage">Попробуйте выбрать другой Skin Tone</p>
                </div>
            `;
            return;
        }
        
        // Проверяем, загружены ли константы
        const logoTraitTypes = constants && constants.LOGO_TRAIT_TYPES ? 
            constants.LOGO_TRAIT_TYPES : 
            ['Cup', 'Glasses', 'Pendant Chain', 'Heart', 'Cap', 'Ring', 'Hamster'];
        
        currentPlayers.forEach(player => {
            const playerClone = playerTemplate.content.cloneNode(true);
            const playerCard = playerClone.querySelector('.player-card');
            
            if (!playerCard) return;
            
            // Заполняем данные игрока
            const playerNameEl = playerCard.querySelector('.player-name');
            const walletValueEl = playerCard.querySelector('.wallet-value');
            const powerValueEl = playerCard.querySelector('.power-value');
            const skinToneValueEl = playerCard.querySelector('.skin-tone-value');
            const teamHeaderEl = playerCard.querySelector('.team-header h4');
            
            if (playerNameEl) playerNameEl.textContent = player.name || `Игрок ${player.id + 1}`;
            if (walletValueEl) {
                walletValueEl.textContent = player.wallet || 'Не указан';
                walletValueEl.setAttribute('title', player.wallet || '');
            }
            if (powerValueEl) powerValueEl.textContent = player.teamPower || 0;
            if (skinToneValueEl) skinToneValueEl.textContent = currentSkinTone;
            if (teamHeaderEl) {
                teamHeaderEl.textContent = `Лучшая команда: ${player.teamPower || 0}`;
            }
            
            // Добавляем индикатор, если не может собрать полную команду
            if (player.canFormTeam === false || !player.team) {
                const warningBadge = document.createElement('div');
                warningBadge.className = 'player-warning';
                warningBadge.textContent = 'Нет полной команды';
                playerCard.style.position = 'relative';
                playerCard.appendChild(warningBadge);
            }
            
            // Отрисовываем команду
            if (player.team && player.team.orcs) {
                const teamOrcsContainer = playerCard.querySelector('.team-orcs');
                const teamStatsEl = playerCard.querySelector('.team-stats');
                
                if (teamOrcsContainer) {
                    teamOrcsContainer.innerHTML = '';
                    
                    player.team.orcs.forEach(orc => {
                        const orcClone = teamOrcTemplate.content.cloneNode(true);
                        const orcElement = orcClone.querySelector('.team-orc');
                        
                        if (!orcElement) return;
                        
                        // Устанавливаем тип
                        orcElement.setAttribute('data-type', orc.type);
                        
                        // Тип орка
                        const typeEl = orcElement.querySelector('.orc-type');
                        if (typeEl) typeEl.textContent = orcTypeNames[orc.type] || `Тип ${orc.type}`;
                        
                        // Изображение
                        const imageEl = orcElement.querySelector('.orc-image img');
                        if (imageEl) {
                            const cardData = player.cards?.find(card => card.id === orc.id);
                            if (cardData?.nftData?.image_url) {
                                imageEl.src = cardData.nftData.image_url;
                                imageEl.alt = cardData.nftData.name || `NFT #${orc.id}`;
                                imageEl.onerror = function() {
                                    this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%232c3e50"><rect width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-size="30" fill="white">?</text></svg>';
                                };
                            } else {
                                imageEl.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%232c3e50"><rect width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-size="30" fill="white">?</text></svg>';
                                imageEl.alt = 'Изображение недоступно';
                            }
                        }
                        
                        // Название
                        const nameEl = orcElement.querySelector('.orc-name');
                        if (nameEl) {
                            const cardData = player.cards?.find(card => card.id === orc.id);
                            if (cardData?.nftData?.name) {
                                const match = cardData.nftData.name.match(/#(\d+)/);
                                nameEl.textContent = match ? `#${match[1]}` : cardData.nftData.name;
                            } else {
                                nameEl.textContent = `#${orc.id}`;
                            }
                        }
                        
                        // Мощность
                        const powerEl = orcElement.querySelector('.power-value');
                        if (powerEl) powerEl.textContent = orc.power;
                        
                        // Индикатор синергии
                        const synergyEl = orcElement.querySelector('.synergy-indicator');
                        if (synergyEl) {
                            synergyEl.style.display = 'none';
                        }
                        
                        // Отображаем атрибуты из nftData.attributes
                        const attributesInfo = document.createElement('div');
                        attributesInfo.className = 'orc-attributes';
                        
                        const cardData = player.cards?.find(card => card.id === orc.id);
                        
                        if (cardData?.nftData?.attributes && Array.isArray(cardData.nftData.attributes)) {
                            let attrsHTML = '';
                            
                            // Получаем ДЕТАЛИ бонусов из статистики команды
                            const bonusDetails = player.team?.stats?.bonusDetails || {};
                            
                            // Фильтруем атрибуты для отображения
                            const displayAttributes = cardData.nftData.attributes
                                .filter(attr => {
                                    // Показываем только важные атрибуты
                                    const traitType = attr.trait_type || '';
                                    const value = attr.value || '';
                                    return traitType !== 'Skin Tone' && 
                                           traitType !== 'image' && 
                                           value.toString().trim() !== '';
                                })
                                .sort((a, b) => {
                                    // Сортируем по приоритету: серьги, логотипы, браслеты, затем остальное
                                    const priority = {
                                        'Earrings': 1,
                                        'Earring': 1,
                                        'Bracelet': 2
                                    };
                                    
                                    const aPriority = priority[a.trait_type] || (logoTraitTypes.includes(a.trait_type) ? 3 : 99);
                                    const bPriority = priority[b.trait_type] || (logoTraitTypes.includes(b.trait_type) ? 3 : 99);
                                    return aPriority - bPriority;
                                });
                            
                            // Создаем HTML для атрибутов
                            displayAttributes.forEach((attr, index) => {
                                if (index > 0) attrsHTML += '<br>';
                                
                                const traitType = attr.trait_type || 'Атрибут';
                                const value = attr.value || '';
                                
                                // Определяем цвет в зависимости от типа атрибута
                                let color = '#2c3e50'; // цвет по умолчанию - темно-серый
                                let isBonus = false;
                                
                                // 1. Проверяем серьги
                                if (traitType === 'Earrings' || traitType === 'Earring') {
                                    if (bonusDetails.earrings) {
                                        isBonus = isValueInBonusGroup(bonusDetails, value, 'earrings');
                                        if (isBonus) {
                                            color = '#e74c3c'; // красный
                                        }
                                    }
                                }
                                // 2. Проверяем браслеты
                                else if (traitType === 'Bracelet') {
                                    if (bonusDetails.bracelet) {
                                        isBonus = isValueInBonusGroup(bonusDetails, value, 'bracelet');
                                        if (isBonus) {
                                            color = '#f39c12'; // оранжевый
                                        }
                                    }
                                }
                                // 3. Проверяем логотипы (специальные типы)
                                else if (logoTraitTypes.includes(traitType)) {
                                    // Проверяем, является ли значение логотипом из констант
                                    const logoValues = constants && constants.LOGO_VALUES ? constants.LOGO_VALUES : [
                                        'Zargates Business', 'Zargates', 'Telegram', 'Tribo Games', 
                                        'Bitcoin', 'Professor TON', 'TON', 'ETH', 'RUB', 'Dollar', 'Elephant'
                                    ];
                                    
                                    // Нормализуем значение для проверки
                                    const normalizedValue = getNormalizedValue(value);
                                    
                                    if (logoValues.includes(value) || logoValues.includes(normalizedValue)) {
                                        if (bonusDetails.logo) {
                                            isBonus = isValueInBonusGroup(bonusDetails, value, 'logo');
                                            if (isBonus) {
                                                color = '#27ae60'; // зеленый
                                            }
                                        }
                                    }
                                }
                                
                                const fontWeight = isBonus ? '600' : '400';
                                
                                // ПОКАЗЫВАЕМ ОРИГИНАЛЬНОЕ ЗНАЧЕНИЕ!
                                attrsHTML += `<span style="color: ${color}; font-weight: ${fontWeight}">`;
                                attrsHTML += `${traitType}: ${value}`;
                                attrsHTML += '</span>';
                            });
                            
                            if (attrsHTML) {
                                attributesInfo.innerHTML = attrsHTML;
                                orcElement.appendChild(attributesInfo);
                            }
                        }
                        
                        // Клик для просмотра деталей NFT
                        orcElement.addEventListener('click', () => {
                            const cardData = player.cards?.find(card => card.id === orc.id);
                            if (cardData?.nftData) {
                                showNFTModal({ 
                                    ...cardData.nftData, 
                                    index: orc.id, 
                                    power_total: orc.power,
                                    earrings: orc.earrings,
                                    bracelet: orc.bracelet,
                                    logo: orc.logo,
                                    skinTone: currentSkinTone
                                });
                            }
                        });
                        
                        teamOrcsContainer.appendChild(orcElement);
                    });
                }
                
                // Статистика команды - минималистичная версия
                if (teamStatsEl) {
                    const stats = player.team.stats;
                    
                    // Очищаем старое содержимое
                    teamStatsEl.innerHTML = '';
                    
                    // Базовая мощность + бонус за полную команду (внутри одной плашки)
                    if (stats?.basePower) {
                        teamStatsEl.innerHTML += createMinimalBonusItem('base', {
                            value: stats.basePower,
                            fullTeamBonus: stats.isFullTeam ? (stats.bonuses?.fullTeam) : 0
                        });
                    }
                    
                    // Бонус за серьги
                    const earringsBonus = stats?.bonuses?.earrings || 0;
                    const earringsGroups = stats?.groups?.earrings || {};
                    
                    if (earringsBonus > 0 || Object.keys(earringsGroups).length > 0) {
                        teamStatsEl.innerHTML += createMinimalBonusItem('earrings', {
                            value: earringsBonus,
                            groups: earringsGroups
                        });
                    }
                    
                    // Бонус за логотипы - С УЧЕТОМ ЭКВИВАЛЕНТНОСТИ
                    const logoBonus = stats?.bonuses?.logo || 0;
                    const logoGroups = stats?.groups?.logo || {};
                    
                    if (logoBonus > 0 || Object.keys(logoGroups).length > 0) {
                        teamStatsEl.innerHTML += createMinimalBonusItem('logo', {
                            value: logoBonus,
                            groups: logoGroups
                        });
                    }
                    
                    // Бонус за браслеты
                    const braceletBonus = stats?.bonuses?.bracelet || 0;
                    const braceletGroups = stats?.groups?.bracelet || {};
                    
                    if (braceletBonus > 0 || Object.keys(braceletGroups).length > 0) {
                        teamStatsEl.innerHTML += createMinimalBonusItem('bracelet', {
                            value: braceletBonus,
                            groups: braceletGroups
                        });
                    }
                }

                // Также обновляем отображение общей мощности команды в заголовке
                const teamHeaderEl = playerCard.querySelector('.team-header h4');
                if (teamHeaderEl) {
                    teamHeaderEl.textContent = `Лучшая команда: ${player.teamPower || 0}`;
                }
            }
            
            // Отрисовываем все карточки игрока
            const cardsContainer = playerCard.querySelector('.cards-list');
            const cardsCount = playerCard.querySelector('.cards-count');
            
            if (cardsCount) {
                cardsCount.textContent = player.cards ? player.cards.length : 0;
            }
            
            if (cardsContainer && player.cards) {
                cardsContainer.innerHTML = '';
                
                player.cards.forEach(card => {
                    // Используем ТОТ ЖЕ ШАБЛОН, что и для карточек в команде
                    const orcClone = teamOrcTemplate.content.cloneNode(true);
                    const orcElement = orcClone.querySelector('.team-orc');
                    
                    if (!orcElement) return;
                    
                    // Устанавливаем тип
                    orcElement.setAttribute('data-type', card.type);
                    
                    // Тип орка
                    const typeEl = orcElement.querySelector('.orc-type');
                    if (typeEl) typeEl.textContent = orcTypeNames[card.type] || `Тип ${card.type}`;
                    
                    // Изображение
                    const imageEl = orcElement.querySelector('.orc-image img');
                    if (imageEl && card.nftData?.image_url) {
                        imageEl.src = card.nftData.image_url;
                        imageEl.alt = card.nftData.name || `NFT #${card.id}`;
                        imageEl.onerror = function() {
                            this.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%232c3e50"><rect width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-size="30" fill="white">?</text></svg>';
                        };
                    } else {
                        imageEl.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="%232c3e50"><rect width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" font-size="30" fill="white">?</text></svg>';
                        imageEl.alt = 'Изображение недоступно';
                    }
                    
                    // Название
                    const nameEl = orcElement.querySelector('.orc-name');
                    if (nameEl) {
                        if (card.nftData?.name) {
                            const match = card.nftData.name.match(/#(\d+)/);
                            nameEl.textContent = match ? `#${match[1]}` : card.nftData.name;
                        } else {
                            nameEl.textContent = `#${card.id}`;
                        }
                    }
                    
                    // Мощность
                    const powerEl = orcElement.querySelector('.power-value');
                    if (powerEl) powerEl.textContent = card.power;
                    
                    // Индикатор синергии
                    const synergyEl = orcElement.querySelector('.synergy-indicator');
                    if (synergyEl) {
                        synergyEl.style.display = 'none';
                    }
                    
                    // Атрибуты
                    const attributesInfo = document.createElement('div');
                    attributesInfo.className = 'orc-attributes';
                    
                    // Получаем ДЕТАЛИ бонусов из статистики команды
                    const bonusDetails = player.team?.stats?.bonusDetails || {};
                    
                    if (card.nftData?.attributes && Array.isArray(card.nftData.attributes)) {
                        let attrsHTML = '';
                        
                        // Фильтруем атрибуты для отображения
                        const displayAttributes = card.nftData.attributes
                            .filter(attr => {
                                const traitType = attr.trait_type || '';
                                const value = attr.value || '';
                                return traitType !== 'Skin Tone' && 
                                       traitType !== 'image' && 
                                       value.toString().trim() !== '';
                            })
                            .sort((a, b) => {
                                const priority = {
                                    'Earrings': 1,
                                    'Earring': 1,
                                    'Bracelet': 2
                                };
                                
                                const aPriority = priority[a.trait_type] || (logoTraitTypes.includes(a.trait_type) ? 3 : 99);
                                const bPriority = priority[b.trait_type] || (logoTraitTypes.includes(b.trait_type) ? 3 : 99);
                                return aPriority - bPriority;
                            });
                        
                        // Создаем HTML для атрибутов
                        displayAttributes.forEach((attr, index) => {
                            if (index > 0) attrsHTML += '<br>';
                            
                            const traitType = attr.trait_type || 'Атрибут';
                            const value = attr.value || '';
                            
                            // Определяем цвет в зависимости от типа атрибута
                            let color = '#2c3e50';
                            let isBonus = false;
                            
                            // 1. Проверяем серьги
                            if (traitType === 'Earrings' || traitType === 'Earring') {
                                if (bonusDetails.earrings) {
                                    isBonus = isValueInBonusGroup(bonusDetails, value, 'earrings');
                                    if (isBonus) color = '#e74c3c';
                                }
                            }
                            // 2. Проверяем браслеты
                            else if (traitType === 'Bracelet') {
                                if (bonusDetails.bracelet) {
                                    isBonus = isValueInBonusGroup(bonusDetails, value, 'bracelet');
                                    if (isBonus) color = '#f39c12';
                                }
                            }
                            // 3. Проверяем логотипы
                            else if (logoTraitTypes.includes(traitType)) {
                                const logoValues = constants && constants.LOGO_VALUES ? constants.LOGO_VALUES : [
                                    'Zargates Business', 'Zargates', 'Telegram', 'Tribo Games', 
                                    'Bitcoin', 'Professor TON', 'TON', 'ETH', 'RUB', 'Dollar', 'Elephant'
                                ];
                                
                                const normalizedValue = getNormalizedValue(value);
                                
                                if (logoValues.includes(value) || logoValues.includes(normalizedValue)) {
                                    if (bonusDetails.logo) {
                                        isBonus = isValueInBonusGroup(bonusDetails, value, 'logo');
                                        if (isBonus) color = '#27ae60';
                                    }
                                }
                            }
                            
                            const fontWeight = isBonus ? '600' : '400';
                            
                            attrsHTML += `<span style="color: ${color}; font-weight: ${fontWeight}">`;
                            attrsHTML += `${traitType}: ${value}`;
                            attrsHTML += '</span>';
                        });
                        
                        if (attrsHTML) {
                            attributesInfo.innerHTML = attrsHTML;
                            orcElement.appendChild(attributesInfo);
                        }
                    }
                    
                    // Проверяем, находится ли карточка в команде
                    if (player.team && player.team.orcs && 
                        player.team.orcs.some(orc => orc.id === card.id)) {
                        orcElement.style.borderColor = '#3498db';
                        orcElement.style.borderWidth = '2px';
                    } else {
                        orcElement.style.borderColor = '#dee2e6';
                        orcElement.style.borderWidth = '1px';
                    }
                    
                    // Клик для просмотра деталей NFT
                    orcElement.addEventListener('click', () => {
                        showNFTModal({ 
                            ...card.nftData, 
                            index: card.id, 
                            power_total: card.power,
                            earrings: card.earrings,
                            bracelet: card.bracelet,
                            logo: card.logos,
                            skinTone: currentSkinTone
                        });
                    });
                    
                    cardsContainer.appendChild(orcElement);
                });
            }
            
            playersContainer.appendChild(playerCard);
        });
    }
    
    // Показать детали NFT
    async function showNFTDetails(card) {
        try {
            const response = await fetch(`/api/orc-exchange/nft/${card.id}`);
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    showNFTModal(result.data);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки деталей NFT:', error);
            showNotification('Не удалось загрузить детали NFT', 'error');
        }
    }
    
    // Функция для отображения модального окна с NFT
    function showNFTModal(nftData) {
        const modal = document.createElement('div');
        modal.className = 'nft-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        `;
        
        // Определяем тип орка
        const orcType = getOrcTypeFromName(nftData.name || '');
        const orcTypeName = orcTypeNames[orcType] || `Тип ${orcType}`;
        const typeColor = typeColors[orcType] || '#6c757d';
        
        content.innerHTML = `
            <button class="close-nft" style="position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
            <h3 style="color: ${typeColor}; margin-bottom: 15px;">${nftData.name || 'NFT'}</h3>
            
            ${nftData.image_url ? `
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${nftData.image_url}" alt="${nftData.name}" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 2px solid #dee2e6;">
                </div>
            ` : ''}
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>Индекс:</strong> ${nftData.index}</p>
                <p><strong>Тип орка:</strong> <span style="color: ${typeColor}; font-weight: bold;">${orcTypeName}</span></p>
                <p><strong>Skin Tone:</strong> ${nftData.skinTone || currentSkinTone}</p>
                <p><strong>Общая мощность:</strong> <span style="color: #28a745; font-weight: bold;">${nftData.power_total || 0} PWR</span></p>
                
                ${nftData.earrings ? `<p><strong>Серьги:</strong> ${nftData.earrings}</p>` : ''}
                ${nftData.bracelet ? `<p><strong>Браслет:</strong> ${nftData.bracelet}</p>` : ''}
                ${nftData.logo ? `<p><strong>Логотип:</strong> ${Array.isArray(nftData.logo) ? nftData.logo.join(', ') : nftData.logo}</p>` : ''}
            </div>
            
            ${nftData.attributes && nftData.attributes.length > 0 ? `
                <h4 style="color: ${typeColor}; margin-bottom: 10px;">Атрибуты:</h4>
                <div style="display: grid; gap: 8px;">
                    ${nftData.attributes.map(attr => `
                        <div style="padding: 10px; background: #f5f5f5; border-radius: 6px; border-left: 4px solid ${typeColor};">
                            <div style="font-weight: bold; color: #333;">${attr.trait_type}</div>
                            <div style="color: #666;">
                                <span>${attr.value}</span>
                                ${attr.rarity ? `<span style="color: ${getRarityColor(attr.rarity)}; margin-left: 10px;">(${attr.rarity})</span>` : ''}
                                ${attr.power ? `<span style="color: #28a745; margin-left: 10px; font-weight: bold;">+${attr.power}</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${nftData.getgems_url ? `
                <div style="margin-top: 20px; text-align: center;">
                    <a href="${nftData.getgems_url}" target="_blank" style="display: inline-block; padding: 10px 20px; background: ${typeColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                        <i class="fas fa-external-link-alt"></i> Посмотреть на GetGems
                    </a>
                </div>
            ` : ''}
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Обработчик закрытия
        const closeBtn = content.querySelector('.close-nft');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Закрытие при клике вне окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    // Определение типа орка по имени
    function getOrcTypeFromName(name) {
        if (!name) return 1;
        
        const lowerName = name.toLowerCase();
        if (lowerName.includes('wen')) return 1;
        if (lowerName.includes('greeting')) return 2;
        if (lowerName.includes('shoked') || lowerName.includes('shocked')) return 3;
        if (lowerName.includes('love')) return 4;
        if (lowerName.includes('capped')) return 5;
        if (lowerName.includes('moon')) return 6;
        if (lowerName.includes('do something')) return 7;
        
        return 1;
    }
    
    // Получение цвета редкости
    function getRarityColor(rarity) {
        const colors = {
            'Common': '#6c757d',
            'Uncommon': '#28a745',
            'Rare': '#17a2b8',
            'Epic': '#6f42c1',
            'Legendary': '#fd7e14',
            'Mythic': '#dc3545'
        };
        return colors[rarity] || '#6c757d';
    }
    
    // Отрисовка обменов и рекомендаций в виде таблицы
    function renderExchangesAsTable(exchangeData) {
        if (!exchangesList) return;
        
        // Проверяем наличие данных
        const hasExchanges = exchangeData.exchangeTable && exchangeData.exchangeTable.length > 0;
        const hasRecommendations = exchangeData.recommendationsTable && exchangeData.recommendationsTable.length > 0;
        
        if (!hasExchanges && !hasRecommendations) {
            exchangesList.innerHTML = '<p class="empty-message">Обмены еще не выполнялись</p>';
            return;
        }
        
        let html = '';
        
        // Если есть обмены, показываем их
        if (hasExchanges) {
            html += `
                <h4 style="margin-bottom: 15px; color: var(--primary-color);">Обмены:</h4>
                <div class="exchanges-table-container">
                    <table class="exchanges-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>От игрока</th>
                                <th>К игроку</th>
                                <th>Передает</th>
                                <th>Получает</th>
                                <th>Улучшение</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            exchangeData.exchangeTable.forEach((exchange, index) => {
                const exchangeDetails = exchangeData.exchanges?.[index];
                
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><strong>${exchange.игрок_от || exchange.player1Name || exchangeDetails?.player1Name || ''}</strong></td>
                        <td><strong>${exchange.игрок_кому || exchange.player2Name || exchangeDetails?.player2Name || ''}</strong></td>
                        <td>${exchange.передает_орка || `#${exchangeDetails?.orc1Id || ''} (${exchangeDetails?.orc1TypeName || ''})`}</td>
                        <td>${exchange.получает_орка || `#${exchangeDetails?.orc2Id || ''} (${exchangeDetails?.orc2TypeName || ''})`}</td>
                        <td class="improvement-cell">${exchange.улучшение || `+${exchangeDetails?.improvement || 0}`}</td>
                        <td>
                            ${exchangeDetails ? `
                                <button class="btn-details-small" data-index="${index}" data-type="exchange">
                                    <i class="fas fa-info-circle"></i>
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        // Если есть рекомендации, показываем их отдельной таблицей
        if (hasRecommendations) {
            html += `
                <h4 style="margin-top: ${hasExchanges ? '30px' : '0'}; margin-bottom: 15px; color: var(--success-color);">Рекомендации:</h4>
                <div class="exchanges-table-container">
                    <table class="exchanges-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Тип</th>
                                <th>Игрок</th>
                                <th>Действие</th>
                                <th>Изменение мощности</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            exchangeData.recommendationsTable.forEach((recommendation, index) => {
                html += `
                    <tr>
                        <td>${index + 1}</td>
                        <td><span class="recommendation-type ${recommendation.тип === 'Передача' ? 'give' : 'receive'}">${recommendation.тип || 'Действие'}</span></td>
                        <td><strong>${recommendation.игрок || ''}</strong></td>
                        <td>${recommendation.действие || ''}</td>
                        <td class="improvement-cell">${recommendation.изменение_мощности || '0'}</td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        exchangesList.innerHTML = html;
        
        // Добавляем обработчики для кнопок деталей обменов
        exchangesList.querySelectorAll('.btn-details-small[data-type="exchange"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.closest('.btn-details-small').getAttribute('data-index'));
                const exchange = exchangeData.exchanges?.[index];
                if (exchange) {
                    const player1 = currentPlayers.find(p => p.id === exchange.player1Id);
                    const player2 = currentPlayers.find(p => p.id === exchange.player2Id);
                    showExchangeDetails(exchange, player1, player2);
                }
            });
        });
    }
    
    // Показ деталей обмена
    function showExchangeDetails(exchange, player1, player2) {
        if (!modal || !exchangeDetails) return;
        
        exchangeDetails.innerHTML = `
            <div class="exchange-detail">
                <h4>Обмен #${exchange.iteration || '1'}</h4>
                
                <div class="exchange-summary">
                    <div class="exchange-summary-item">
                        <div class="summary-label">Игроки:</div>
                        <div class="summary-value">${player1?.name || exchange.player1Name} ↔ ${player2?.name || exchange.player2Name}</div>
                    </div>
                    
                    <div class="exchange-summary-item">
                        <div class="summary-label">Обмен:</div>
                        <div class="summary-value">
                            <strong>${player1?.name || exchange.player1Name}</strong> отдает орка #${exchange.orc1Id} (${exchange.orc1TypeName})<br>
                            <strong>${player2?.name || exchange.player2Name}</strong> отдает орка #${exchange.orc2Id} (${exchange.orc2TypeName})
                        </div>
                    </div>
                    
                    <div class="exchange-summary-item">
                        <div class="summary-label">Улучшение:</div>
                        <div class="summary-value improvement">+${exchange.improvement}</div>
                    </div>
                    
                    <div class="exchange-summary-item">
                        <div class="summary-label">Мощность до:</div>
                        <div class="summary-value">
                            ${player1?.name || exchange.player1Name}: ${exchange.oldPlayer1Power || 0}<br>
                            ${player2?.name || exchange.player2Name}: ${exchange.oldPlayer2Power || 0}<br>
                            <strong>Сумма: ${(exchange.oldPlayer1Power || 0) + (exchange.oldPlayer2Power || 0)}</strong>
                        </div>
                    </div>
                    
                    <div class="exchange-summary-item">
                        <div class="summary-label">Мощность после:</div>
                        <div class="summary-value">
                            ${player1?.name || exchange.player1Name}: ${exchange.newPlayer1Power || 0}<br>
                            ${player2?.name || exchange.player2Name}: ${exchange.newPlayer2Power || 0}<br>
                            <strong>Сумма: ${(exchange.newPlayer1Power || 0) + (exchange.newPlayer2Power || 0)}</strong>
                        </div>
                    </div>
                </div>
                
                <div class="exchange-timestamp">
                    <small>${new Date(exchange.timestamp || Date.now()).toLocaleString()}</small>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }
    
    // Обновляем сводку с деталями
    function updateSummaryWithDetails(stats) {
        if (!stats) {
            updateSummary();
            return;
        }
        
        const playerCount = currentPlayers.length;
        const totalCards = currentPlayers.reduce((sum, p) => sum + (p.cards?.length || 0), 0);
        const totalPower = currentPlayers.reduce((sum, p) => sum + (p.teamPower || 0), 0);
        
        if (playerCountEl) playerCountEl.textContent = playerCount;
        
        if (totalCardsEl) {
            totalCardsEl.textContent = `${totalCards}`;
            if (stats.after && stats.before && stats.after.totalCards !== stats.before.totalCards) {
                const diff = stats.after.totalCards - stats.before.totalCards;
                totalCardsEl.innerHTML += ` <span class="change-indicator ${diff > 0 ? 'change-positive' : 'change-negative'}">(${diff > 0 ? '+' : ''}${diff})</span>`;
            }
        }
        
        if (totalPowerEl) {
            totalPowerEl.textContent = totalPower;
            if (stats.after && stats.before) {
                const diff = stats.after.totalPower - stats.before.totalPower;
                if (diff !== 0) {
                    totalPowerEl.innerHTML += ` <span class="change-indicator ${diff > 0 ? 'change-positive' : 'change-negative'}">(${diff > 0 ? '+' : ''}${diff})</span>`;
                }
            }
        }
        
        if (improvementEl) {
            if (stats.improvement) {
                improvementEl.textContent = `+${stats.improvement.power}`;
                improvementEl.className = 'value positive';
                improvementEl.title = `Улучшение на ${stats.improvement.powerPercentage}`;
            } else {
                improvementEl.textContent = '0';
                improvementEl.className = 'value';
            }
        }
        
        if (exchangesCountEl) {
            exchangesCountEl.textContent = currentOptimization ? (currentOptimization.exchanges?.length || 0) : 0;
        }
        
        // Показываем количество игроков с командами
        const teamsInfo = document.getElementById('teamsInfo');
        if (!teamsInfo && stats.after) {
            const summary = document.querySelector('.summary');
            if (summary) {
                const teamsItem = document.createElement('div');
                teamsItem.className = 'summary-item teams';
                teamsItem.id = 'teamsInfo';
                teamsItem.innerHTML = `
                    <span class="label">Команд собрано:</span>
                    <span class="value">${stats.after.playersWithTeam || 0}/${stats.before.playersCount || playerCount}</span>
                `;
                summary.appendChild(teamsItem);
            }
        } else if (teamsInfo && stats.after) {
            teamsInfo.innerHTML = `
                <span class="label">Команд собрано:</span>
                <span class="value">${stats.after.playersWithTeam || 0}/${stats.before.playersCount || playerCount}</span>
            `;
        }
        
        // Добавляем информацию о Skin Tone
        const skinToneElement = document.getElementById('currentSkinTone');
        if (!skinToneElement) {
            const summary = document.querySelector('.summary');
            if (summary) {
                const skinToneItem = document.createElement('div');
                skinToneItem.className = 'summary-item skin-tone';
                skinToneItem.innerHTML = `
                    <span class="label">Skin Tone:</span>
                    <span id="currentSkinTone" class="value skin-tone-value">${currentSkinTone}</span>
                `;
                summary.appendChild(skinToneItem);
            }
        } else {
            skinToneElement.textContent = currentSkinTone;
        }
    }
    
    // Обновляем сводку (базовая версия)
    function updateSummary() {
        const playerCount = currentPlayers.length;
        const totalCards = currentPlayers.reduce((sum, p) => sum + (p.cards?.length || 0), 0);
        const totalPower = currentPlayers.reduce((sum, p) => sum + (p.teamPower || 0), 0);
        
        if (playerCountEl) playerCountEl.textContent = playerCount;
        if (totalCardsEl) totalCardsEl.textContent = totalCards;
        if (totalPowerEl) totalPowerEl.textContent = totalPower;
        
        // Добавляем отображение текущего Skin Tone
        const skinToneElement = document.getElementById('currentSkinTone');
        if (!skinToneElement) {
            const summary = document.querySelector('.summary');
            if (summary) {
                const skinToneItem = document.createElement('div');
                skinToneItem.className = 'summary-item skin-tone';
                skinToneItem.innerHTML = `
                    <span class="label">Skin Tone:</span>
                    <span id="currentSkinTone" class="value skin-tone-value">${currentSkinTone}</span>
                `;
                summary.appendChild(skinToneItem);
            }
        } else {
            skinToneElement.textContent = currentSkinTone;
        }
        
        if (improvementEl) {
            if (currentOptimization) {
                improvementEl.textContent = `+${currentOptimization.improvement || 0}`;
                improvementEl.className = 'value positive';
            } else {
                improvementEl.textContent = '0';
                improvementEl.className = 'value';
            }
        }
        
        if (exchangesCountEl) {
            exchangesCountEl.textContent = currentOptimization ? (currentOptimization.exchanges?.length || 0) : 0;
        }
    }
    
    // Очистка списка обменов
    function clearExchanges() {
        if (exchangesList) {
            exchangesList.innerHTML = '<p class="empty-message">Обмены еще не выполнялись</p>';
        }
    }
    
    // Функция уведомлений
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }

    // ================ ФУНКЦИИ ДЛЯ ТАБЛИЦЫ ОБМЕНОВ ================

    // Функция для создания и отображения HTML таблицы обменов
    function createExchangeSummaryTable() {
        // Проверяем, есть ли данные об обменах
        if (!currentOptimization || !currentOptimization.exchanges || currentOptimization.exchanges.length === 0) {
            return '<p>Нет данных об обменах для отображения</p>';
        }
        
        // Собираем все обмены и группируем по участникам
        const exchangesByParticipant = {};
        let allParticipants = new Set();
        
        // Проходим по всем обменам
        currentOptimization.exchanges.forEach((exchange, index) => {
            // Участник 1 (отдает)
            if (!exchangesByParticipant[exchange.player1Id]) {
                exchangesByParticipant[exchange.player1Id] = {
                    name: exchange.player1Name,
                    exchanges: [],
                    totalPowerBefore: 0,
                    totalPowerAfter: 0
                };
            }
            allParticipants.add(exchange.player1Id);
            
            // Участник 2 (получает от участника 1)
            if (!exchangesByParticipant[exchange.player2Id]) {
                exchangesByParticipant[exchange.player2Id] = {
                    name: exchange.player2Name,
                    exchanges: [],
                    totalPowerBefore: 0,
                    totalPowerAfter: 0
                };
            }
            allParticipants.add(exchange.player2Id);
        });
        
        // Второй проход: заполняем обмены с обеих сторон
        currentOptimization.exchanges.forEach((exchange, index) => {
            // Для участника 1 (отдает, получает)
            exchangesByParticipant[exchange.player1Id].exchanges.push({
                type: 'give',
                participant: exchange.player2Name,
                participantId: exchange.player2Id,
                gives: `#${exchange.orc1Id} (${exchange.orc1TypeName})`,
                receives: `#${exchange.orc2Id} (${exchange.orc2TypeName})`,
                from: exchange.player2Name,
                powerBefore: exchange.oldPlayer1Power,
                powerAfter: exchange.newPlayer1Power,
                exchangeIndex: index
            });
            
            // Для участника 2 (отдает, получает)
            exchangesByParticipant[exchange.player2Id].exchanges.push({
                type: 'receive',
                participant: exchange.player1Name,
                participantId: exchange.player1Id,
                gives: `#${exchange.orc2Id} (${exchange.orc2TypeName})`,
                receives: `#${exchange.orc1Id} (${exchange.orc1TypeName})`,
                from: exchange.player1Name,
                powerBefore: exchange.oldPlayer2Power,
                powerAfter: exchange.newPlayer2Power,
                exchangeIndex: index
            });
        });
        
        // Находим исходные и финальные мощности игроков
        allParticipants.forEach(playerId => {
            const player = currentPlayers.find(p => p.id === playerId);
            if (player) {
                const originalData = playersOriginalData[playerId];
                if (originalData) {
                    exchangesByParticipant[playerId].totalPowerBefore = originalData.teamPower || 0;
                }
                exchangesByParticipant[playerId].totalPowerAfter = player.teamPower || 0;
            }
        });
        
        // Создаем HTML таблицы
        let html = `
            <div class="exchange-summary-table-container">
                <h3>Сводная таблица обменов</h3>
                <table class="exchange-summary-table">
                    <thead>
                        <tr>
                            <th>Номер</th>
                            <th>Участник</th>
                            <th>Передал</th>
                            <th>Кому</th>
                            <th>Получил</th>
                            <th>От кого</th>
                            <th>Power было</th>
                            <th>Power стало</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Сортируем участников по имени
        const sortedParticipants = Array.from(allParticipants).sort((a, b) => {
            return exchangesByParticipant[a].name.localeCompare(exchangesByParticipant[b].name);
        });
        
        let rowNumber = 1;
        
        // Для каждого участника
        sortedParticipants.forEach(playerId => {
            const participantData = exchangesByParticipant[playerId];
            
            // Добавляем строку с обменом, если есть
            if (participantData.exchanges && participantData.exchanges.length > 0) {
                participantData.exchanges.forEach((exchange, exchangeIndex) => {
                    html += `
                        <tr>
                            <td>${rowNumber}</td>
                            <td><strong>${participantData.name}</strong></td>
                            <td>${exchange.type === 'give' ? exchange.gives : ''}</td>
                            <td>${exchange.type === 'give' ? exchange.participant : ''}</td>
                            <td>${exchange.type === 'receive' ? exchange.receives : ''}</td>
                            <td>${exchange.type === 'receive' ? exchange.from : ''}</td>
                            <td>${exchange.powerBefore || 0}</td>
                            <td>${exchange.powerAfter || 0}</td>
                        </tr>
                    `;
                    rowNumber++;
                });
            } else {
                // Участник не участвовал в обменах напрямую, но мог изменить мощность
                html += `
                    <tr>
                        <td>${rowNumber}</td>
                        <td><strong>${participantData.name}</strong></td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>${participantData.totalPowerBefore || 0}</td>
                        <td>${participantData.totalPowerAfter || 0}</td>
                    </tr>
                `;
                rowNumber++;
            }
            
            // Добавляем строку "Итого" для этого участника
            html += `
                <tr class="total-row">
                    <td colspan="6" style="text-align: right; font-weight: bold;">Итого для ${participantData.name}:</td>
                    <td>${participantData.totalPowerBefore || 0}</td>
                    <td>${participantData.totalPowerAfter || 0}</td>
                </tr>
                <tr class="separator-row">
                    <td colspan="8"></td>
                </tr>
            `;
        });
        
        // Добавляем общие итоги
        const totalPowerBefore = currentPlayers.reduce((sum, player) => {
            const originalData = playersOriginalData[player.id];
            return sum + (originalData ? (originalData.teamPower || 0) : 0);
        }, 0);
        
        const totalPowerAfter = currentPlayers.reduce((sum, player) => sum + (player.teamPower || 0), 0);
        
        html += `
                    </tbody>
                    <tfoot>
                        <tr class="grand-total-row">
                            <td colspan="6" style="text-align: right; font-weight: bold; font-size: 1.1em;">ОБЩИЙ ИТОГ:</td>
                            <td style="font-weight: bold; font-size: 1.1em;">${totalPowerBefore}</td>
                            <td style="font-weight: bold; font-size: 1.1em;">${totalPowerAfter}</td>
                        </tr>
                        <tr class="improvement-row">
                            <td colspan="6" style="text-align: right; font-weight: bold;">Улучшение:</td>
                            <td colspan="2" style="font-weight: bold; color: #28a745;">
                                +${totalPowerAfter - totalPowerBefore}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            <style>
                .exchange-summary-table-container {
                    margin-top: 30px;
                    padding: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                
                .exchange-summary-table-container h3 {
                    margin-bottom: 20px;
                    color: #333;
                    border-bottom: 2px solid #007bff;
                    padding-bottom: 10px;
                }
                
                .exchange-summary-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                
                .exchange-summary-table th {
                    background: #007bff;
                    color: white;
                    padding: 12px 8px;
                    text-align: left;
                    font-weight: bold;
                    border: 1px solid #dee2e6;
                }
                
                .exchange-summary-table td {
                    padding: 10px 8px;
                    border: 1px solid #dee2e6;
                    vertical-align: top;
                }
                
                .exchange-summary-table tbody tr:nth-child(even) {
                    background: #f8f9fa;
                }
                
                .exchange-summary-table tbody tr:hover {
                    background: #e9ecef;
                }
                
                .exchange-summary-table .total-row {
                    background: #e7f3ff !important;
                    font-weight: bold;
                }
                
                .exchange-summary-table .separator-row {
                    height: 5px;
                    background: #f8f9fa;
                }
                
                .exchange-summary-table .grand-total-row {
                    background: #d4edda !important;
                    font-size: 1.1em;
                }
                
                .exchange-summary-table .improvement-row {
                    background: #fff3cd !important;
                }
                
                .exchange-summary-table .improvement-row td {
                    color: #155724;
                }
            </style>
        `;
        
        return html;
    }

    // Функция для отображения таблицы в модальном окне или на странице
    function showExchangeSummaryTable() {
        const tableHtml = createExchangeSummaryTable();
        
        // Создаем модальное окно для таблицы
        const modal = document.createElement('div');
        modal.className = 'exchange-summary-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: flex-start;
            z-index: 2000;
            overflow-y: auto;
            padding: 20px;
        `;
        
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 1200px;
            width: 90%;
            margin: 50px auto;
            position: relative;
            max-height: 85vh;
            overflow-y: auto;
        `;
        
        content.innerHTML = `
            <button class="close-exchange-summary" style="
                position: absolute;
                top: 15px;
                right: 15px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                font-size: 18px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            ">×</button>
            <h2 style="color: #007bff; margin-bottom: 20px; text-align: center;">Детализированная таблица обменов</h2>
            ${tableHtml}
        `;
        
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        // Обработчик закрытия
        const closeBtn = content.querySelector('.close-exchange-summary');
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Закрытие при клике вне окна
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // Добавляем кнопку для вызова таблицы в интерфейс
    function addTableButtonToUI() {
        // Проверяем, есть ли уже кнопка
        if (document.getElementById('showExchangeTableBtn')) {
            return;
        }
        
        // Находим контейнер с кнопками действий
        const actionButtons = document.querySelector('.action-buttons');
        if (!actionButtons) {
            console.warn('Не найден контейнер для кнопок');
            return;
        }
        
        // Создаем кнопку
        const tableBtn = document.createElement('button');
        tableBtn.id = 'showExchangeTableBtn';
        tableBtn.className = 'btn btn-info';
        tableBtn.innerHTML = '<i class="fas fa-table"></i> Показать таблицу обменов';
        tableBtn.style.marginLeft = '10px';
        
        tableBtn.addEventListener('click', () => {
            if (!currentOptimization || !currentOptimization.exchanges || currentOptimization.exchanges.length === 0) {
                alert('Сначала выполните оптимизацию обменов');
                return;
            }
            showExchangeSummaryTable();
        });
        
        actionButtons.appendChild(tableBtn);
    }

    // Инициализируем кнопку после загрузки данных
    function renderPlayersWithTable() {
        renderPlayers(); // Вызываем оригинальную функцию
        addTableButtonToUI(); // Добавляем кнопку таблицы
    }
});