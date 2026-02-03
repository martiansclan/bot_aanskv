const { Orc, Team, findBestTeam } = require('./orc-exchange.utils');

class Player {
    constructor(id, name, cards) {
        this.id = id;
        this.name = name || `Игрок ${id + 1}`;
        this.cards = cards || [];
        this.team = null;
        this.updateTeam();
    }

    updateTeam() {
        this.team = findBestTeam(this.cards);
        if (this.team) {
            this.teamPower = this.team.totalPower;
        } else {
            // Если не можем собрать полную команду, пытаемся собрать лучшую частичную
            this.team = this.findBestPartialTeam();
            this.teamPower = this.team ? this.team.totalPower : 0;
        }
    }

    findBestPartialTeam() {
    // Если можем собрать полную команду, возвращаем null (этот метод только для частичных команд)
        if (this.canFormTeam()) {
            return null;
        }
        
        // Находим доступные типы
        const availableTypes = [...new Set(this.cards.map(c => c.type))].sort((a, b) => a - b);
        
        if (availableTypes.length < 4) {
            console.log(`У игрока ${this.name} недостаточно типов: ${availableTypes.length}/4`);
            return null;
        }
        
        // Простой подход: берем лучшую карточку каждого доступного типа
        const bestCards = [];
        availableTypes.forEach(type => {
            const typeCards = this.cards.filter(c => c.type === type);
            // Берем карточку с максимальной мощностью
            const bestCard = typeCards.reduce((best, current) => 
                current.power > best.power ? current : best, typeCards[0]);
            bestCards.push(bestCard);
            
            // Ограничиваем максимальное количество орков в команде 7
            if (bestCards.length >= 7) return;
        });
        
        // Если набрали минимум 4 карточки, создаем команду
        if (bestCards.length >= 4) {
            return new Team(bestCards.slice(0, Math.min(7, bestCards.length)));
        }
        
        return null;
    }

    hasOrc(orc) {
        return this.cards.some(c => c.id === orc.id);
    }

    removeOrc(orc) {
        const index = this.cards.findIndex(c => c.id === orc.id);
        if (index !== -1) {
            return this.cards.splice(index, 1)[0];
        }
        return null;
    }

    addOrc(orc) {
        this.cards.push(orc);
    }

    canFormTeam() {
        const types = new Set(this.cards.map(c => c.type));
        return types.size === 7; // Есть все 7 типов
    }

    getTeamStats() {
        if (!this.team) return null;
        return this.team.getStats();
    }
}

class ExchangeOptimizer {
    constructor(players, config = {}) {
        this.players = players;
        this.config = config;
        this.totalPower = this.calculateTotalPower();
        this.exchangeHistory = [];
    }

    calculateTotalPower() {
        return this.players.reduce((sum, p) => sum + p.teamPower, 0);
    }

    tryExchange(player1, player2, orc1, orc2) {
        if (!player1.hasOrc(orc1) || !player2.hasOrc(orc2)) {
            return { success: false, reason: 'Карточка не найдена' };
        }

        // Сохраняем исходное состояние
        const oldState = {
            player1Cards: [...player1.cards],
            player2Cards: [...player2.cards],
            player1Team: player1.team,
            player2Team: player2.team,
            power: player1.teamPower + player2.teamPower
        };

        // Выполняем обмен
        player1.removeOrc(orc1);
        player2.removeOrc(orc2);
        player1.addOrc(orc2);
        player2.addOrc(orc1);

        // Обновляем команды
        player1.updateTeam();
        player2.updateTeam();

        // Проверяем, что оба могут собрать команду
        if (!player1.team || !player2.team) {
            // Откат
            player1.cards = oldState.player1Cards;
            player2.cards = oldState.player2Cards;
            player1.team = oldState.player1Team;
            player2.team = oldState.player2Team;
            player1.teamPower = oldState.player1Team ? oldState.player1Team.totalPower : 0;
            player2.teamPower = oldState.player2Team ? oldState.player2Team.totalPower : 0;
            return { success: false, reason: 'Невозможно собрать команду после обмена' };
        }

        const newPower = player1.teamPower + player2.teamPower;
        const improvement = newPower - oldState.power;

        if (improvement > 0) {
            this.totalPower += improvement;
            const exchange = {
                player1Id: player1.id,
                player2Id: player2.id,
                orc1Id: orc1.id,
                orc2Id: orc2.id,
                orc1Type: orc1.type,
                orc2Type: orc2.type,
                improvement,
                timestamp: new Date().toISOString()
            };
            this.exchangeHistory.push(exchange);
            
            return {
                success: true,
                exchange,
                newPower,
                oldPower: oldState.power,
                improvement
            };
        } else {
            // Откат если нет улучшения
            player1.cards = oldState.player1Cards;
            player2.cards = oldState.player2Cards;
            player1.team = oldState.player1Team;
            player2.team = oldState.player2Team;
            player1.teamPower = oldState.player1Team ? oldState.player1Team.totalPower : 0;
            player2.teamPower = oldState.player2Team ? oldState.player2Team.totalPower : 0;
            return { success: false, reason: 'Нет улучшения мощности' };
        }
    }

