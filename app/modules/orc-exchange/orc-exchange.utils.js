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
    }
}

class Team {
    constructor(orcs) {
        this.orcs = orcs;
        this.totalPower = this.calculatePower();
    }

    calculatePower() {
        let power = this.orcs.reduce((sum, orc) => sum + orc.power, 0);
        
        // Бонусы за серьги
        const earringCounts = this.countItems('earrings');
        power += this.calculateBonus(earringCounts, constants.BONUS_VALUES.EAR_RINGS);
        
        // Бонусы за амулеты
        const amuletCounts = this.countItems('amulet');
        power += this.calculateBonus(amuletCounts, constants.BONUS_VALUES.AMULET);
        
        // Бонусы за браслеты (только если есть)
        const braceletCounts = this.countItems('bracelet', true);
        if (Object.keys(braceletCounts).length > 0) {
            power += this.calculateBonus(braceletCounts, constants.BONUS_VALUES.BRACELET);
        }
        
        return power;
    }

    countItems(itemType, filterEmpty = false) {
        const counts = {};
        this.orcs.forEach(orc => {
            const value = orc[itemType];
            if (!filterEmpty || value) {
                counts[value] = (counts[value] || 0) + 1;
            }
        });
        return counts;
    }

    calculateBonus(counts, bonusTable) {
        let totalBonus = 0;
        Object.values(counts).forEach(count => {
            if (count >= constants.BONUS_THRESHOLD) {
                // Находим максимальный доступный бонус для данного количества
                let bestBonus = 0;
                for (const [threshold, bonus] of Object.entries(bonusTable)) {
                    if (count >= parseInt(threshold) && bonus > bestBonus) {
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
            itemCounts: {
                earrings: this.countItems('earrings'),
                amulet: this.countItems('amulet'),
                bracelet: this.countItems('bracelet', true)
            }
        };

        stats.bonuses.earrings = this.calculateBonus(stats.itemCounts.earrings, constants.BONUS_VALUES.EAR_RINGS);
        stats.bonuses.amulet = this.calculateBonus(stats.itemCounts.amulet, constants.BONUS_VALUES.AMULET);
        stats.bonuses.bracelet = this.calculateBonus(stats.itemCounts.bracelet, constants.BONUS_VALUES.BRACELET);

        return stats;
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

module.exports = {
    Orc,
    Team,
    findBestTeam
};