const { Orc, Team } = require('./orc-exchange.utils');
const { nftDataService } = require('./orc-exchange.nft.service');

class Player {
    constructor(id, name, cards) {
        this.id = id;
        this.name = name || `Игрок ${id + 1}`;
        this.cards = cards || [];
        this.team = null;
        this.updateTeam();
    }

    updateTeam() {
        this.team = this.findBestTeamForPlayer();
        this.teamPower = this.team ? this.team.totalPower : 0;
    }

    findBestTeamForPlayer() {
        // Если можем собрать полную команду, ищем лучшую
        if (this.canFormFullTeam()) {
            return this.findBestFullTeam();
        } else {
            // Если не можем собрать полную команду, собираем частичную
            return this.findBestPartialTeam();
        }
    }

    findBestFullTeam() {
        const byType = {};
        for (let i = 1; i <= 7; i++) {
            byType[i] = this.cards.filter(c => c.type === i);
        }

        let bestTeam = null;
        let bestPower = -Infinity;

        const backtrack = (current, type) => {
            if (type > 7) {
                const team = new Team([...current]);
                if (team.totalPower > bestPower) {
                    bestPower = team.totalPower;
                    bestTeam = team.orcs;
                }
                return;
            }

            for (const orc of byType[type]) {
                current.push(orc);
                backtrack(current, type + 1);
                current.pop();
            }
        };

        backtrack([], 1);
        return bestTeam ? new Team(bestTeam) : null;
    }

    canFormFullTeam() {
        const types = new Set(this.cards.map(c => c.type));
        return types.size === 7;
    }

    findBestPartialTeam() {
        // Находим доступные типы
        const availableTypes = [...new Set(this.cards.map(c => c.type))].sort((a, b) => a - b);
        
        if (availableTypes.length < 4) {
            return null;
        }
        
        // Берем лучшую карточку каждого доступного типа
        const bestCards = [];
        availableTypes.forEach(type => {
            const typeCards = this.cards.filter(c => c.type === type);
            const bestCard = typeCards.reduce((best, current) => 
                current.power > best.power ? current : best, typeCards[0]);
            bestCards.push(bestCard);
            
            if (bestCards.length >= 7) return;
        });
        
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
        return types.size >= 4;
    }

    getTeamStats() {
        if (!this.team) return null;
        return this.team.getStats();
    }

    // Клонирование игрока (для симуляции)
    clone() {
        const clonedCards = this.cards.map(card => {
            const orc = new Orc(
                card.id,
                card.type,
                card.power,
                card.earrings,
                card.amulet,
                card.bracelet || ''
            );
            orc.typeName = card.typeName;
            return orc;
        });
        const clonedPlayer = new Player(this.id, this.name, clonedCards);
        clonedPlayer.updateTeam();
        return clonedPlayer;
    }
}

class GlobalOptimizer {
    constructor(players) {
        this.players = players;
        this.originalPlayers = players.map(p => p.clone()); // Сохраняем исходное состояние
        this.initialTotalPower = this.calculateTotalPower();
    }

    calculateTotalPower() {
        return this.players.reduce((sum, p) => sum + (p.teamPower || 0), 0);
    }

