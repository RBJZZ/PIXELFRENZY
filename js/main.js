function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        targetScreen.classList.add('active');
    }
}

// THEMES AND QUALITY

const qualities = ['Baja', 'Media', 'Alta', 'Ultra'];
let currentQualityIndex = 2; 

function changeQuality(direction) {
    currentQualityIndex += direction;
    if (currentQualityIndex < 0) currentQualityIndex = qualities.length - 1;
    if (currentQualityIndex >= qualities.length) currentQualityIndex = 0;
    
    document.getElementById('quality-display').innerText = qualities[currentQualityIndex];
    if(typeof clickSound === 'function') clickSound();
}

const themes = [
    { id: 'theme-neon', name: 'NEON' },
    { id: 'theme-vibrant', name: 'VIBRANT' },
    { id: 'theme-fantasy', name: 'FANTASY' },
    { id: 'theme-gothic', name: 'GOTHIC' }
];
let currentThemeIndex = 0;

function changeThemeCarousel(direction) {
    currentThemeIndex += direction;
    if (currentThemeIndex < 0) currentThemeIndex = themes.length - 1;
    if (currentThemeIndex >= themes.length) currentThemeIndex = 0;

    document.getElementById('theme-display').innerText = themes[currentThemeIndex].name;
    
    document.body.classList.remove('theme-neon', 'theme-vibrant', 'theme-fantasy', 'theme-gothic');
    if (themes[currentThemeIndex].id !== 'theme-neon') {
        document.body.classList.add(themes[currentThemeIndex].id);
    }
    
    if(typeof clickSound === 'function') clickSound();
}

// AUDIO

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, type, duration) {
    if(audioCtx.state === 'suspended') audioCtx.resume(); 
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = type; 
    oscillator.frequency.value = frequency;
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    oscillator.stop(audioCtx.currentTime + duration);
}

const hoverSound = () => playSound(440, 'sine', 0.1); 
const clickSound = () => playSound(800, 'square', 0.15); 

document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('mouseenter', hoverSound);
    btn.addEventListener('click', clickSound);
});

// AVATAR SECTION

function selectAvatar(cardElement) {

    if(typeof clickSound === 'function') clickSound();

    const cards = document.querySelectorAll('.avatar-card');
    cards.forEach(card => card.classList.remove('selected'));

    cardElement.classList.add('selected');
}

// MENU SCENARIOS
const stages = [
    { name: 'NEON CITY', bgColor: '#4B0082' }, 
    { name: 'VOXEL FOREST', bgColor: '#145A32' }, 
    { name: 'GLACIAR', bgColor: '#1B4F72' }  
];
let currentStageIndex = 0;

function changeStage(direction) {
    currentStageIndex += direction;
    
    if (currentStageIndex < 0) currentStageIndex = stages.length - 1;
    if (currentStageIndex >= stages.length) currentStageIndex = 0;


    document.getElementById('stage-display').innerText = stages[currentStageIndex].name;
    
    document.body.style.backgroundColor = stages[currentStageIndex].bgColor;
    
    if(typeof clickSound === 'function') clickSound();
}