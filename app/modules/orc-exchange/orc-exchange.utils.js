const constants = require('./power.constants');

class Orc {
    constructor(id, type, power, earrings, amulet, bracelet = '') {
        this.id = id;
        this.type = type;
        this.power = power;
        this.earrings = earrings;
        this.amulet = amulet;
        this.bracelet = bracelet;
        this.typeName = constants.ORC_TYPE_NAMES[type] || `Тип ${type}`;
        this.ownerId = null; // Добавляем для отслеживания владельца
    }
}

class Team {
    constructor(orcs) {
        this.orcs = orcs;
        this.totalPower = this.calculatePower();
    }

    calculatePower() {
        let power = this.orcs.reduce((sum, orc) => sum + orc.power, 0);
        
        // Бонусы за серьги (группируем по одинаковым значениям)
        const earringGroups = this.groupItems('earrings');
        power += this.calculateBonusForGroups(earringGroups, constants.BONUS_VALUES.EAR_RINGS);
        
        // Бонусы за амулеты (логотипы) (группируем по одинаковым значениям)
        const amuletGroups = this.groupItems('amulet');
        power += this.calculateBonusForGroups(amuletGroups, constants.BONUS_VALUES.AMULET);
        
        // Бонусы за браслеты (группируем по одинаковым значениям)
        const braceletGroups = this.groupItems('bracelet');
        power += this.calculateBonusForGroups(braceletGroups, constants.BONUS_VALUES.BRACELET);
        
        return power;
    }

    // Группировка предметов по значению
    groupItems(itemType) {
        const groups = {};
        this.orcs.forEach(orc => {
            const value = orc[itemType];
            if (value && value.trim() !== '') {
                if (!groups[value]) {
                    groups[value] = {
                        value: value,
                        count: 0,
                        orcs: []
                    };
                }
                groups[value].count++;
                groups[value].orcs.push(orc);
            }
        });
        return groups;
    }

    // Расчет бонуса для групп предметов
    calculateBonusForGroups(groups, bonusTable) {
        let totalBonus = 0;
        
        Object.values(groups).forEach(group => {
            if (group.count >= constants.BONUS_THRESHOLD) {
                // Находим максимальный доступный бонус для данного количества
                let bestBonus = 0;
                for (const [threshold, bonus] of Object.entries(bonusTable)) {
                    if (group.count >= parseInt(threshold) && bonus > bestBonus) {
                        bestBonus = bonus;
                    }
                }
                totalBonus += bestBonus;
            }
        });
        
        return totalBonus;
    }

    getStats() {
        const stats = {
            basePower: this.orcs.reduce((sum, orc) => sum + orc.power, 0),
            bonuses: {
                earrings: 0,
                amulet: 0,
                bracelet: 0
            },
            groups: {
                earrings: this.groupItems('earrings'),
                amulet: this.groupItems('amulet'),
                bracelet: this.groupItems('bracelet')
            },
            bonusDetails: {
                earrings: [],
                amulet: [],
                bracelet: []
            }
        };

        // Рассчитываем бонусы для каждой категории
        stats.bonuses.earrings = this.calculateBonusForGroupsWithDetails(
            stats.groups.earrings, 
            constants.BONUS_VALUES.EAR_RINGS,
            stats.bonusDetails.earrings
        );
        
        stats.bonuses.amulet = this.calculateBonusForGroupsWithDetails(
            stats.groups.amulet, 
            constants.BONUS_VALUES.AMULET,
            stats.bonusDetails.amulet
        );
        
        stats.bonuses.bracelet = this.calculateBonusForGroupsWithDetails(
            stats.groups.bracelet, 
            constants.BONUS_VALUES.BRACELET,
            stats.bonusDetails.bracelet
        );

        return stats;
    }

    // Расчет бонусов с деталями
    calculateBonusForGroupsWithDetails(groups, bonusTable, detailsArray) {
        let totalBonus = 0;
        
        Object.values(groups).forEach(group => {
            if (group.count >= constants.BONUS_THRESHOLD) {
                let bestBonus = 0;
                let threshold = 0;
                
                for (const [th, bonus] of Object.entries(bonusTable)) {
                    if (group.count >= parseInt(th) && bonus > bestBonus) {
                        bestBonus = bonus;
                        threshold = parseInt(th);
                    }
                }
                
                if (bestBonus > 0) {
                    totalBonus += bestBonus;
                    detailsArray.push({
                        value: group.value,
                        count: group.count,
                        bonus: bestBonus,
                        threshold: threshold,
                        orcs: group.orcs.map(orc => ({
                            id: orc.id,
                            type: orc.type,
                            typeName: orc.typeName
                        }))
                    });
                }
            }
        });
        
        return totalBonus;
    }

