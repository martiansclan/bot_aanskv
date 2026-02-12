// Используем ваш логгер
const logger = require('../../core/utils/logger');
const service = require('./orc-exchange.service');
const utils = require('./orc-exchange.utils');
const { nftDataService } = require('./orc-exchange.nft.service');

// Вспомогательная функция для генерации рекомендаций на основе сравнения
function generateExchangeRecommendationsFromComparison(originalPlayers, optimizedPlayers) {
    const recommendations = [];
    
    // Сравниваем каждого игрока
    originalPlayers.forEach((origPlayer, index) => {
        const optPlayer = optimizedPlayers.find(p => p.id === origPlayer.id);
        if (!optPlayer) return;
        
        // Сравниваем команды
        const origTeam = origPlayer.team ? new Set(origPlayer.team.orcs.map(o => o.id)) : new Set();
        const optTeam = optPlayer.team ? new Set(optPlayer.team.orcs.map(o => o.id)) : new Set();
        
        // Находим орков, которые покинули команду
        const orcsLeftTeam = [...origTeam].filter(id => !optTeam.has(id));
        // Находим орков, которые пришли в команду
        const orcsJoinedTeam = [...optTeam].filter(id => !origTeam.has(id));
        
        // Если есть изменения в команде
        if (orcsLeftTeam.length > 0 || orcsJoinedTeam.length > 0) {
            const recommendation = {
                playerName: origPlayer.name,
                playerId: origPlayer.id,
                changes: [],
                powerChange: (optPlayer.teamPower || 0) - (origPlayer.teamPower || 0)
            };
            
            // Анализируем, какие орки ушли
            orcsLeftTeam.forEach(orcId => {
                const orcData = origPlayer.cards?.find(c => c.id === orcId);
                if (orcData) {
                    // Ищем, у какого игрока теперь этот орк
                    const newOwner = optimizedPlayers.find(p => 
                        p.cards?.some(c => c.id === orcId) && p.id !== origPlayer.id
                    );
                    
                    if (newOwner) {
                        recommendation.changes.push({
                            type: 'give',
                            action: `Передать игроку ${newOwner.name} орка #${orcId} (${orcData.typeName})`,
                            orcId: orcId,
                            orcType: orcData.type,
                            orcTypeName: orcData.typeName,
                            toPlayerId: newOwner.id,
                            toPlayerName: newOwner.name,
                            reason: 'Для улучшения синергии команды'
                        });
                    }
                }
            });
            
            // Анализируем, какие орки пришли
            orcsJoinedTeam.forEach(orcId => {
                const orcData = optPlayer.cards?.find(c => c.id === orcId);
                if (orcData) {
                    // Ищем, у какого игрока был этот орк раньше
                    const previousOwner = originalPlayers.find(p => 
                        p.cards?.some(c => c.id === orcId) && p.id !== origPlayer.id
                    );
                    
                    if (previousOwner) {
                        recommendation.changes.push({
                            type: 'receive',
                            action: `Получить от игрока ${previousOwner.name} орка #${orcId} (${orcData.typeName})`,
                            orcId: orcId,
                            orcType: orcData.type,
                            orcTypeName: orcData.typeName,
                            fromPlayerId: previousOwner.id,
                            fromPlayerName: previousOwner.name,
                            reason: 'Для улучшения синергии команды'
                        });
                    }
                }
            });
            
            if (recommendation.changes.length > 0) {
                recommendations.push(recommendation);
            }
        }
    });
    
    return recommendations;
}