    // НОВЫЙ МЕТОД: Оптимизация для улучшения синергии (бонусов за атрибуты)
    optimizeForSynergy(maxIterations = 100) {
        console.log('🌀 Запуск синергетической оптимизации...');
        
        const originalPower = this.calculateTotalPower();
        console.log(`Исходная мощность: ${originalPower}`);
        
        let totalImprovement = 0;
        const exchanges = [];
        const synergyGroups = this.analyzeSynergyPotential();
        
        console.log(`Найдено групп для синергии: ${Object.keys(synergyGroups.earrings).length} серёг, ${Object.keys(synergyGroups.amulet).length} лого, ${Object.keys(synergyGroups.bracelet).length} браслетов`);
        
        // Шаг 1: Оптимизация существующих групп (увеличиваем бонусы)
        console.log('🔍 Шаг 1: Увеличение существующих бонусов...');
        let iteration = 0;
        
        while (iteration < maxIterations / 2) {
            iteration++;
            let bestExchange = null;
            let bestImprovement = 0;
            
            // Ищем обмены, которые увеличивают бонусы за атрибуты
            for (let i = 0; i < this.players.length; i++) {
                for (let j = i + 1; j < this.players.length; j++) {
                    const player1 = this.players[i];
                    const player2 = this.players[j];
                    
                    // Анализируем атрибуты игроков
                    const player1Synergy = this.getPlayerSynergyGroups(player1);
                    const player2Synergy = this.getPlayerSynergyGroups(player2);
                    
                    // Ищем взаимовыгодные обмены для синергии
                    const potentialExchange = this.findSynergyExchange(
                        player1, player2, 
                        player1Synergy, player2Synergy
                    );
                    
                    if (potentialExchange && potentialExchange.improvement > bestImprovement) {
                        bestImprovement = potentialExchange.improvement;
                        bestExchange = potentialExchange;
                    }
                }
            }
            
            if (bestExchange && bestImprovement > 0) {
                // Применяем обмен
                const player1 = this.players.find(p => p.id === bestExchange.player1Id);
                const player2 = this.players.find(p => p.id === bestExchange.player2Id);
                
                if (player1 && player2) {
                    const orc1 = player1.cards.find(c => c.id === bestExchange.orc1Id);
                    const orc2 = player2.cards.find(c => c.id === bestExchange.orc2Id);
                    
                    if (orc1 && orc2) {
                        player1.removeOrc(orc1);
                        player2.removeOrc(orc2);
                        player1.addOrc(orc2);
                        player2.addOrc(orc1);
                        
                        player1.updateTeam();
                        player2.updateTeam();
                        
                        exchanges.push(bestExchange);
                        totalImprovement += bestImprovement;
                        
                        console.log(`Итерация ${iteration}: ${player1.name} ↔ ${player2.name}, +${bestImprovement} (синергия)`);
                    }
                }
            } else {
                break;
            }
        }
        
        // Шаг 2: Создание новых групп синергии
        console.log('🔍 Шаг 2: Создание новых групп синергии...');
        iteration = 0;
        
        while (iteration < maxIterations / 2) {
            iteration++;
            let bestExchange = null;
            let bestImprovement = 0;
            
            // Ищем орки с одинаковыми атрибутами у разных игроков
            const attributeMap = this.createAttributeMap();
            
            // Для каждой группы атрибутов пытаемся собрать больше у одного игрока
            for (const [attrType, values] of Object.entries(attributeMap)) {
                for (const [value, orcs] of Object.entries(values)) {
                    if (orcs.length >= 3) { // Есть потенциал для бонуса
                        // Распределение по игрокам
                        const playerDistribution = {};
                        orcs.forEach(orc => {
                            const player = this.findPlayerByOrcId(orc.id);
                            if (player) {
                                if (!playerDistribution[player.id]) {
                                    playerDistribution[player.id] = {
                                        player: player,
                                        orcs: [],
                                        count: 0
                                    };
                                }
                                playerDistribution[player.id].orcs.push(orc);
                                playerDistribution[player.id].count++;
                            }
                        });
                        
                        // Если атрибут распределен между несколькими игроками
                        if (Object.keys(playerDistribution).length > 1) {
                            // Пытаемся собрать больше у одного игрока
                            const exchange = this.findExchangeToConsolidateAttribute(
                                playerDistribution, attrType, value
                            );
                            
                            if (exchange && exchange.improvement > bestImprovement) {
                                bestImprovement = exchange.improvement;
                                bestExchange = exchange;
                            }
                        }
                    }
                }
            }
            
            if (bestExchange && bestImprovement > 0) {
                // Применяем обмен
                const player1 = this.players.find(p => p.id === bestExchange.player1Id);
                const player2 = this.players.find(p => p.id === bestExchange.player2Id);
                
                if (player1 && player2) {
                    const orc1 = player1.cards.find(c => c.id === bestExchange.orc1Id);
                    const orc2 = player2.cards.find(c => c.id === bestExchange.orc2Id);
                    
                    if (orc1 && orc2) {
                        player1.removeOrc(orc1);
                        player2.removeOrc(orc2);
                        player1.addOrc(orc2);
                        player2.addOrc(orc1);
                        
                        player1.updateTeam();
                        player2.updateTeam();
                        
                        exchanges.push(bestExchange);
                        totalImprovement += bestImprovement;
                        
                        console.log(`Итерация ${iteration}: Консолидация ${bestExchange.attributeType}="${bestExchange.attributeValue}", +${bestImprovement}`);
                    }
                }
            } else {
                break;
            }
        }
        
        const finalPower = this.calculateTotalPower();
        const improvement = finalPower - originalPower;
        
        console.log(`✅ Синергетическая оптимизация завершена`);
        console.log(`Исходная мощность: ${originalPower}`);
        console.log(`Новая мощность: ${finalPower}`);
        console.log(`Улучшение: +${improvement}`);
        console.log(`Обменов выполнено: ${exchanges.length}`);
        
        return {
            initialPower: originalPower,
            optimizedPower: finalPower,
            improvement: improvement,
            exchanges: exchanges,
            iterations: iteration
        };
    }