    // Метод для получения текста бонусов для отображения
    getBonusText() {
        const stats = this.getStats();
        const text = {
            earrings: '0',
            amulet: '0', 
            bracelet: '0'
        };
        
        // Формируем текст для серёг
        if (stats.bonusDetails.earrings.length > 0) {
            const parts = stats.bonusDetails.earrings.map(detail => 
                `${detail.value} (${detail.count} шт.)`
            );
            text.earrings = `${stats.bonuses.earrings} (${parts.join(', ')})`;
        } else if (stats.bonuses.earrings > 0) {
            text.earrings = `${stats.bonuses.earrings}`;
        }
        
        // Формируем текст для амулеты
        if (stats.bonusDetails.amulet.length > 0) {
            const parts = stats.bonusDetails.amulet.map(detail => 
                `${detail.value} (${detail.count} шт.)`
            );
            text.amulet = `${stats.bonuses.amulet} (${parts.join(', ')})`;
        } else if (stats.bonuses.amulet > 0) {
            text.amulet = `${stats.bonuses.amulet}`;
        }
        
        // Формируем текст для браслетов
        if (stats.bonusDetails.bracelet.length > 0) {
            const parts = stats.bonusDetails.bracelet.map(detail => 
                `${detail.value} (${detail.count} шт.)`
            );
            text.bracelet = `${stats.bonuses.bracelet} (${parts.join(', ')})`;
        } else if (stats.bonuses.bracelet > 0) {
            text.bracelet = `${stats.bonuses.bracelet}`;
        }
        
        return text;
    }

    // Метод для получения деталей бонусов
    getBonusDetails() {
        const stats = this.getStats();
        return stats.bonusDetails;
    }

    // Новый метод: сравнение с другой командой
    compareWith(otherTeam) {
        const thisOrcIds = new Set(this.orcs.map(o => o.id));
        const otherOrcIds = new Set(otherTeam.orcs.map(o => o.id));
        
        return {
            addedOrcs: this.orcs.filter(o => !otherOrcIds.has(o.id)),
            removedOrcs: otherTeam.orcs.filter(o => !thisOrcIds.has(o.id)),
            commonOrcs: this.orcs.filter(o => otherOrcIds.has(o.id)),
            powerDifference: this.totalPower - otherTeam.totalPower
        };
    }
}

// ИСПРАВЛЕННЫЙ КЛАСС TeamOptimizer
class TeamOptimizer {
    constructor(allOrcs, playerCount, playerIds = []) {
        this.allOrcs = allOrcs; // Все доступные орки
        this.playerCount = playerCount; // Количество игроков
        this.playerIds = playerIds; // ID игроков
        this.orcTypes = [1, 2, 3, 4, 5, 6, 7];
    }

    // ИСПРАВЛЕННЫЙ ГЕНЕТИЧЕСКИЙ АЛГОРИТМ
    optimizeWithGeneticAlgorithm(generations = 100, populationSize = 50) {
        console.log(`🧬 Оптимизация для ${this.playerCount} игроков с ${this.allOrcs.length} орками`);
        
        // Создаем начальную популяцию (случайное распределение)
        let population = this.createInitialPopulation(populationSize);
        let bestFitness = -Infinity;
        let bestIndividual = null;
        
        for (let gen = 0; gen < generations; gen++) {
            // Оцениваем популяцию и находим лучшую особь
            const evaluated = population.map(individual => {
                const fitness = this.evaluateIndividual(individual);
                return { individual, fitness };
            });
            
            // Находим лучшую особь в этом поколении
            evaluated.forEach(({ individual, fitness }) => {
                if (fitness > bestFitness) {
                    bestFitness = fitness;
                    bestIndividual = this.cloneIndividual(individual);
                }
            });
            
            // Сортируем по fitness
            evaluated.sort((a, b) => b.fitness - a.fitness);
            
            // Создаем новое поколение
            const newPopulation = [];
            
            // Элитные особи (20% лучших) переходят в следующее поколение
            const eliteCount = Math.max(2, Math.floor(populationSize * 0.2));
            for (let i = 0; i < eliteCount; i++) {
                newPopulation.push(this.cloneIndividual(evaluated[i].individual));
            }
            
            // Заполняем остальное население через скрещивание и мутацию
            while (newPopulation.length < populationSize) {
                // Выбираем родителей с турнирной селекцией
                const parent1 = this.tournamentSelection(evaluated);
                const parent2 = this.tournamentSelection(evaluated);
                
                // Скрещиваем
                const child = this.crossover(parent1, parent2);
                
                // Мутируем
                const mutatedChild = this.mutate(child);
                
                newPopulation.push(mutatedChild);
            }
            
            population = newPopulation;
            
            // Логирование прогресса
            if (gen % 10 === 0 || gen === generations - 1) {
                console.log(`Поколение ${gen + 1}/${generations}: лучшая мощность = ${bestFitness}`);
            }
        }
        
        console.log(`✅ Оптимизация завершена. Лучшая мощность: ${bestFitness}`);
        
        return {
            teams: bestIndividual,
            totalPower: bestFitness
        };
    }