// Вспомогательная функция для генерации плана обменов
function generateExchangePlan(exchanges, players) {
    const plan = [];
    const executedExchanges = new Set();
    
    // Сортируем обмены по улучшению (убывание)
    const sortedExchanges = [...exchanges].sort((a, b) => b.improvement - a.improvement);
    
    // Выбираем независимые обмены (без конфликтов)
    sortedExchanges.forEach(exchange => {
        const exchangeKey = `${exchange.player1Id}-${exchange.orc1Id}-${exchange.player2Id}-${exchange.orc2Id}`;
        
        if (!executedExchanges.has(exchangeKey)) {
            const reverseKey = `${exchange.player2Id}-${exchange.orc2Id}-${exchange.player1Id}-${exchange.orc1Id}`;
            
            // Проверяем, не конфликтует ли этот обмен с уже выполненными
            const conflicts = plan.some(executed => 
                executed.orc1Id === exchange.orc1Id || 
                executed.orc2Id === exchange.orc2Id ||
                executed.orc1Id === exchange.orc2Id || 
                executed.orc2Id === exchange.orc1Id
            );
            
            if (!conflicts) {
                const fromPlayer = players.find(p => p.id === exchange.player1Id);
                const toPlayer = players.find(p => p.id === exchange.player2Id);
                
                if (fromPlayer && toPlayer) {
                    plan.push({
                        step: plan.length + 1,
                        description: `${fromPlayer.name} передает орка #${exchange.orc1Id} (тип ${exchange.orc1Type}) игроку ${toPlayer.name} в обмен на орка #${exchange.orc2Id} (тип ${exchange.orc2Type})`,
                        improvement: exchange.improvement,
                        playersInvolved: [fromPlayer.name, toPlayer.name]
                    });
                    
                    executedExchanges.add(exchangeKey);
                    executedExchanges.add(reverseKey);
                }
            }
        }
    });
    
    return plan;
}

// Вспомогательная функция для анализа предметов
function analyzeItems(playersData, itemType) {
    const items = {};
    
    // Собираем все предметы указанного типа
    playersData.forEach(playerData => {
        playerData.cards.forEach(card => {
            const value = card[itemType];
            if (value && value.trim() !== '') {
                if (!items[value]) {
                    items[value] = {
                        value: value,
                        count: 0,
                        players: {},
                        cards: []
                    };
                }
                
                items[value].count++;
                
                if (!items[value].players[playerData.id]) {
                    items[value].players[playerData.id] = {
                        playerName: playerData.name,
                        count: 0,
                        cards: []
                    };
                }
                
                items[value].players[playerData.id].count++;
                items[value].players[playerData.id].cards.push({
                    id: card.id,
                    type: card.type,
                    power: card.power
                });
                
                items[value].cards.push({
                    id: card.id,
                    player: playerData.name,
                    type: card.type,
                    power: card.power
                });
            }
        });
    });
    
    // Анализируем потенциал для бонусов
    const itemList = Object.values(items);
    const potentialBonuses = [];
    
    itemList.forEach(item => {
        // Бонусные пороги
        const bonusTable = {
            earrings: {4: 400, 5: 500, 6: 700, 7: 1000},
            logo: {4: 400, 5: 500, 6: 700, 7: 1000}, // Было amulet, стало logo
            bracelet: {4: 400}
        }[itemType];
        
        let potentialBonus = 0;
        let neededForBonus = 0;
        
        if (item.count >= 4) {
            // Уже есть потенциал для бонуса
            for (const [threshold, bonus] of Object.entries(bonusTable)) {
                if (item.count >= parseInt(threshold) && bonus > potentialBonus) {
                    potentialBonus = bonus;
                }
            }
            
            // Сколько нужно для следующего уровня бонуса
            const thresholds = Object.keys(bonusTable).map(Number).sort((a, b) => a - b);
            const currentThreshold = thresholds.findLast(t => item.count >= t) || 0;
            const nextThreshold = thresholds.find(t => item.count < t);
            
            if (nextThreshold) {
                neededForBonus = nextThreshold - item.count;
            }
        } else {
            // Сколько нужно для минимального бонуса
            neededForBonus = 4 - item.count;
        }
        
        potentialBonuses.push({
            value: item.value,
            count: item.count,
            potentialBonus: potentialBonus,
            neededForNextBonus: neededForBonus,
            distribution: item.players
        });
    });
    
    // Сортируем по потенциалу
    potentialBonuses.sort((a, b) => {
        // Сначала по наличию бонуса
        if (a.potentialBonus > 0 && b.potentialBonus === 0) return -1;
        if (a.potentialBonus === 0 && b.potentialBonus > 0) return 1;
        // Затем по количеству
        return b.count - a.count;
    });
    
    return {
        items: itemList,
        potentialBonuses: potentialBonuses,
        summary: {
            totalItems: itemList.reduce((sum, item) => sum + item.count, 0),
            uniqueValues: itemList.length,
            itemsWithBonusPotential: potentialBonuses.filter(b => b.potentialBonus > 0).length
        }
    };
}