    // Анализ потенциала синергии
    analyzeSynergyPotential() {
        const synergyGroups = {
            earrings: {},
            amulet: {},
            bracelet: {}
        };
        
        // Собираем все атрибуты
        this.players.forEach(player => {
            player.cards.forEach(orc => {
                if (orc.earrings && orc.earrings.trim() !== '') {
                    if (!synergyGroups.earrings[orc.earrings]) {
                        synergyGroups.earrings[orc.earrings] = [];
                    }
                    synergyGroups.earrings[orc.earrings].push({
                        id: orc.id,
                        type: orc.type,
                        power: orc.power,
                        playerId: player.id,
                        playerName: player.name,
                        orc: orc
                    });
                }
                
                if (orc.amulet && orc.amulet.trim() !== '') {
                    if (!synergyGroups.amulet[orc.amulet]) {
                        synergyGroups.amulet[orc.amulet] = [];
                    }
                    synergyGroups.amulet[orc.amulet].push({
                        id: orc.id,
                        type: orc.type,
                        power: orc.power,
                        playerId: player.id,
                        playerName: player.name,
                        orc: orc
                    });
                }
                
                if (orc.bracelet && orc.bracelet.trim() !== '') {
                    if (!synergyGroups.bracelet[orc.bracelet]) {
                        synergyGroups.bracelet[orc.bracelet] = [];
                    }
                    synergyGroups.bracelet[orc.bracelet].push({
                        id: orc.id,
                        type: orc.type,
                        power: orc.power,
                        playerId: player.id,
                        playerName: player.name,
                        orc: orc
                    });
                }
            });
        });
        
        return synergyGroups;
    }

    // Получение групп синергии для игрока
    getPlayerSynergyGroups(player) {
        const groups = {
            earrings: {},
            amulet: {},
            bracelet: {}
        };
        
        player.cards.forEach(orc => {
            if (orc.earrings && orc.earrings.trim() !== '') {
                if (!groups.earrings[orc.earrings]) {
                    groups.earrings[orc.earrings] = [];
                }
                groups.earrings[orc.earrings].push(orc);
            }
            
            if (orc.amulet && orc.amulet.trim() !== '') {
                if (!groups.amulet[orc.amulet]) {
                    groups.amulet[orc.amulet] = [];
                }
                groups.amulet[orc.amulet].push(orc);
            }
            
            if (orc.bracelet && orc.bracelet.trim() !== '') {
                if (!groups.bracelet[orc.bracelet]) {
                    groups.bracelet[orc.bracelet] = [];
                }
                groups.bracelet[orc.bracelet].push(orc);
            }
        });
        
        return groups;
    }

    // Поиск обмена для улучшения синергии
    findSynergyExchange(player1, player2, synergy1, synergy2) {
        let bestExchange = null;
        let bestImprovement = 0;
        
        // Проверяем все возможные обмены между игроками
        for (const orc1 of player1.cards) {
            for (const orc2 of player2.cards) {
                if (orc1.type === orc2.type) continue;
                
                // Симулируем обмен
                const simPlayer1 = player1.clone();
                const simPlayer2 = player2.clone();
                
                const simOrc1 = simPlayer1.cards.find(c => c.id === orc1.id);
                const simOrc2 = simPlayer2.cards.find(c => c.id === orc2.id);
                
                if (!simOrc1 || !simOrc2) continue;
                
                simPlayer1.removeOrc(simOrc1);
                simPlayer2.removeOrc(simOrc2);
                simPlayer1.addOrc(simOrc2);
                simPlayer2.addOrc(simOrc1);
                
                simPlayer1.updateTeam();
                simPlayer2.updateTeam();
                
                if (!simPlayer1.team || !simPlayer2.team) continue;
                
                // Проверяем улучшение синергии
                const oldPower = player1.teamPower + player2.teamPower;
                const newPower = simPlayer1.teamPower + simPlayer2.teamPower;
                const improvement = newPower - oldPower;
                
                // Особый приоритет: если обмен создает/увеличивает бонус
                const createsBonus = this.checkIfCreatesBonus(simPlayer1, simPlayer2, orc1, orc2);
                
                if (improvement > bestImprovement || (createsBonus && improvement >= 0)) {
                    bestImprovement = improvement;
                    bestExchange = {
                        player1Id: player1.id,
                        player1Name: player1.name,
                        player2Id: player2.id,
                        player2Name: player2.name,
                        orc1Id: orc1.id,
                        orc2Id: orc2.id,
                        orc1Type: orc1.type,
                        orc2Type: orc2.type,
                        orc1TypeName: orc1.typeName,
                        orc2TypeName: orc2.typeName,
                        oldPlayer1Power: player1.teamPower,
                        oldPlayer2Power: player2.teamPower,
                        newPlayer1Power: simPlayer1.teamPower,
                        newPlayer2Power: simPlayer2.teamPower,
                        improvement: improvement,
                        synergyBonus: createsBonus
                    };
                }
            }
        }
        
        return bestExchange;
    }

    // Проверка, создает ли обмен новый бонус
    checkIfCreatesBonus(player1, player2, orc1, orc2) {
        // Проверяем бонусы за атрибуты в командах
        const team1 = player1.team;
        const team2 = player2.team;
        
        if (!team1 || !team2) return false;
        
        const stats1 = team1.getStats();
        const stats2 = team2.getStats();
        
        // Проверяем, появились ли новые бонусы
        const hasNewBonus = 
            (stats1.bonuses.earrings > 0 || stats1.bonuses.amulet > 0 || stats1.bonuses.bracelet > 0) ||
            (stats2.bonuses.earrings > 0 || stats2.bonuses.amulet > 0 || stats2.bonuses.bracelet > 0);
        
        return hasNewBonus;
    }

