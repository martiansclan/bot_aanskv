const { Orc, Team } = require('./orc-exchange.utils'); // ДОБАВЛЯЕМ TeamOptimizer
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
        if (this.canFormFullTeam()) {
            return this.findBestFullTeam();
        } else {
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
        const availableTypes = [...new Set(this.cards.map(c => c.type))].sort((a, b) => a - b);
        
        if (availableTypes.length < 4) {
            return null;
        }
        
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

    clone() {
        const clonedCards = this.cards.map(card => {
            const orc = new Orc(
                card.id,
                card.type,
                card.power,
                card.earrings,
                card.logos, // ТЕПЕРЬ ЭТО ДОЛЖЕН БЫТЬ МАССИВ!
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
        this.originalPlayers = players.map(p => p.clone());
        this.initialTotalPower = this.calculateTotalPower();
    }

    calculateTotalPower() {
        return this.players.reduce((sum, p) => sum + (p.teamPower || 0), 0);
    }

    optimizeExchanges(maxIterations = 100) {
        console.log(`🔄 Оптимизация для ${this.players.length} игроков`);
        
        let iteration = 0;
        let totalImprovement = 0;
        const exchanges = [];
        
        while (iteration < maxIterations) {
            iteration++;
            let bestExchange = null;
            let bestImprovement = 0;
            
            for (let i = 0; i < this.players.length; i++) {
                for (let j = i + 1; j < this.players.length; j++) {
                    const player1 = this.players[i];
                    const player2 = this.players[j];
                    
                    for (const orc1 of player1.cards) {
                        for (const orc2 of player2.cards) {
                            if (orc1.type === orc2.type) continue;
                            
                            const simulatedPlayer1 = player1.clone();
                            const simulatedPlayer2 = player2.clone();
                            
                            const simOrc1 = simulatedPlayer1.cards.find(c => c.id === orc1.id);
                            const simOrc2 = simulatedPlayer2.cards.find(c => c.id === orc2.id);
                            
                            if (!simOrc1 || !simOrc2) continue;
                            
                            simulatedPlayer1.removeOrc(simOrc1);
                            simulatedPlayer2.removeOrc(simOrc2);
                            simulatedPlayer1.addOrc(simOrc2);
                            simulatedPlayer2.addOrc(simOrc1);
                            
                            simulatedPlayer1.updateTeam();
                            simulatedPlayer2.updateTeam();
                            
                            if (!simulatedPlayer1.team || !simulatedPlayer2.team) continue;
                            
                            const oldPower = player1.teamPower + player2.teamPower;
                            const newPower = simulatedPlayer1.teamPower + simulatedPlayer2.teamPower;
                            const improvement = newPower - oldPower;
                            
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
            
            if (bestExchange && bestImprovement > 0) {
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
                    }
                }
            } else {
                break;
            }
        }
        
        const finalTotalPower = this.calculateTotalPower();
        
        console.log(`✅ Оптимизация завершена за ${iteration} итераций`);
        console.log(`Начальная мощность: ${this.initialTotalPower}`);
        console.log(`Конечная мощность: ${finalTotalPower}`);
        console.log(`Улучшение: +${totalImprovement}`);
        console.log(`Обменов выполнено: ${exchanges.length}`);
        
        return {
            initialPower: this.initialTotalPower,
            optimizedPower: finalTotalPower,
            improvement: totalImprovement,
            exchanges: exchanges,
            iterations: iteration
        };
    }
}

async function generateRealData() {
    try {
        console.log('🔄 Загрузка реальных данных из NFT...');
        
        const playersData = await nftDataService.getRealPlayerData();
        
        if (!playersData || playersData.length === 0) {
            console.warning('❌ Не удалось загрузить реальные данные');
            return [];
        }
        
        const players = playersData.map(playerData => {
            const cards = playerData.cards.map(card => 
                new Orc(
                    card.id,
                    card.type,
                    card.power,
                    card.earrings,
                    card.logos, // ТЕПЕРЬ ЭТО ДОЛЖЕН БЫТЬ МАССИВ!
                    card.bracelet || ''
                )
            );
            return new Player(playerData.id, playerData.name, cards);
        });
        
        console.log(`✅ Загружено ${players.length} игроков`);
        return players;
    } catch (error) {
        console.error('❌ Ошибка генерации реальных данных:', error);
        return [];
    }
}

async function initialize() {
    try {
        console.log('🔄 Инициализация модуля обмена орками...');
        await nftDataService.initialize();
        console.log('✅ Модуль обмена орками инициализирован');
        return true;
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        return false;
    }
}

async function shutdown() {
    console.log('🛑 Остановка модуля обмена орками...');
    await nftDataService.shutdown();
    console.log('✅ Модуль остановлен');
}

module.exports = {
    Player,
    GlobalOptimizer,
    generateRealData,
    initialize,
    shutdown
};