    optimize(maxIterations = 100) {
        let iteration = 0;
        let improvements = 0;
        const exchanges = [];

        while (iteration < maxIterations) {
            iteration++;
            let improvedThisIteration = false;

            for (let i = 0; i < this.players.length; i++) {
                for (let j = i + 1; j < this.players.length; j++) {
                    const player1 = this.players[i];
                    const player2 = this.players[j];

                    for (const orc1 of player1.cards) {
                        for (const orc2 of player2.cards) {
                            const result = this.tryExchange(player1, player2, orc1, orc2);
                            if (result.success) {
                                exchanges.push(result.exchange);
                                improvements++;
                                improvedThisIteration = true;
                                break;
                            }
                        }
                        if (improvedThisIteration) break;
                    }
                    if (improvedThisIteration) break;
                }
                if (improvedThisIteration) break;
            }

            if (!improvedThisIteration) {
                break;
            }
        }

        return {
            totalPower: this.totalPower,
            exchanges,
            improvements,
            iterations: iteration,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                teamPower: p.teamPower,
                canFormTeam: p.canFormTeam()
            }))
        };
    }

    generateRecommendations() {
        const recommendations = [];
        const analyzedPairs = new Set();

        for (let i = 0; i < this.players.length; i++) {
            for (let j = i + 1; j < this.players.length; j++) {
                const player1 = this.players[i];
                const player2 = this.players[j];
                const pairKey = `${player1.id}-${player2.id}`;
                
                if (analyzedPairs.has(pairKey)) continue;
                analyzedPairs.add(pairKey);

                // Анализируем потенциальные улучшения
                for (const orc1 of player1.team?.orcs || []) {
                    for (const orc2 of player2.team?.orcs || []) {
                        if (orc1.type === orc2.type) {
                            // Проверяем возможность собрать больше одинаковых предметов
                            const earrings1 = player1.team.orcs.map(o => o.earrings);
                            const earrings2 = player2.team.orcs.map(o => o.earrings);
                            
                            // Простая эвристика: если обмен помогает собрать 4+ одинаковых
                            const count1 = earrings1.filter(e => e === orc1.earrings).length;
                            const count2 = earrings2.filter(e => e === orc2.earrings).length;
                            
                            if (count1 >= 4 || count2 >= 4) {
                                recommendations.push({
                                    type: 'potential_bonus',
                                    player1Id: player1.id,
                                    player2Id: player2.id,
                                    description: `Обмен может улучшить бонусы за серьги`,
                                    priority: 'high'
                                });
                            }
                        }
                    }
                }
            }
        }

        return recommendations;
    }
}

// Генерация тестовых данных
function generateTestData(playerCount = 4, cardsPerPlayer = 10) {
    const players = [];
    let orcId = 1;
    
    const itemNames = {
        earrings: ['Рубиновые', 'Сапфировые', 'Изумрудные', 'Алмазные', 'Золотые'],
        amulets: ['Луны', 'Солнца', 'Звезды', 'Огня', 'Воды'],
        bracelets: ['Железный', 'Стальной', 'Золотой', 'Серебряный', '']
    };

    for (let p = 0; p < playerCount; p++) {
        const cards = [];
        
        // Гарантируем, что у каждого игрока есть хотя бы по одному орку каждого типа
        for (let type = 1; type <= 7; type++) {
            const power = Math.floor(Math.random() * 100) + 50;
            const earrings = itemNames.earrings[Math.floor(Math.random() * itemNames.earrings.length)];
            const amulet = itemNames.amulets[Math.floor(Math.random() * itemNames.amulets.length)];
            const bracelet = Math.random() > 0.3 ? itemNames.bracelets[Math.floor(Math.random() * itemNames.bracelets.length)] : '';
            
            cards.push(new Orc(orcId++, type, power, earrings, amulet, bracelet));
        }
        
        // Добавляем дополнительные случайные карточки
        const additionalCards = cardsPerPlayer - 7;
        for (let i = 0; i < additionalCards; i++) {
            const type = Math.floor(Math.random() * 7) + 1;
            const power = Math.floor(Math.random() * 100) + 50;
            const earrings = itemNames.earrings[Math.floor(Math.random() * itemNames.earrings.length)];
            const amulet = itemNames.amulets[Math.floor(Math.random() * itemNames.amulets.length)];
            const bracelet = Math.random() > 0.3 ? itemNames.bracelets[Math.floor(Math.random() * itemNames.bracelets.length)] : '';
            
            cards.push(new Orc(orcId++, type, power, earrings, amulet, bracelet));
        }
        
        players.push(new Player(p, `Игрок ${p + 1}`, cards));
    }

    return players;
}

// Метод initialize для вашей системы
async function initialize() {
    try {
        console.log('🔄 Инициализация модуля обмена орками...');
        
        // Здесь можно выполнить инициализацию базы данных, кэша и т.д.
        
        console.log('✅ Модуль обмена орками инициализирован');
        return true;
    } catch (error) {
        console.error('❌ Ошибка инициализации модуля обмена орками:', error);
        return false;
    }
}

// Метод shutdown для вашей системы
async function shutdown() {
    console.log('🛑 Остановка модуля обмена орками...');
    // Очистка ресурсов, если нужно
    console.log('✅ Модуль обмена орками остановлен');
}

module.exports = {
    Player,
    ExchangeOptimizer,
    generateTestData,
    initialize,
    shutdown
};