    // Создание карты атрибутов
    createAttributeMap() {
        const attributeMap = {
            earrings: {},
            amulet: {},
            bracelet: {}
        };
        
        this.players.forEach(player => {
            player.cards.forEach(orc => {
                if (orc.earrings && orc.earrings.trim() !== '') {
                    if (!attributeMap.earrings[orc.earrings]) {
                        attributeMap.earrings[orc.earrings] = [];
                    }
                    attributeMap.earrings[orc.earrings].push({
                        id: orc.id,
                        playerId: player.id,
                        orc: orc
                    });
                }
                
                if (orc.amulet && orc.amulet.trim() !== '') {
                    if (!attributeMap.amulet[orc.amulet]) {
                        attributeMap.amulet[orc.amulet] = [];
                    }
                    attributeMap.amulet[orc.amulet].push({
                        id: orc.id,
                        playerId: player.id,
                        orc: orc
                    });
                }
                
                if (orc.bracelet && orc.bracelet.trim() !== '') {
                    if (!attributeMap.bracelet[orc.bracelet]) {
                        attributeMap.bracelet[orc.bracelet] = [];
                    }
                    attributeMap.bracelet[orc.bracelet].push({
                        id: orc.id,
                        playerId: player.id,
                        orc: orc
                    });
                }
            });
        });
        
        return attributeMap;
    }

    // Поиск игрока по ID орка
    findPlayerByOrcId(orcId) {
        for (const player of this.players) {
            if (player.cards.some(c => c.id === orcId)) {
                return player;
            }
        }
        return null;
    }

    // Поиск обмена для консолидации атрибута у одного игрока
    findExchangeToConsolidateAttribute(playerDistribution, attrType, attrValue) {
        // Находим игрока с наибольшим количеством этого атрибута
        let targetPlayer = null;
        let maxCount = 0;
        
        Object.values(playerDistribution).forEach(dist => {
            if (dist.count > maxCount) {
                maxCount = dist.count;
                targetPlayer = dist.player;
            }
        });
        
        if (!targetPlayer || maxCount < 2) return null;
        
        // Ищем игрока с таким же атрибутом, у которого можно взять орка
        for (const [playerId, dist] of Object.entries(playerDistribution)) {
            if (dist.player.id === targetPlayer.id) continue;
            
            // У этого игрока есть орк с нужным атрибутом
            for (const sourceOrc of dist.orcs) {
                // Ищем у целевого игрока орка для обмена
                for (const targetOrc of targetPlayer.cards) {
                    // Не обмениваем орков с таким же атрибутом
                    if (this.getOrcAttribute(targetOrc, attrType) === attrValue) continue;
                    
                    // Симулируем обмен
                    const simTarget = targetPlayer.clone();
                    const simSource = dist.player.clone();
                    
                    const simTargetOrc = simTarget.cards.find(c => c.id === targetOrc.id);
                    const simSourceOrc = simSource.cards.find(c => c.id === sourceOrc.id);
                    
                    if (!simTargetOrc || !simSourceOrc) continue;
                    
                    simTarget.removeOrc(simTargetOrc);
                    simSource.removeOrc(simSourceOrc);
                    simTarget.addOrc(simSourceOrc);
                    simSource.addOrc(simTargetOrc);
                    
                    simTarget.updateTeam();
                    simSource.updateTeam();
                    
                    if (!simTarget.team || !simSource.team) continue;
                    
                    const oldPower = targetPlayer.teamPower + dist.player.teamPower;
                    const newPower = simTarget.teamPower + simSource.teamPower;
                    const improvement = newPower - oldPower;
                    
                    if (improvement > 0) {
                        return {
                            player1Id: targetPlayer.id,
                            player1Name: targetPlayer.name,
                            player2Id: dist.player.id,
                            player2Name: dist.player.name,
                            orc1Id: targetOrc.id,
                            orc2Id: sourceOrc.id,
                            orc1Type: targetOrc.type,
                            orc2Type: sourceOrc.type,
                            orc1TypeName: targetOrc.typeName,
                            orc2TypeName: sourceOrc.typeName,
                            oldPlayer1Power: targetPlayer.teamPower,
                            oldPlayer2Power: dist.player.teamPower,
                            newPlayer1Power: simTarget.teamPower,
                            newPlayer2Power: simSource.teamPower,
                            improvement: improvement,
                            attributeType: attrType,
                            attributeValue: attrValue,
                            reason: `Консолидация ${attrType} "${attrValue}"`
                        };
                    }
                }
            }
        }
        
        return null;
    }

    // Получение атрибута орка
    getOrcAttribute(orc, attrType) {
        switch(attrType) {
            case 'earrings': return orc.earrings;
            case 'amulet': return orc.amulet;
            case 'bracelet': return orc.bracelet;
            default: return '';
        }
    }