    // Создание начальной популяции
    createInitialPopulation(populationSize) {
        const population = [];
        
        for (let i = 0; i < populationSize; i++) {
            // Создаем случайное распределение орков по игрокам
            const teams = Array(this.playerCount).fill().map(() => new Team([]));
            
            // Копируем всех орков
            const availableOrcs = [...this.allOrcs];
            
            // Перемешиваем
            this.shuffleArray(availableOrcs);
            
            // Распределяем по игрокам циклически
            availableOrcs.forEach((orc, index) => {
                const playerIndex = index % this.playerCount;
                teams[playerIndex].orcs.push(orc);
            });
            
            // Пересчитываем мощность для каждой команды
            teams.forEach(team => {
                team.totalPower = team.calculatePower();
            });
            
            population.push(teams);
        }
        
        return population;
    }

    // Оценка индивида (общая мощность всех команд)
    evaluateIndividual(teams) {
        return teams.reduce((sum, team) => sum + (team.totalPower || team.calculatePower()), 0);
    }

    // Турнирная селекция
    tournamentSelection(evaluatedPopulation, tournamentSize = 3) {
        const tournament = [];
        
        for (let i = 0; i < tournamentSize; i++) {
            const randomIndex = Math.floor(Math.random() * evaluatedPopulation.length);
            tournament.push(evaluatedPopulation[randomIndex]);
        }
        
        tournament.sort((a, b) => b.fitness - a.fitness);
        return tournament[0].individual;
    }

    // Скрещивание (одноточечное)
    crossover(parent1, parent2) {
        const childTeams = Array(this.playerCount).fill().map(() => new Team([]));
        
        // Для каждого типа орков решаем, от какого родителя взять распределение
        this.allOrcs.forEach(orc => {
            // Случайно выбираем родителя
            const useParent1 = Math.random() < 0.5;
            const sourceParent = useParent1 ? parent1 : parent2;
            
            // Находим, у какого игрока в родителе находится этот орк
            const playerIndex = this.findOrcOwner(sourceParent, orc.id);
            
            if (playerIndex !== -1) {
                // Добавляем орк ребенку
                childTeams[playerIndex].orcs.push(orc);
            }
        });
        
        // Проверяем, что все орки распределены (исправляем если нет)
        this.fixOrcDistribution(childTeams);
        
        // Пересчитываем мощность
        childTeams.forEach(team => {
            team.totalPower = team.calculatePower();
        });
        
        return childTeams;
    }

    // Мутация
    mutate(individual) {
        const mutated = this.cloneIndividual(individual);
        
        // С вероятностью 30% меняем двух орков между случайными игроками
        if (Math.random() < 0.3) {
            const player1 = Math.floor(Math.random() * this.playerCount);
            let player2;
            do {
                player2 = Math.floor(Math.random() * this.playerCount);
            } while (player2 === player1);
            
            if (mutated[player1].orcs.length > 0 && mutated[player2].orcs.length > 0) {
                const orc1Index = Math.floor(Math.random() * mutated[player1].orcs.length);
                const orc2Index = Math.floor(Math.random() * mutated[player2].orcs.length);
                
                // Меняем орков местами
                [mutated[player1].orcs[orc1Index], mutated[player2].orcs[orc2Index]] = 
                [mutated[player2].orcs[orc2Index], mutated[player1].orcs[orc1Index]];
                
                // Пересчитываем мощность
                mutated[player1].totalPower = mutated[player1].calculatePower();
                mutated[player2].totalPower = mutated[player2].calculatePower();
            }
        }
        
        return mutated;
    }

