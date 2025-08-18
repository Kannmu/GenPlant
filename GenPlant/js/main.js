import * as generator from './generator/index.js';
import * as renderer from './renderer.js';

let seedInput, randomSeedButton, generateButton,resetCameraButton, canvas;

function init() {
    // 1. 获取DOM元素引用
    seedInput = document.getElementById('seedInput');
    randomSeedButton = document.getElementById('randomBtn');
    generateButton = document.getElementById('generateBtn');
    resetCameraButton = document.getElementById('resetCameraButton');

    canvas = document.getElementById('three-canvas');

    // 2. 初始化渲染器
    renderer.init(canvas);

    // 4. 设置事件监听器
    generateButton.addEventListener('click', handleGenerateClick);
    randomSeedButton.addEventListener('click', handleRandomSeedClick);
    resetCameraButton.addEventListener('click', handleResetCameraClick);
}

function handleResetCameraClick() {
    renderer.reset();
}

function handleRandomSeedClick() {
    // 生成1到1e10之间的随机整数作为种子
    seedInput.value = getRandomSeed();
    console.log('Random Seed Set to:', seedInput.value);
}

async function handleGenerateClick() {
    try {
        // 1. 清理旧植物
        renderer.clear();

        // 2. 获取或生成新种子
        let seed = seedInput.value;
        if (!seed || isNaN(seed) || seed === 0) {
            seed = getRandomSeed();
            seedInput.value = seed;
        }

        let plant = null;
        try{
            // 3. 生成新植物
            plant = generator.generate(seed);
        }catch(error){
            console.error('Error in Generating Plant:', error, 'Presenting Default Plant Model');
        }

        // Load Default Model if Plant is not generated
        if (!plant) {
            try{
                plant = await renderer.loadDefaultModel();
            }catch(error){
                console.error('Error in Loading Default Model:', error);
            }
        }

        if (plant) {
            renderer.add(plant);
        }

        // renderer.animate()
    } catch (error) {
        console.error('Error in Generating Plant:', error);
        // alert('Error in Generating Plant. Please check the console for more information.');
    }
}

function getRandomSeed() {
    return Math.floor(Math.random() * 1e10) + 1;
}

init();