    // Основной метод оптимизации - пошаговые обмены
    optimizeExchanges(maxIterations = 100) {
        console.log('🔄 Начало оптимизации обменов...');
        console.log(`Начальная мощность: ${this.initialTotalPower}`);
        
        let iteration = 0;
        let totalImprovement = 0;
        const exchanges = [];
        
        while (iteration < maxIterations) {
            iteration++;
            let bestExchange = null;
            let bestImprovement = 0;
            
            // Ищем лучший обмен среди всех пар игроков
            for (let i = 0; i < this.players.length; i++) {
                for (let j = i + 1; j < this.players.length; j++) {
                    const player1 = this.players[i];
                    const player2 = this.players[j];
                    
                    // Для каждого орка первого игрока
                    for (const orc1 of player1.cards) {
                        // Для каждого орка второго игрока
                        for (const orc2 of player2.cards) {
                            // Пропускаем обмен орков одного типа
                            if (orc1.type === orc2.type) continue;
                            
                            // Симулируем обмен
                            const simulatedPlayer1 = player1.clone();
                            const simulatedPlayer2 = player2.clone();
                            
                            // Находим орки в клонированных коллекциях
                            const simOrc1 = simulatedPlayer1.cards.find(c => c.id === orc1.id);
                            const simOrc2 = simulatedPlayer2.cards.find(c => c.id === orc2.id);
                            
                            if (!simOrc1 || !simOrc2) continue;
                            
                            // Выполняем обмен
                            simulatedPlayer1.removeOrc(simOrc1);
                            simulatedPlayer2.removeOrc(simOrc2);
                            simulatedPlayer1.addOrc(simOrc2);
                            simulatedPlayer2.addOrc(simOrc1);
                            
                            // Обновляем команды
                            simulatedPlayer1.updateTeam();
                            simulatedPlayer2.updateTeam();
                            
                            // Проверяем, что оба могут собрать команду
                            if (!simulatedPlayer1.team || !simulatedPlayer2.team) continue;
                            
                            // Рассчитываем улучшение
                            const oldPower = player1.teamPower + player2.teamPower;
                            const newPower = simulatedPlayer1.teamPower + simulatedPlayer2.teamPower;
                            const improvement = newPower - oldPower;
                            
                            // Если это лучший обмен на данной итерации
                            if (improvement > bestImprovement) {
                                bestImprovement = improvement;
                                bestExchange = {
                                    player1Id: player1.id,
                                    player1Name: player1.name,
                                    player2Id: player2.id,
                                    player2Name: player2.name,
                                    orc1Id: orc1.id,
                                    orc2Id: orc2.id,
                                    orc1Type: orc1.type,
                                    orc2Type: orc2.type,
                                    orc1TypeName: orc1.typeName,
                                    orc2TypeName: orc2.typeName,
                                    oldPlayer1Power: player1.teamPower,
                                    oldPlayer2Power: player2.teamPower,
                                    newPlayer1Power: simulatedPlayer1.teamPower,
                                    newPlayer2Power: simulatedPlayer2.teamPower,
                                    improvement: improvement
                                };
                            }
                        }
                    }
                }
            }
            
            // Если нашли улучшающий обмен, применяем его
            if (bestExchange && bestImprovement > 0) {
                const player1 = this.players.find(p => p.id === bestExchange.player1Id);
                const player2 = this.players.find(p => p.id === bestExchange.player2Id);
                
                if (player1 && player2) {
                    // Находим орки для обмена
                    const orc1 = player1.cards.find(c => c.id === bestExchange.orc1Id);
                    const orc2 = player2.cards.find(c => c.id === bestExchange.orc2Id);
                    
                    if (orc1 && orc2) {
                        // Выполняем обмен
                        player1.removeOrc(orc1);
                        player2.removeOrc(orc2);
                        player1.addOrc(orc2);
                        player2.addOrc(orc1);
                        
                        // Обновляем команды
                        player1.updateTeam();
                        player2.updateTeam();
                        
                        // Добавляем обмен в историю
                        exchanges.push(bestExchange);
                        totalImprovement += bestImprovement;
                        
                        console.log(`Итерация ${iteration}: ${player1.name} ↔ ${player2.name}, улучшение +${bestImprovement}`);
                    }
                }
            } else {
                // Не нашли улучшающих обменов
                break;
            }
        }
        
        const finalTotalPower = this.calculateTotalPower();
        
        console.log(`✅ Оптимизация завершена за ${iteration} итераций`);
        console.log(`Начальная мощность: ${this.initialTotalPower}`);
        console.log(`Конечная мощность: ${finalTotalPower}`);
        console.log(`Улучшение: +${totalImprovement}`);
        
        return {
            initialPower: this.initialTotalPower,
            optimizedPower: finalTotalPower,
            improvement: totalImprovement,
            exchanges: exchanges,
            iterations: iteration
        };
    }