    // Вспомогательные методы
    findOrcOwner(teams, orcId) {
        for (let i = 0; i < teams.length; i++) {
            if (teams[i].orcs.some(orc => orc.id === orcId)) {
                return i;
            }
        }
        return -1;
    }

    // Исправление распределения орков
    fixOrcDistribution(teams) {
        const allOrcIds = new Set(this.allOrcs.map(orc => orc.id));
        const distributedOrcIds = new Set();
        
        // Собираем все ID распределенных орков
        teams.forEach(team => {
            team.orcs.forEach(orc => {
                distributedOrcIds.add(orc.id);
            });
        });
        
        // Находим орки, которые не распределены
        const missingOrcs = this.allOrcs.filter(orc => !distributedOrcIds.has(orc.id));
        
        // Распределяем недостающие орки случайным игрокам
        missingOrcs.forEach(orc => {
            const randomPlayer = Math.floor(Math.random() * this.playerCount);
            teams[randomPlayer].orcs.push(orc);
        });
        
        // Проверяем, есть ли дубликаты
        const orcCounts = {};
        teams.forEach(team => {
            team.orcs.forEach(orc => {
                orcCounts[orc.id] = (orcCounts[orc.id] || 0) + 1;
            });
        });
        
        // Удаляем дубликаты
        Object.entries(orcCounts).forEach(([orcId, count]) => {
            if (count > 1) {
                // Удаляем лишние копии
                let found = 0;
                teams.forEach(team => {
                    for (let i = team.orcs.length - 1; i >= 0; i--) {
                        if (team.orcs[i].id === parseInt(orcId)) {
                            if (found < count - 1) {
                                team.orcs.splice(i, 1);
                                found++;
                            }
                        }
                    }
                });
            }
        });
    }

    // Клонирование индивида
    cloneIndividual(individual) {
        return individual.map(team => {
            const clonedOrcs = team.orcs.map(orc => {
                const clonedOrc = new Orc(
                    orc.id,
                    orc.type,
                    orc.power,
                    orc.earrings,
                    orc.amulet,
                    orc.bracelet || ''
                );
                clonedOrc.typeName = orc.typeName;
                clonedOrc.ownerId = orc.ownerId;
                return clonedOrc;
            });
            const clonedTeam = new Team(clonedOrcs);
            clonedTeam.totalPower = team.totalPower;
            return clonedTeam;
        });
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}

function findBestTeam(cards) {
    if (!cards || cards.length === 0) return null;
    
    const byType = {};
    for (let i = 1; i <= 7; i++) {
        byType[i] = cards.filter(c => c.type === i);
    }

    // Проверяем, есть ли хотя бы один орк каждого типа
    const hasAllTypes = Object.values(byType).every(typeCards => typeCards.length > 0);
    
    if (!hasAllTypes) {
        // Если нет полного набора, возвращаем null
        return null;
    }

    let bestTeam = null;
    let bestPower = -Infinity;

    function backtrack(current, type) {
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
    }

    backtrack([], 1);
    return bestTeam ? new Team(bestTeam) : null;
}

// Новая функция: сравнение двух состояний игроков
function comparePlayersStates(before, after) {
    const comparison = [];
    
    before.forEach((origPlayer, index) => {
        const optPlayer = after.find(p => p.id === origPlayer.id);
        if (!optPlayer) return;
        
        const origTeam = origPlayer.team ? origPlayer.team.orcs.map(o => o.id) : [];
        const optTeam = optPlayer.team ? optPlayer.team.orcs.map(o => o.id) : [];
        
        comparison.push({
            playerId: origPlayer.id,
            playerName: origPlayer.name,
            beforePower: origPlayer.teamPower || 0,
            afterPower: optPlayer.teamPower || 0,
            powerChange: (optPlayer.teamPower || 0) - (origPlayer.teamPower || 0),
            addedOrcs: optTeam.filter(id => !origTeam.includes(id)),
            removedOrcs: origTeam.filter(id => !optTeam.includes(id)),
            commonOrcs: origTeam.filter(id => optTeam.includes(id))
        });
    });
    
    return comparison;
}

module.exports = {
    Orc,
    Team,
    TeamOptimizer,
    findBestTeam,
    comparePlayersStates
};