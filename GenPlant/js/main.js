import * as generator from './generator/index.js';
import * as renderer from './renderer.js';

let seedInput, randomSeedButton, generateButton, canvas;

function init() {
    // 1. 获取DOM元素引用
    seedInput = document.getElementById('seedInput');
    randomSeedButton = document.getElementById('randomBtn');
    generateButton = document.getElementById('generateBtn');
    canvas = document.getElementById('three-canvas');

    // 2. 初始化渲染器
    // renderer.init(canvas);

    // 3. 设置事件监听器
    generateButton.addEventListener('click', handleGenerateClick);
    randomSeedButton.addEventListener('click', handleRandomSeedClick);

}

function handleRandomSeedClick() {
    // 生成1到1e10之间的随机整数作为种子
    seedInput.value = getRandomSeed();
    console.log('Random Seed Set to:', seedInput.value);
}

function handleGenerateClick() {
    try {
        // 1. 清理旧植物
        renderer.clear();

        // 2. 获取或生成新种子
        let seed = seedInput.value;
        if (!seed) {
            seedInput.value = getRandomSeed();
        }

        // 3. 生成新植物
        const plant = generator.generate(seed);

        // 4. 将植物添加到场景
        renderer.add(plant);
    } catch (error) {
        console.error('生成植物时出错:', error);
        alert('生成植物时出错。请查看控制台获取更多信息。');
    }
}

function getRandomSeed() {
    return Math.floor(Math.random() * 1e10) + 1;
}

init();