    // УПРОЩЕННЫЙ ГЕНЕТИЧЕСКИЙ АЛГОРИТМ - ФОКУС НА ОБМЕНАХ, А НЕ НА ПЕРЕРАСПРЕДЕЛЕНИИ
    optimizeWithGeneticAlgorithm(generations = 50, populationSize = 20) {
        console.log('🧬 Запуск упрощенного генетического алгоритма...');
        
        const originalPower = this.initialTotalPower;
        console.log(`Исходная мощность: ${originalPower}`);
        
        // Создаем начальную популяцию (варианты обменов)
        let population = this.createInitialPopulation(populationSize);
        let bestSolution = null;
        let bestPower = originalPower;
        
        for (let gen = 0; gen < generations; gen++) {
            // Оцениваем каждую особь
            population.forEach(solution => {
                const power = this.evaluateSolution(solution);
                if (power > bestPower) {
                    bestPower = power;
                    bestSolution = this.cloneSolution(solution);
                }
            });
            
            // Создаем новое поколение
            const newPopulation = [];
            
            // Отбираем лучшие решения (элитизм)
            population.sort((a, b) => this.evaluateSolution(b) - this.evaluateSolution(a));
            const eliteCount = Math.max(2, Math.floor(populationSize * 0.1));
            for (let i = 0; i < eliteCount; i++) {
                newPopulation.push(this.cloneSolution(population[i]));
            }
            
            // Создаем новые решения через комбинацию лучших
            while (newPopulation.length < populationSize) {
                // Выбираем двух родителей
                const parent1 = this.selectParent(population);
                const parent2 = this.selectParent(population);
                
                // Создаем потомка через комбинацию
                const child = this.crossover(parent1, parent2);
                
                // Мутируем потомка
                const mutatedChild = this.mutate(child);
                
                newPopulation.push(mutatedChild);
            }
            
            population = newPopulation;
            
            if (gen % 10 === 0 || gen === generations - 1) {
                console.log(`Поколение ${gen + 1}: лучшая мощность = ${bestPower}`);
            }
        }
        
        // Применяем лучшее решение
        if (bestSolution && bestSolution.length > 0) {
            console.log(`Применяем лучшее решение с ${bestSolution.length} обменами`);
            
            // Откатываем все изменения
            this.resetToOriginal();
            
            // Применяем обмены из лучшего решения
            const appliedExchanges = [];
            bestSolution.forEach(exchange => {
                const player1 = this.players.find(p => p.id === exchange.player1Id);
                const player2 = this.players.find(p => p.id === exchange.player2Id);
                
                if (player1 && player2) {
                    const orc1 = player1.cards.find(c => c.id === exchange.orc1Id);
                    const orc2 = player2.cards.find(c => c.id === exchange.orc2Id);
                    
                    if (orc1 && orc2) {
                        // Выполняем обмен
                        player1.removeOrc(orc1);
                        player2.removeOrc(orc2);
                        player1.addOrc(orc2);
                        player2.addOrc(orc1);
                        
                        player1.updateTeam();
                        player2.updateTeam();
                        
                        appliedExchanges.push({
                            ...exchange,
                            oldPlayer1Power: exchange.oldPlayer1Power,
                            oldPlayer2Power: exchange.oldPlayer2Power,
                            newPlayer1Power: player1.teamPower,
                            newPlayer2Power: player2.teamPower,
                            improvement: (player1.teamPower + player2.teamPower) - 
                                       (exchange.oldPlayer1Power + exchange.oldPlayer2Power)
                        });
                    }
                }
            });
            
            const finalPower = this.calculateTotalPower();
            const improvement = finalPower - originalPower;
            
            console.log(`✅ Генетический алгоритм завершен`);
            console.log(`Исходная мощность: ${originalPower}`);
            console.log(`Новая мощность: ${finalPower}`);
            console.log(`Улучшение: +${improvement}`);
            
            return {
                initialPower: originalPower,
                optimalPower: finalPower,
                improvement: improvement,
                exchanges: appliedExchanges,
                iterations: generations
            };
        }
        
        // Если не нашли улучшений, возвращаем исходное состояние
        console.log('Не найдено улучшающих обменов');
        return {
            initialPower: originalPower,
            optimalPower: originalPower,
            improvement: 0,
            exchanges: [],
            iterations: generations
        };
    }

