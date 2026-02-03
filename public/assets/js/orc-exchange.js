document.addEventListener('DOMContentLoaded', function() {
    // Элементы DOM
    const generateBtn = document.getElementById('generateTestData');
    const optimizeBtn = document.getElementById('optimize');
    const resetBtn = document.getElementById('reset');
    const playersContainer = document.getElementById('playersContainer');
    const exchangesList = document.getElementById('exchangesList');
    const recommendationsList = document.getElementById('recommendationsList');
    const totalPowerEl = document.getElementById('totalPower');
    const improvementEl = document.getElementById('improvement');
    const exchangesCountEl = document.getElementById('exchangesCount');
    
    // Проверяем, что все элементы существуют
    if (!generateBtn || !optimizeBtn || !playersContainer) {
        console.error('Не найдены необходимые элементы DOM');
        return;
    }
    
    // Поля настроек
    const playerCountInput = document.getElementById('playerCount') || { value: '4' };
    const cardsPerPlayerInput = document.getElementById('cardsPerPlayer') || { value: '10' };
    const maxIterationsInput = document.getElementById('maxIterations') || { value: '100' };
    
    // Модальное окно
    const modal = document.getElementById('exchangeDetailsModal');
    const modalClose = modal ? modal.querySelector('.close') : null;
    const exchangeDetails = document.getElementById('exchangeDetails');
    
    // Шаблоны
    const playerTemplate = document.getElementById('playerTemplate');
    const teamOrcTemplate = document.getElementById('teamOrcTemplate');
    const cardTemplate = document.getElementById('cardTemplate');
    const exchangeTemplate = document.getElementById('exchangeTemplate');
    
    // Проверяем наличие шаблонов
    if (!playerTemplate || !teamOrcTemplate || !cardTemplate || !exchangeTemplate) {
        console.error('Не найдены необходимые шаблоны');
        return;
    }
    
    // Текущие данные
    let currentPlayers = [];
    let currentOptimization = null;
    
    // Типы орков для отображения
    const orcTypes = {
        1: 'В', 2: 'Л', 3: 'М', 4: 'Лк', 5: 'У', 6: 'Т', 7: 'П'
    };
    
    // Цвета для типов орков
    const typeColors = {
        1: '#dc3545', 2: '#28a745', 3: '#17a2b8', 
        4: '#ffc107', 5: '#6f42c1', 6: '#fd7e14', 7: '#20c997'
    };
    
    // Инициализация
    init();
    
    function init() {
        // Проверяем доступность модуля
        checkModuleHealth();
        
        // Загружаем тестовые данные при загрузке страницы
        if (generateBtn) {
            generateTestData();
        }
        
        // Назначаем обработчики событий
        if (generateBtn) {
            generateBtn.addEventListener('click', generateTestData);
        }
        
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', optimizeExchanges);
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
    
    // Генерация тестовых данных
    async function generateTestData() {
        const playerCount = playerCountInput ? parseInt(playerCountInput.value) : 4;
        const cardsPerPlayer = cardsPerPlayerInput ? parseInt(cardsPerPlayerInput.value) : 10;
        
        try {
            const response = await fetch(`/api/orc-exchange/test-data?players=${playerCount}&cards=${cardsPerPlayer}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                currentPlayers = result.data;
                renderPlayers();
                updateSummary();
                if (optimizeBtn) optimizeBtn.disabled = false;
                clearExchanges();
            } else {
                showError('Ошибка при генерации данных: ' + result.error);
            }
        } catch (error) {
            showError('Ошибка сети: ' + error.message);
            console.error('Error details:', error);
        }
    }
    
    // Оптимизация обменов
    async function optimizeExchanges() {
        const maxIterations = maxIterationsInput ? parseInt(maxIterationsInput.value) : 100;
        
        const requestData = {
            players: currentPlayers.map(player => ({
                id: player.id,
                name: player.name,
                cards: player.cards
            })),
            maxIterations
        };
        
        try {
            const response = await fetch('/api/orc-exchange/optimize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                currentOptimization = result.data;
                currentPlayers = result.data.players.map((playerData, index) => ({
                    ...playerData,
                    cards: currentPlayers[index] ? currentPlayers[index].cards : []
                }));
                
                renderPlayers();
                updateSummary();
                renderExchanges();
                renderRecommendations();
                
                // Показываем предупреждения, если есть
                if (result.data.warnings && result.data.warnings.length > 0) {
                    result.data.warnings.forEach(warning => {
                        showNotification(warning, 'warning');
                    });
                }
                
                showSuccess(`Оптимизация завершена! Улучшение: +${result.data.improvement}`);
            } else {
                showError('Ошибка оптимизации: ' + result.error);
            }
        } catch (error) {
            showError('Ошибка сети: ' + error.message);
            console.error('Error details:', error);
        }
    }
    
    // Сброс данных
    function resetData() {
        currentPlayers = [];
        currentOptimization = null;
        if (playersContainer) playersContainer.innerHTML = '';
        clearExchanges();
        updateSummary();
        if (optimizeBtn) optimizeBtn.disabled = true;
    }
    
    // Отрисовка игроков
    function renderPlayers() {
        if (!playersContainer) return;
        
        playersContainer.innerHTML = '';
        
        currentPlayers.forEach(player => {
            const playerClone = playerTemplate.content.cloneNode(true);
            const playerCard = playerClone.querySelector('.player-card');
            
            if (!playerCard) return;
            
            // Заполняем данные игрока
            const playerNameEl = playerCard.querySelector('.player-name');
            const powerValueEl = playerCard.querySelector('.power-value');
            
            if (playerNameEl) playerNameEl.textContent = player.name || `Игрок ${player.id + 1}`;
            if (powerValueEl) powerValueEl.textContent = player.teamPower || 0;
            
            // Добавляем индикатор, если не может собрать полную команду
            if (player.canFormTeam === false) {
                const warningBadge = document.createElement('div');
                warningBadge.textContent = '⚠️ Неполная команда';
                warningBadge.style.cssText = `
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: #ff9800;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.8rem;
                    font-weight: bold;
                `;
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
                        
                        // Тип орка
                        const typeBadge = orcElement.querySelector('.orc-type-badge');
                        if (typeBadge) {
                            typeBadge.textContent = orcTypes[orc.type] || '?';
                            typeBadge.style.backgroundColor = typeColors[orc.type] || '#6c757d';
                            typeBadge.setAttribute('data-type', orc.type);
                        }
                        
                        // Мощность
                        const powerEl = orcElement.querySelector('.orc-power');
                        if (powerEl) powerEl.textContent = orc.power;
                        
                        // Предметы
                        const itemsContainer = orcElement.querySelector('.orc-items');
                        if (itemsContainer) {
                            itemsContainer.innerHTML = '';
                            
                            if (orc.earrings) {
                                const earrings = document.createElement('div');
                                earrings.className = 'item earrings';
                                earrings.textContent = '💎';
                                earrings.title = `Серьги: ${orc.earrings}`;
                                itemsContainer.appendChild(earrings);
                            }
                            
                            if (orc.amulet) {
                                const amulet = document.createElement('div');
                                amulet.className = 'item amulet';
                                amulet.textContent = '🔮';
                                amulet.title = `Амулет: ${orc.amulet}`;
                                itemsContainer.appendChild(amulet);
                            }
                            
                            if (orc.bracelet) {
                                const bracelet = document.createElement('div');
                                bracelet.className = 'item bracelet';
                                bracelet.textContent = '🛡️';
                                bracelet.title = `Браслет: ${orc.bracelet}`;
                                itemsContainer.appendChild(bracelet);
                            }
                        }
                        
                        teamOrcsContainer.appendChild(orcElement);
                    });
                }
                
                // Статистика команды
                if (teamStatsEl && player.team.stats) {
                    const stats = player.team.stats;
                    const statValues = teamStatsEl.querySelectorAll('.stat-value');
                    
                    if (statValues.length >= 4) {
                        statValues[0].textContent = stats.basePower || 0;
                        statValues[1].textContent = stats.bonuses?.earrings || 0;
                        statValues[2].textContent = stats.bonuses?.amulet || 0;
                        statValues[3].textContent = stats.bonuses?.bracelet || 0;
                    }
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
                    const cardClone = cardTemplate.content.cloneNode(true);
                    const cardElement = cardClone.querySelector('.card-item');
                    
                    if (!cardElement) return;
                    
                    // Тип карточки
                    const typeElement = cardElement.querySelector('.card-type');
                    if (typeElement) {
                        typeElement.textContent = `Т${card.type}`;
                        typeElement.style.backgroundColor = typeColors[card.type] || '#6c757d';
                    }
                    
                    // Мощность
                    const powerEl = cardElement.querySelector('.card-power');
                    if (powerEl) powerEl.textContent = card.power;
                    
                    // Предметы
                    const itemsContainer = cardElement.querySelector('.card-items');
                    if (itemsContainer) {
                        itemsContainer.innerHTML = '';
                        
                        if (card.earrings) {
                            const earrings = document.createElement('span');
                            earrings.className = 'item-icon';
                            earrings.textContent = '💎';
                            earrings.title = `Серьги: ${card.earrings}`;
                            itemsContainer.appendChild(earrings);
                        }
                        
                        if (card.amulet) {
                            const amulet = document.createElement('span');
                            amulet.className = 'item-icon';
                            amulet.textContent = '🔮';
                            amulet.title = `Амулет: ${card.amulet}`;
                            itemsContainer.appendChild(amulet);
                        }
                        
                        if (card.bracelet) {
                            const bracelet = document.createElement('span');
                            bracelet.className = 'item-icon';
                            bracelet.textContent = '🛡️';
                            bracelet.title = `Браслет: ${card.bracelet}`;
                            itemsContainer.appendChild(bracelet);
                        }
                    }
                    
                    // Подсветка карточек, которые входят в команду
                    if (player.team && player.team.orcs && 
                        player.team.orcs.some(orc => orc.id === card.id)) {
                        cardElement.style.borderColor = typeColors[card.type] || '#6c757d';
                        cardElement.style.borderWidth = '2px';
                    }
                    
                    cardsContainer.appendChild(cardElement);
                });
            }
            
            playersContainer.appendChild(playerCard);
        });
    }
    
    // Отрисовка обменов
    function renderExchanges() {
        if (!exchangesList) return;
        
        if (!currentOptimization || !currentOptimization.exchanges || currentOptimization.exchanges.length === 0) {
            exchangesList.innerHTML = '<p class="empty-message">Обмены еще не выполнялись</p>';
            return;
        }
        
        exchangesList.innerHTML = '';
        
        currentOptimization.exchanges.forEach((exchange, index) => {
            const exchangeClone = exchangeTemplate.content.cloneNode(true);
            const exchangeItem = exchangeClone.querySelector('.exchange-item');
            
            if (!exchangeItem) return;
            
            // Находим имена игроков
            const playerFromEl = exchangeItem.querySelector('.player-from');
            const playerToEl = exchangeItem.querySelector('.player-to');
            const improvementEl = exchangeItem.querySelector('.exchange-improvement span');
            const detailsBtn = exchangeItem.querySelector('.btn-details');
            
            const player1 = currentPlayers.find(p => p.id === exchange.player1Id);
            const player2 = currentPlayers.find(p => p.id === exchange.player2Id);
            
            if (playerFromEl) {
                playerFromEl.textContent = player1?.name || `Игрок ${exchange.player1Id + 1}`;
            }
            
            if (playerToEl) {
                playerToEl.textContent = player2?.name || `Игрок ${exchange.player2Id + 1}`;
            }
            
            if (improvementEl) {
                improvementEl.textContent = `+${exchange.improvement || 0}`;
            }
            
            // Обработчик для кнопки "Детали"
            if (detailsBtn) {
                detailsBtn.addEventListener('click', () => showExchangeDetails(exchange, player1, player2));
            }
            
            exchangesList.appendChild(exchangeItem);
        });
    }
    
    // Отрисовка рекомендаций
    function renderRecommendations() {
        if (!recommendationsList) return;
        
        if (!currentOptimization || !currentOptimization.recommendations || currentOptimization.recommendations.length === 0) {
            recommendationsList.innerHTML = '<p class="empty-message">Запустите оптимизацию для получения рекомендаций</p>';
            return;
        }
        
        recommendationsList.innerHTML = '';
        
        currentOptimization.recommendations.forEach(rec => {
            const div = document.createElement('div');
            div.className = 'recommendation-item';
            
            const icon = document.createElement('i');
            icon.className = rec.priority === 'high' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle';
            icon.style.color = rec.priority === 'high' ? '#dc3545' : '#17a2b8';
            icon.style.marginRight = '10px';
            
            div.appendChild(icon);
            div.appendChild(document.createTextNode(rec.description || 'Рекомендация'));
            
            recommendationsList.appendChild(div);
        });
    }
    
    // Показ деталей обмена
    function showExchangeDetails(exchange, player1, player2) {
        if (!modal || !exchangeDetails) return;
        
        exchangeDetails.innerHTML = `
            <div class="exchange-detail">
                <h4>Обмен между игроками</h4>
                <p><strong>${player1?.name || `Игрок ${exchange.player1Id + 1}`}</strong> ↔ <strong>${player2?.name || `Игрок ${exchange.player2Id + 1}`}</strong></p>
                
                <div class="exchange-cards">
                    <div class="card-detail">
                        <h5>Карточка от ${player1?.name || `Игрока ${exchange.player1Id + 1}`}:</h5>
                        <p>Тип: ${orcTypes[exchange.orc1Type] || '?'} (${exchange.orc1Type})</p>
                        <p>ID: ${exchange.orc1Id}</p>
                    </div>
                    
                    <div class="card-detail">
                        <h5>Карточка от ${player2?.name || `Игрока ${exchange.player2Id + 1}`}:</h5>
                        <p>Тип: ${orcTypes[exchange.orc2Type] || '?'} (${exchange.orc2Type})</p>
                        <p>ID: ${exchange.orc2Id}</p>
                    </div>
                </div>
                
                <div class="exchange-result">
                    <h5>Результат:</h5>
                    <p>Улучшение мощности: <strong style="color: #28a745;">+${exchange.improvement || 0}</strong></p>
                    <p>Время: ${new Date(exchange.timestamp || Date.now()).toLocaleTimeString()}</p>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
    }
    
    // Обновление сводки
    function updateSummary() {
        const totalPower = currentPlayers.reduce((sum, p) => sum + (p.teamPower || 0), 0);
        
        if (totalPowerEl) {
            totalPowerEl.textContent = totalPower;
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
        
        if (recommendationsList) {
            recommendationsList.innerHTML = '<p class="empty-message">Запустите оптимизацию для получения рекомендаций</p>';
        }
    }
    
    // Показать уведомление об ошибке
    function showError(message) {
        showNotification(message, 'error');
    }
    
    // Показать уведомление об успехе
    function showSuccess(message) {
        showNotification(message, 'success');
    }
    
    // Универсальная функция уведомлений
    function showNotification(message, type = 'info') {
        // Используем существующую систему уведомлений или создаем простую
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            // Простая реализация
            const notification = document.createElement('div');
            notification.textContent = message;
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                background: ${type === 'error' ? '#ffebee' : type === 'warning' ? '#fff3e0' : type === 'success' ? '#e8f5e9' : '#e3f2fd'};
                color: ${type === 'error' ? '#c62828' : type === 'warning' ? '#f57c00' : type === 'success' ? '#2e7d32' : '#1565c0'};
                border: 1px solid ${type === 'error' ? '#ffcdd2' : type === 'warning' ? '#ffe0b2' : type === 'success' ? '#c8e6c9' : '#bbdefb'};
                border-radius: 8px;
                z-index: 1000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 400px;
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 3000);
        }
    }
});