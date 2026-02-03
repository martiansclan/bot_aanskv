// Используем ваш логгер
const logger = require('../../core/utils/logger');
const service = require('./orc-exchange.service');
const utils = require('./orc-exchange.utils');

module.exports = {
    // Получить тестовые данные
    getTestData: (req, res) => {
        try {
            const playerCount = parseInt(req.query.players) || 4;
            const cardsPerPlayer = parseInt(req.query.cards) || 10;
            
            logger.info(`Генерация тестовых данных: ${playerCount} игроков, ${cardsPerPlayer} карточек`);
            
            const players = service.generateTestData(playerCount, cardsPerPlayer);
            
            const result = players.map(player => ({
                id: player.id,
                name: player.name,
                cards: player.cards.map(card => ({
                    id: card.id,
                    type: card.type,
                    typeName: card.typeName,
                    power: card.power,
                    earrings: card.earrings,
                    amulet: card.amulet,
                    bracelet: card.bracelet
                })),
                team: player.team ? {
                    orcs: player.team.orcs.map(orc => ({
                        id: orc.id,
                        type: orc.type,
                        typeName: orc.typeName,
                        power: orc.power,
                        earrings: orc.earrings,
                        amulet: orc.amulet,
                        bracelet: orc.bracelet
                    })),
                    totalPower: player.team.totalPower,
                    stats: player.getTeamStats()
                } : null,
                teamPower: player.teamPower,
                canFormTeam: player.canFormTeam()
            }));

            res.json({
                success: true,
                data: result,
                totalPower: players.reduce((sum, p) => sum + p.teamPower, 0),
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Ошибка генерации тестовых данных:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    },

    // Оптимизировать обмены
    optimizeExchanges: (req, res) => {
        try {
            const { players: playersData, maxIterations = 100 } = req.body;
            
            if (!playersData || !Array.isArray(playersData)) {
                throw new Error('Неверные данные игроков');
            }

            logger.info(`Оптимизация обменов для ${playersData.length} игроков`);

            // Создаем игроков из полученных данных
            const players = playersData.map(playerData => {
                const cards = playerData.cards.map(card => 
                    new utils.Orc(
                        card.id,
                        card.type,
                        card.power,
                        card.earrings,
                        card.amulet,
                        card.bracelet || ''
                    )
                );
                return new service.Player(playerData.id, playerData.name, cards);
            });

            // Убираем строгую проверку - разрешаем оптимизацию даже если не все игроки могут собрать команду
            // Вместо этого просто логируем предупреждение
            players.forEach(player => {
                if (!player.canFormTeam()) {
                    logger.warning(`Игрок ${player.name} не может собрать полную команду. Доступно типов: ${new Set(player.cards.map(c => c.type)).size}/7`);
                }
        });

        // Создаем оптимизатор и запускаем оптимизацию
        const optimizer = new service.ExchangeOptimizer(players);
        const initialPower = optimizer.calculateTotalPower();
        const result = optimizer.optimize(maxIterations);

        logger.info(`Оптимизация завершена: ${result.improvements} улучшений, общее улучшение: ${result.totalPower - initialPower}`);

        // Формируем ответ
        const optimizedPlayers = players.map(player => ({
            id: player.id,
            name: player.name,
            team: player.team ? {
                orcs: player.team.orcs.map(orc => ({
                    id: orc.id,
                    type: orc.type,
                    typeName: orc.typeName,
                    power: orc.power,
                    earrings: orc.earrings,
                    amulet: orc.amulet,
                    bracelet: orc.bracelet
                })),
                totalPower: player.team.totalPower,
                stats: player.getTeamStats()
            } : null,
            teamPower: player.teamPower,
            canFormTeam: player.canFormTeam(),
            cards: player.cards.map(card => ({
                id: card.id,
                type: card.type,
                typeName: card.typeName,
                power: card.power,
                earrings: card.earrings,
                amulet: card.amulet,
                bracelet: card.bracelet
            }))
        }));

        res.json({
            success: true,
            data: {
                initialPower,
                optimizedPower: result.totalPower,
                improvement: result.totalPower - initialPower,
                exchanges: result.exchanges,
                iterations: result.iterations,
                improvements: result.improvements,
                players: optimizedPlayers,
                recommendations: optimizer.generateRecommendations(),
                warnings: players.filter(p => !p.canFormTeam()).map(p => 
                    `Игрок ${p.name} не может собрать полную команду (не хватает типов)`
                )
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

            logger.info('Расчет мощности команды');

            const teamOrcs = orcs.map(orc => 
                new utils.Orc(
                    orc.id,
                    orc.type,
                    orc.power,
                    orc.earrings,
                    orc.amulet,
                    orc.bracelet || ''
                )
            );

            const team = new utils.Team(teamOrcs);
            const stats = team.getStats();

            res.json({
                success: true,
                data: {
                    totalPower: team.totalPower,
                    stats,
                    orcs: teamOrcs.map(orc => ({
                        id: orc.id,
                        type: orc.type,
                        typeName: orc.typeName,
                        power: orc.power,
                        earrings: orc.earrings,
                        amulet: orc.amulet,
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
                        BONUS_VALUES: constants.BONUS_VALUES
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
    }
};