    // Создание начальной популяции (случайные обмены)
    createInitialPopulation(populationSize) {
        const population = [];
        
        for (let i = 0; i < populationSize; i++) {
            const solution = [];
            const maxExchanges = Math.min(10, Math.floor(this.players.length / 2));
            const exchangeCount = Math.floor(Math.random() * maxExchanges) + 1;
            
            for (let j = 0; j < exchangeCount; j++) {
                // Выбираем случайную пару игроков
                const player1Index = Math.floor(Math.random() * this.players.length);
                let player2Index;
                do {
                    player2Index = Math.floor(Math.random() * this.players.length);
                } while (player2Index === player1Index);
                
                const player1 = this.originalPlayers[player1Index];
                const player2 = this.originalPlayers[player2Index];
                
                if (player1.cards.length > 0 && player2.cards.length > 0) {
                    // Выбираем случайные орки
                    const orc1 = player1.cards[Math.floor(Math.random() * player1.cards.length)];
                    const orc2 = player2.cards[Math.floor(Math.random() * player2.cards.length)];
                    
                    // Проверяем, что типы разные
                    if (orc1.type !== orc2.type) {
                        // Симулируем обмен
                        const simPlayer1 = player1.clone();
                        const simPlayer2 = player2.clone();
                        
                        const simOrc1 = simPlayer1.cards.find(c => c.id === orc1.id);
                        const simOrc2 = simPlayer2.cards.find(c => c.id === orc2.id);
                        
                        if (simOrc1 && simOrc2) {
                            simPlayer1.removeOrc(simOrc1);
                            simPlayer2.removeOrc(simOrc2);
                            simPlayer1.addOrc(simOrc2);
                            simPlayer2.addOrc(simOrc1);
                            
                            simPlayer1.updateTeam();
                            simPlayer2.updateTeam();
                            
                            // Добавляем только если оба могут собрать команду
                            if (simPlayer1.team && simPlayer2.team) {
                                solution.push({
                                    player1Id: player1.id,
                                    player1Name: player1.name,
                                    player2Id: player2.id,
                                    player2Name: player2.name,
                                    orc1Id: orc1.id,
                                    orc2Id: orc2.id,
                                    orc1Type: orc1.type,
                                    orc2Type: orc2.type,
                                    orc1TypeName: orc1.typeName,
                                    orc2TypeName: orc2.typeName,
                                    oldPlayer1Power: player1.teamPower,
                                    oldPlayer2Power: player2.teamPower,
                                    newPlayer1Power: simPlayer1.teamPower,
                                    newPlayer2Power: simPlayer2.teamPower,
                                    improvement: (simPlayer1.teamPower + simPlayer2.teamPower) - 
                                               (player1.teamPower + player2.teamPower)
                                });
                            }
                        }
                    }
                }
            }
            
            population.push(solution);
        }
        
        return population;
    }

    // Оценка решения (симуляция всех обменов)
    evaluateSolution(solution) {
        if (solution.length === 0) return this.initialTotalPower;
        
        // Создаем копию оригинальных игроков
        const simulatedPlayers = this.originalPlayers.map(p => p.clone());
        
        // Применяем все обмены из решения
        solution.forEach(exchange => {
            const player1 = simulatedPlayers.find(p => p.id === exchange.player1Id);
            const player2 = simulatedPlayers.find(p => p.id === exchange.player2Id);
            
            if (player1 && player2) {
                const orc1 = player1.cards.find(c => c.id === exchange.orc1Id);
                const orc2 = player2.cards.find(c => c.id === exchange.orc2Id);
                
                if (orc1 && orc2) {
                    player1.removeOrc(orc1);
                    player2.removeOrc(orc2);
                    player1.addOrc(orc2);
                    player2.addOrc(orc1);
                    
                    player1.updateTeam();
                    player2.updateTeam();
                }
            }
        });
        
        // Вычисляем общую мощность
        return simulatedPlayers.reduce((sum, p) => sum + (p.teamPower || 0), 0);
    }

