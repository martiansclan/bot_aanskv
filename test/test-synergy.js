const fs = require('fs').promises;
const path = require('path');

async function testSynergy() {
    try {
        // Загружаем данные
        const synergyData = JSON.parse(await fs.readFile(
            path.join(__dirname, 'nft_data', 'synergy_state.json'),
            'utf8'
        ));
        
        console.log('📊 Тестовые примеры синергий:');
        console.log('===============================');
        
        // Пример 1: 2 совпадения
        const testNFT1 = {
            attributes: [
                { trait_type: "Ring", value: "Silver" },
                { trait_type: "Cap", value: "MAGA" },
                { trait_type: "Earring", value: "Spiked Silver" },
                { trait_type: "Skin Tone", value: "Cavern" }
            ]
        };
        
        console.log('\n🎴 Пример 1: 2 совпадения (Silver)');
        console.log(JSON.stringify(testNFT1.attributes, null, 2));
        
        // Пример 2: 3 совпадения
        const testNFT2 = {
            attributes: [
                { trait_type: "Pendant Chain", value: "Gold Rope" },
                { trait_type: "Cap", value: "Gold" },
                { trait_type: "Earring", value: "Spiked Gold" },
                { trait_type: "Skin Tone", value: "Cavern" }
            ]
        };
        
        console.log('\n🎴 Пример 2: 3 совпадения (Gold)');
        console.log(JSON.stringify(testNFT2.attributes, null, 2));
        
        // Пример 3: 3+2 совпадения
        const testNFT3 = {
            attributes: [
                { trait_type: "Pendant Chain", value: "Silver" },
                { trait_type: "Bracelet", value: "Spiked Silver" },
                { trait_type: "Earring", value: "Spiked Silver" },
                { trait_type: "Skin Tone", value: "Cavern" }
            ]
        };
        
        console.log('\n🎴 Пример 3: 3+2 совпадения (Silver + Spiked)');
        console.log(JSON.stringify(testNFT3.attributes, null, 2));
        
        // Простая функция расчета синергий для теста
        function testCalculateSynergy(nft, synergyData) {
            const attributesForSynergy = nft.attributes.filter(attr => 
                !attr.trait_type.toLowerCase().includes('skin')
            );
            
            const results = [];
            
            for (const [synergyName, synergyValues] of Object.entries(synergyData)) {
                const matching = attributesForSynergy.filter(attr => 
                    synergyValues.includes(attr.value)
                );
                
                if (matching.length >= 2) {
                    results.push({
                        synergy_type: synergyName,
                        matches: matching.length,
                        attributes: matching.map(a => `${a.trait_type}: ${a.value}`),
                        power: matching.length === 2 ? 100 : 300
                    });
                }
            }
            
            return results;
        }
        
        console.log('\n🔍 Результаты анализа:');
        console.log('----------------------');
        
        const results1 = testCalculateSynergy(testNFT1, synergyData);
        console.log('\nПример 1 - Найдено синергий:', results1.length);
        results1.forEach(r => console.log(`  ${r.synergy_type}: ${r.matches} совпадений, Power: ${r.power}`));
        
        const results2 = testCalculateSynergy(testNFT2, synergyData);
        console.log('\nПример 2 - Найдено синергий:', results2.length);
        results2.forEach(r => console.log(`  ${r.synergy_type}: ${r.matches} совпадений, Power: ${r.power}`));
        
        const results3 = testCalculateSynergy(testNFT3, synergyData);
        console.log('\nПример 3 - Найдено синергий:', results3.length);
        results3.forEach(r => console.log(`  ${r.synergy_type}: ${r.matches} совпадений, Power: ${r.power}`));
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

testSynergy();