module.exports = {
    // Получить реальные данные из NFT файлов с фильтрацией по Skin Tone
    getRealData: async (req, res) => {
        try {
            const skinTone = req.query.skinTone || nftDataService.getDefaultSkinTone();
            
            logger.info(`📥 Загрузка реальных данных из NFT файлов (Skin Tone: ${skinTone})`);
            
            // Загружаем данные через NFT сервис
            const data = await nftDataService.getRealPlayerData(skinTone);
            
            if (!data || !data.players) {
                throw new Error('Не удалось загрузить данные игроков');
            }
            
            const playersData = data.players;
            
            // Преобразуем данные в объекты Player для формирования команд
            const players = playersData.map(playerData => {
                const cards = playerData.cards.map(card => 
                    new utils.Orc(
                        card.id,
                        card.type,
                        card.power,
                        card.earrings,
                        card.logos, // ПРЯМОЕ ЗНАЧЕНИЕ
                        card.bracelet || ''
                    )
                );
                return new service.Player(playerData.id, playerData.name, cards);
            });
            
            // Формируем результат для отправки
            const result = players.map(player => {
                const team = player.team;
                let teamStats = null;
                let bonusDetails = null;
                let bonusText = null;
                
                if (team) {
                    teamStats = team.getStats ? team.getStats() : null;
                    // Получаем детали бонусов из команды
                    bonusDetails = team.getBonusDetails ? team.getBonusDetails() : null;
                    // Получаем текст бонусов для отображения
                    bonusText = team.getBonusText ? team.getBonusText() : null;
                }
                
                return {
                    id: player.id,
                    name: player.name,
                    wallet: playersData.find(p => p.id === player.id)?.wallet || '',
                    balance: playersData.find(p => p.id === player.id)?.balance || '0',
                    cards: player.cards.map(card => {
                        // Находим исходные данные NFT для этого орка
                        const playerCards = playersData.find(p => p.id === player.id)?.cards || [];
                        const nftData = playerCards.find(c => c.id === card.id)?.nftData;
                        
                        return {
                            id: card.id,
                            type: card.type,
                            typeName: card.typeName,
                            power: card.power,
                            earrings: card.earrings,
                            logo: card.logos, // Было amulet, стало logo
                            bracelet: card.bracelet,
                            nftData: nftData || null
                        };
                    }),
                    team: team ? {
                        orcs: team.orcs.map(orc => ({
                            id: orc.id,
                            type: orc.type,
                            typeName: orc.typeName,
                            power: orc.power,
                            earrings: orc.earrings,
                            logo: orc.logo, // Было amulet, стало logo
                            bracelet: orc.bracelet
                        })),
                        totalPower: team.totalPower,
                        stats: teamStats || { basePower: 0, bonuses: {} },
                        bonusDetails: bonusDetails,
                        bonusText: bonusText
                    } : null,
                    teamPower: player.teamPower,
                    canFormTeam: player.canFormTeam ? player.canFormTeam() : false
                };
            });

            // Рассчитываем общую мощность на основе всех карточек
            const totalPower = result.reduce((sum, player) => 
                sum + (player.teamPower || 0), 0);
            
            const totalCards = result.reduce((sum, p) => sum + (p.cards?.length || 0), 0);
            
            res.json({
                success: true,
                data: result,
                totalPower: totalPower,
                playerCount: result.length,
                totalCards: totalCards,
                selectedSkinTone: data.selectedSkinTone || skinTone,
                availableSkinTones: data.availableSkinTones || [],
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Ошибка загрузки реальных данных:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Получить доступные Skin Tone
    getAvailableSkinTones: async (req, res) => {
        try {
            logger.info('🎨 Получение доступных Skin Tone');
            
            const skinTones = nftDataService.getAvailableSkinTones();
            const defaultSkinTone = nftDataService.getDefaultSkinTone();
            
            res.json({
                success: true,
                data: {
                    availableSkinTones: skinTones,
                    defaultSkinTone: defaultSkinTone,
                    count: skinTones.length
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Ошибка получения доступных Skin Tone:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Оптимизировать обмены с выбором алгоритма
    optimizeExchanges: (req, res) => {
        try {
            const { 
                players: playersData, 
                maxIterations = 50, 
                algorithm = 'fast'
            } = req.body;
            
            if (!playersData || !Array.isArray(playersData)) {
                throw new Error('Неверные данные игроков');
            }

            logger.info(`🚀 Оптимизация обменов (${algorithm}) для ${playersData.length} игроков`);

            // Сохраняем исходные данные (глубокая копия)
            const originalPlayersData = JSON.parse(JSON.stringify(playersData));
            
            // Создаем игроков
            const players = playersData.map(playerData => {
                const cards = playerData.cards.map(card => 
                    new utils.Orc(
                        card.id,
                        card.type,
                        card.power,
                        card.earrings,
                        card.logos, // ПРЯМОЕ ЗНАЧЕНИЕ
                        card.bracelet || ''
                    )
                );
                return new service.Player(playerData.id, playerData.name, cards);
            });

            // Начальная статистика
            const initialStats = {
                totalPower: players.reduce((sum, p) => sum + (p.teamPower || 0), 0),
                totalCards: players.reduce((sum, p) => sum + (p.cards?.length || 0), 0),
                playersWithTeam: players.filter(p => p.team).length
            };
            
            logger.info(`Начальная мощность: ${initialStats.totalPower}, Игроков с командой: ${initialStats.playersWithTeam}/${players.length}`);

            // Сохраняем исходные команды (до оптимизации)
            const originalTeamsState = players.map(player => {
                const teamCards = player.team ? player.team.orcs.map(orc => ({
                    id: orc.id,
                    type: orc.type,
                    typeName: orc.typeName,
                    power: orc.power
                })) : [];
                
                return {
                    playerId: player.id,
                    playerName: player.name,
                    teamPower: player.teamPower || 0,
                    teamCards: teamCards,
                    teamCardIds: teamCards.map(c => c.id)
                };
            });

            // Создаем оптимизатор и выбираем алгоритм
            const optimizer = new service.GlobalOptimizer(players);
            let result;
            
            switch(algorithm) {
                case 'genetic':
                    result = optimizer.optimizeWithGeneticAlgorithm(Math.min(maxIterations, 30), 20);
                    break;
                case 'synergy':
                    result = optimizer.optimizeForSynergy(maxIterations);
                    break;
                case 'step':
                    result = optimizer.optimizeExchanges(maxIterations);
                    break;
                case 'fast':
                default:
                    result = optimizer.optimizeExchanges(Math.min(30, maxIterations));
                    break;
            }

            logger.info(`✅ ${algorithm.toUpperCase()} оптимизация завершена: ${result.exchanges ? result.exchanges.length : 0} обменов, улучшение: +${result.improvement}`);

            // Формируем результат
            const optimizedPlayers = players.map(player => {
                const team = player.team;
                let teamStats = null;
                let bonusDetails = null;
                let bonusText = null;
                
                if (team) {
                    teamStats = team.getStats();
                    bonusDetails = team.getBonusDetails();
                    bonusText = team.getBonusText();
                }
                
                const originalPlayer = originalPlayersData.find(p => p.id === player.id);
                
                return {
                    id: player.id,
                    name: player.name,
                    wallet: originalPlayer?.wallet || '',
                    balance: originalPlayer?.balance || '0',
                    cards: player.cards.map(card => {
                        const originalCards = originalPlayer?.cards || [];
                        const originalCard = originalCards.find(c => c.id === card.id);
                        
                        return {
                            id: card.id,
                            type: card.type,
                            typeName: card.typeName,
                            power: card.power,
                            earrings: card.earrings,
                            logo: card.logos, // Было amulet, стало logo
                            bracelet: card.bracelet,
                            nftData: originalCard?.nftData || null
                        };
                    }),
                    team: team ? {
                        orcs: team.orcs.map(orc => ({
                            id: orc.id,
                            type: orc.type,
                            typeName: orc.typeName,
                            power: orc.power,
                            earrings: orc.earrings,
                            logo: orc.logo, // Было amulet, стало logo
                            bracelet: orc.bracelet
                        })),
                        totalPower: team.totalPower,
                        stats: teamStats || { basePower: 0, bonuses: {} },
                        bonusDetails: bonusDetails,
                        bonusText: bonusText
                    } : null,
                    teamPower: player.teamPower || 0,
                    canFormTeam: player.canFormTeam()
                };
            });

            const finalStats = {
                totalPower: result.optimizedPower || result.improvement + initialStats.totalPower,
                totalCards: optimizedPlayers.reduce((sum, p) => sum + (p.cards?.length || 0), 0),
                playersWithTeam: optimizedPlayers.filter(p => p.team).length
            };

            // Сохраняем финальные команды (после оптимизации)
            const optimizedTeamsState = optimizedPlayers.map(player => {
                const teamCards = player.team ? player.team.orcs.map(orc => ({
                    id: orc.id,
                    type: orc.type,
                    typeName: orc.typeName,
                    power: orc.power
                })) : [];
                
                return {
                    playerId: player.id,
                    playerName: player.name,
                    teamPower: player.teamPower || 0,
                    teamCards: teamCards,
                    teamCardIds: teamCards.map(c => c.id)
                };
            });

            // Генерируем рекомендации на основе сравнения
            const recommendations = generateExchangeRecommendationsFromComparison(
                originalPlayersData,
                optimizedPlayers
            );

            // Форматируем обмены в табличный вид
            const exchangeTable = result.exchanges ? result.exchanges.map((exchange, index) => ({
                номер: index + 1,
                игрок_от: exchange.player1Name,
                игрок_кому: exchange.player2Name,
                передает_орка: `#${exchange.orc1Id} (${exchange.orc1TypeName})`,
                получает_орка: `#${exchange.orc2Id} (${exchange.orc2TypeName})`,
                улучшение: `+${exchange.improvement}`,
                мощность_до: `${exchange.oldPlayer1Power + exchange.oldPlayer2Power}`,
                мощность_после: `${exchange.newPlayer1Power + exchange.newPlayer2Power}`
            })) : [];

            // Форматируем рекомендации в табличный вид
            const recommendationsTable = [];
            recommendations.forEach((rec, recIndex) => {
                rec.changes.forEach((change, changeIndex) => {
                    recommendationsTable.push({
                        номер: recommendationsTable.length + 1,
                        тип: change.type === 'give' ? 'Передача' : 'Получение',
                        игрок: rec.playerName,
                        действие: change.action,
                        изменение_мощности: rec.powerChange > 0 ? `+${rec.powerChange}` : rec.powerChange.toString()
                    });
                });
            });

            res.json({
                success: true,
                data: {
                    // Основная статистика
                    stats: {
                        before: {
                            totalPower: initialStats.totalPower,
                            totalCards: initialStats.totalCards,
                            playersWithTeam: initialStats.playersWithTeam,
                            playersCount: players.length
                        },
                        after: {
                            totalPower: finalStats.totalPower,
                            totalCards: finalStats.totalCards,
                            playersWithTeam: finalStats.playersWithTeam,
                            playersCount: players.length
                        },
                        improvement: {
                            power: finalStats.totalPower - initialStats.totalPower,
                            powerPercentage: (((finalStats.totalPower - initialStats.totalPower) / initialStats.totalPower) * 100).toFixed(2) + '%',
                            newTeams: finalStats.playersWithTeam - initialStats.playersWithTeam
                        }
                    },
                    
                    // Обмены в табличном формате
                    exchanges: result.exchanges || [],
                    exchangeTable: exchangeTable,
                    
                    // Рекомендации на основе сравнения
                    recommendations: recommendations,
                    recommendationsTable: recommendationsTable,
                    
                    // Игроки
                    players: optimizedPlayers,
                    
                    // Состояние до и после
                    comparison: {
                        originalTeams: originalTeamsState,
                        optimizedTeams: optimizedTeamsState,
                        teamChanges: originalTeamsState.map(origTeam => {
                            const optTeam = optimizedTeamsState.find(t => t.playerId === origTeam.playerId);
                            const addedCards = optTeam ? optTeam.teamCards.filter(optCard => 
                                !origTeam.teamCardIds.includes(optCard.id)
                            ) : [];
                            const removedCards = origTeam.teamCards.filter(origCard => 
                                !optTeam.teamCardIds.includes(origCard.id)
                            );
                            
                            return {
                                playerId: origTeam.playerId,
                                playerName: origTeam.playerName,
                                powerChange: (optTeam?.teamPower || 0) - origTeam.teamPower,
                                addedCards: addedCards,
                                removedCards: removedCards
                            };
                        })
                    },
                    
                    // Информация об алгоритме
                    algorithm: {
                        name: algorithm,
                        iterations: result.iterations || 0
                    },
                    
                    // Сводка для отображения
                    summary: `Оптимизация ${algorithm.toUpperCase()}: ${result.exchanges ? result.exchanges.length : recommendations.length} рекомендаций, улучшение +${finalStats.totalPower - initialStats.totalPower} (+${(((finalStats.totalPower - initialStats.totalPower) / initialStats.totalPower) * 100).toFixed(2)}%)`
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Ошибка оптимизации обменов:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Рассчитать мощность команды
    calculateTeamPower: (req, res) => {
        try {
            const { orcs } = req.body;
            
            if (!orcs || !Array.isArray(orcs) || orcs.length !== 7) {
                throw new Error('Команда должна состоять из 7 орков');
            }

            logger.info('Расчет мощности команда');

            const teamOrcs = orcs.map(orc => 
                new utils.Orc(
                    orc.id,
                    orc.type,
                    orc.power,
                    orc.earrings,
                    orc.logo, // Было amulet, стало logo
                    orc.bracelet || ''
                )
            );

            const team = new utils.Team(teamOrcs);
            const stats = team.getStats();
            const bonusText = team.getBonusText();

            res.json({
                success: true,
                data: {
                    totalPower: team.totalPower,
                    stats: {
                        basePower: stats.basePower,
                        bonuses: stats.bonuses
                    },
                    bonusText: bonusText,
                    groups: stats.groups,
                    bonusDetails: stats.bonusDetails,
                    orcs: teamOrcs.map(orc => ({
                        id: orc.id,
                        type: orc.type,
                        typeName: orc.typeName,
                        power: orc.power,
                        earrings: orc.earrings,
                        logo: orc.logo, // Было amulet, стало logo
                        bracelet: orc.bracelet
                    }))
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Ошибка расчета мощности команды:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Получить информацию о модуле
    getModuleInfo: (req, res) => {
        try {
            const config = require('./orc-exchange.config');
            const constants = require('./power.constants');
            
            res.json({
                success: true,
                data: {
                    module: config,
                    constants: {
                        ORC_TYPES: constants.ORC_TYPES,
                        ORC_TYPE_NAMES: constants.ORC_TYPE_NAMES,
                        BONUS_VALUES: constants.BONUS_VALUES,
                        LOGO_TRAIT_TYPES: constants.LOGO_TRAIT_TYPES,
                        LOGO_VALUES: constants.LOGO_VALUES,
                        LOGO_EQUIVALENTS: constants.LOGO_EQUIVALENTS_FOR_DISPLAY // Обновлено
                    }
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Ошибка получения информации о модуле:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Получить информацию о конкретном NFT
    getNFTDetails: async (req, res) => {
        try {
            const { index } = req.params;
            
            if (!index) {
                throw new Error('Не указан индекс NFT');
            }

            const nftIndex = parseInt(index);
            const details = nftDataService.getNFTDetails(nftIndex);
            
            if (details) {
                res.json({
                    success: true,
                    data: details,
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: 'NFT не найден',
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            logger.error('Ошибка получения деталей NFT:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Проанализировать распределение типов
    analyzeDistribution: (req, res) => {
        try {
            const { players: playersData } = req.body;
            
            if (!playersData || !Array.isArray(playersData)) {
                throw new Error('Неверные данные игроков');
            }

            logger.info('Анализ распределения типов орков');

            // Анализ распределения типов
            const typeDistribution = {};
            const totalByType = {};
            
            // Инициализируем структуры
            for (let i = 1; i <= 7; i++) {
                typeDistribution[i] = {
                    type: i,
                    typeName: this.getOrcTypeName(i),
                    players: {},
                    total: 0
                };
                totalByType[i] = 0;
            }
            
            // Собираем статистику
            playersData.forEach(playerData => {
                playerData.cards.forEach(card => {
                    const type = card.type;
                    if (type >= 1 && type <= 7) {
                        if (!typeDistribution[type].players[playerData.id]) {
                            typeDistribution[type].players[playerData.id] = {
                                playerName: playerData.name,
                                count: 0,
                                cards: []
                            };
                        }
                        
                        typeDistribution[type].players[playerData.id].count++;
                        typeDistribution[type].players[playerData.id].cards.push({
                            id: card.id,
                            power: card.power
                        });
                        typeDistribution[type].total++;
                        totalByType[type]++;
                    }
                });
            });
            
            // Определяем дефицитные типы
            const playerCount = playersData.length;
            const deficitTypes = [];
            const surplusTypes = [];
            
            for (let i = 1; i <= 7; i++) {
                const available = totalByType[i];
                const needed = playerCount;
                
                if (available < needed) {
                    deficitTypes.push({
                        type: i,
                        typeName: this.getOrcTypeName(i),
                        available: available,
                        needed: needed,
                        deficit: needed - available
                    });
                } else if (available > needed) {
                    surplusTypes.push({
                        type: i,
                        typeName: this.getOrcTypeName(i),
                        available: available,
                        needed: needed,
                        surplus: available - needed
                    });
                }
            }
            
            // Анализ предметов для бонусов
            const itemAnalysis = {
                earrings: analyzeItems(playersData, 'earrings'),
                logo: analyzeItems(playersData, 'logo'), // Было amulet, стало logo
                bracelet: analyzeItems(playersData, 'bracelet')
            };
            
            // Рекомендации по распределению
            const recommendations = [];
            
            // Рекомендации по дефицитным типам
            deficitTypes.forEach(deficit => {
                recommendations.push({
                    priority: 'high',
                    type: 'deficit',
                    message: `Дефицит типа ${deficit.typeName}: есть ${deficit.available}, нужно ${deficit.needed}. Не хватает ${deficit.deficit} орков.`
                });
            });
            
            // Рекомендации по избыточным типам
            surplusTypes.forEach(surplus => {
                recommendations.push({
                    priority: 'medium',
                    type: 'surplus',
                    message: `Избыток типа ${surplus.typeName}: есть ${surplus.available}, нужно ${surplus.needed}. Можно передать ${surplus.surplus} орков другим игрокам.`
                });
            });
            
            // Рекомендации по бонусам
            Object.entries(itemAnalysis).forEach(([itemType, analysis]) => {
                analysis.potentialBonuses.forEach(bonus => {
                    recommendations.push({
                        priority: bonus.count >= 4 ? 'high' : 'low',
                        type: 'bonus',
                        message: `Потенциал бонуса за ${itemType === 'logo' ? 'логотипы' : itemType}: ${bonus.value} (${bonus.count} шт.) → возможный бонус: ${bonus.potentialBonus}`
                    });
                });
            });
            
            res.json({
                success: true,
                data: {
                    typeDistribution: Object.values(typeDistribution),
                    deficitTypes,
                    surplusTypes,
                    itemAnalysis,
                    recommendations,
                    summary: {
                        totalPlayers: playerCount,
                        totalCards: playersData.reduce((sum, p) => sum + p.cards.length, 0),
                        cardsPerPlayer: (playersData.reduce((sum, p) => sum + p.cards.length, 0) / playerCount).toFixed(1),
                        canFormFullTeams: deficitTypes.length === 0
                    }
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Ошибка анализа распределения:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Вспомогательный метод для получения названия типа орка
    getOrcTypeName: (typeId) => {
        const typeNames = {
            1: 'Wen TGE',
            2: 'Greeting',
            3: 'Shoked',
            4: 'In Love',
            5: 'Capped',
            6: 'To The Moon',
            7: 'Do Something'
        };
        return typeNames[typeId] || `Тип ${typeId}`;
    }
};