    // Выбор родителя (турнирная селекция)
    selectParent(population) {
        const tournamentSize = 3;
        const tournament = [];
        
        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * population.length);
            tournament.push({
                solution: population[randomIndex],
                fitness: this.evaluateSolution(population[randomIndex])
            });
        }
        
        tournament.sort((a, b) => b.fitness - a.fitness);
        return tournament[0].solution;
    }

    // Скрещивание (объединение обменов из двух решений)
    crossover(parent1, parent2) {
        const child = [];
        const combinedExchanges = [...parent1, ...parent2];
        
        if (combinedExchanges.length === 0) return child;
        
        // Убираем дубликаты (обмены с одинаковыми орками)
        const seenOrcPairs = new Set();
        combinedExchanges.forEach(exchange => {
            const key = `${exchange.orc1Id}-${exchange.orc2Id}`;
            if (!seenOrcPairs.has(key)) {
                seenOrcPairs.add(key);
                child.push(exchange);
            }
        });
        
        // Ограничиваем количество обменов
        const maxExchanges = Math.min(10, Math.floor(this.players.length / 2));
        if (child.length > maxExchanges) {
            return child.slice(0, maxExchanges);
        }
        
        return child;
    }

    // Мутация (добавление/удаление/изменение обменов)
    mutate(solution) {
        const mutated = [...solution];
        
        // С вероятностью 30% добавляем новый обмен
        if (Math.random() < 0.3 && mutated.length < 10) {
            const newExchange = this.generateRandomExchange();
            if (newExchange && newExchange.improvement > 0) {
                mutated.push(newExchange);
            }
        }
        
        // С вероятностью 20% удаляем случайный обмен
        if (Math.random() < 0.2 && mutated.length > 0) {
            const indexToRemove = Math.floor(Math.random() * mutated.length);
            mutated.splice(indexToRemove, 1);
        }
        
        // С вероятностью 25% изменяем случайный обмен
        if (Math.random() < 0.25 && mutated.length > 0) {
            const indexToChange = Math.floor(Math.random() * mutated.length);
            const newExchange = this.generateRandomExchange();
            if (newExchange && newExchange.improvement > 0) {
                mutated[indexToChange] = newExchange;
            }
        }
        
        return mutated;
    }

    // Генерация случайного обмена
    generateRandomExchange() {
        if (this.players.length < 2) return null;
        
        // Выбираем случайную пару игроков
        const player1Index = Math.floor(Math.random() * this.players.length);
        let player2Index;
        do {
            player2Index = Math.floor(Math.random() * this.players.length);
        } while (player2Index === player1Index);
        
        const player1 = this.originalPlayers[player1Index];
        const player2 = this.originalPlayers[player2Index];
        
        if (player1.cards.length === 0 || player2.cards.length === 0) return null;
        
        // Выбираем случайные орки
        const orc1 = player1.cards[Math.floor(Math.random() * player1.cards.length)];
        const orc2 = player2.cards[Math.floor(Math.random() * player2.cards.length)];
        
        // Проверяем, что типы разные
        if (orc1.type === orc2.type) return null;
        
        // Симулируем обмен
        const simPlayer1 = player1.clone();
        const simPlayer2 = player2.clone();
        
        const simOrc1 = simPlayer1.cards.find(c => c.id === orc1.id);
        const simOrc2 = simPlayer2.cards.find(c => c.id === orc2.id);
        
        if (!simOrc1 || !simOrc2) return null;
        
        simPlayer1.removeOrc(simOrc1);
        simPlayer2.removeOrc(simOrc2);
        simPlayer1.addOrc(simOrc2);
        simPlayer2.addOrc(simOrc1);
        
        simPlayer1.updateTeam();
        simPlayer2.updateTeam();
        
        // Проверяем, что оба могут собрать команду
        if (!simPlayer1.team || !simPlayer2.team) return null;
        
        const improvement = (simPlayer1.teamPower + simPlayer2.teamPower) - 
                          (player1.teamPower + player2.teamPower);
        
        if (improvement <= 0) return null;
        
        return {
            player1Id: player1.id,
            player1Name: player1.name,
            player2Id: player2.id,
            player2Name: player2.name,
            orc1Id: orc1.id,
            orc2Id: orc2.id,
            orc1Type: orc1.type,
            orc2Type: orc2.type,
            orc1TypeName: orc1.typeName,
            orc2TypeName: orc2.typeName,
            oldPlayer1Power: player1.teamPower,
            oldPlayer2Power: player2.teamPower,
            newPlayer1Power: simPlayer1.teamPower,
            newPlayer2Power: simPlayer2.teamPower,
            improvement: improvement
        };
    }

    // Клонирование решения
    cloneSolution(solution) {
        return solution.map(exchange => ({ ...exchange }));
    }

    // Сброс к исходному состоянию
    resetToOriginal() {
        // Восстанавливаем оригинальные карты
        this.originalPlayers.forEach(originalPlayer => {
            const currentPlayer = this.players.find(p => p.id === originalPlayer.id);
            if (currentPlayer) {
                currentPlayer.cards = originalPlayer.cards.map(card => {
                    const orc = new Orc(
                        card.id,
                        card.type,
                        card.power,
                        card.earrings,
                        card.amulet,
                        card.bracelet || ''
                    );
                    orc.typeName = card.typeName;
                    return orc;
                });
                currentPlayer.updateTeam();
            }
        });
    }
}



// Генерация реальных данных из NFT
async function generateRealData() {
    try {
        console.log('🔄 Загрузка реальных данных из NFT...');
        
        const playersData = await nftDataService.getRealPlayerData();
        
        if (!playersData || playersData.length === 0) {
            console.warning('❌ Не удалось загрузить реальные данные, возвращаю пустой массив');
            return [];
        }
        
        const players = playersData.map(playerData => {
            const cards = playerData.cards.map(card => 
                new Orc(
                    card.id,
                    card.type,
                    card.power,
                    card.earrings,
                    card.amulet,
                    card.bracelet || ''
                )
            );
            return new Player(playerData.id, playerData.name, cards);
        });
        
        console.log(`✅ Загружено ${players.length} игроков с реальными данными`);
        return players;
    } catch (error) {
        console.error('❌ Ошибка генерации реальных данных:', error);
        return [];
    }
}

// Метод initialize для вашей системы
async function initialize() {
    try {
        console.log('🔄 Инициализация модуля обмена орками...');
        
        // Инициализируем NFT сервис
        await nftDataService.initialize();
        
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
    
    // Останавливаем NFT сервис
    await nftDataService.shutdown();
    
    // Очистка ресурсов, если нужно
    console.log('✅ Модуль обмена орками остановлен');
}

module.exports = {
    Player,
    GlobalOptimizer,
    generateRealData,
    initialize,
    shutdown
};