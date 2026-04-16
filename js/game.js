import * as THREE from 'three';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const socket = io('http://localhost:3000');
let remotePlayers = {}; 

let scene, camera, renderer;
let myPlayerMesh;
let terrainGroup; 
let activeCars = []; 
const raycaster = new THREE.Raycaster(); 
const hiddenObstacles = []; 

let clock = new THREE.Clock();
let gameInitialized = false;
const keys = { w: false, a: false, s: false, d: false };

function createFaceTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0,0,128,128);
    ctx.fillStyle = '#000';
    ctx.fillRect(30, 40, 20, 20);
    ctx.fillRect(80, 40, 20, 20);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    return texture;
}

function createPlayerModel(avatarId) {
    const group = new THREE.Group();

    const customModels = ['duck', 'piggy', 'cat'];

    if (customModels.includes(avatarId)) {
        const mtlLoader = new MTLLoader();
        mtlLoader.setPath('./assets/');
        mtlLoader.load(`${avatarId}.mtl`, (materials) => {
            materials.preload();
            
            for (const key in materials.materials) {
                const mat = materials.materials[key];
                mat.side = THREE.DoubleSide; 
                mat.transparent = false; 
                mat.opacity = 1.0;
                if (mat.map) mat.map.magFilter = THREE.NearestFilter; 
            }

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath('./assets/');
            objLoader.load(`${avatarId}.obj`, (object) => {
                object.scale.set(0.125, 0.125, 0.125); 
                object.position.y = 0.5;
                object.rotation.y = Math.PI; 
                group.add(object);
            });
        });
        return group; 
    }

    const faceTex = createFaceTexture(avatarId || '#FFFFFF');
    const bodyMat = new THREE.MeshStandardMaterial({ color: avatarId || '#FFFFFF' });
    const headMat = new THREE.MeshStandardMaterial({ map: faceTex });
    const materials = [bodyMat, bodyMat, bodyMat, bodyMat, headMat, bodyMat];

    const bodyGeo = new THREE.BoxGeometry(1, 1.5, 1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);

    const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const head = new THREE.Mesh(headGeo, materials);
    head.position.y = 1.9;
    head.castShadow = true;
    group.add(head);

    return group;
}

const loadedScenery = {
    'VOXEL FOREST': [],
    'NEON CITY': [],
    'GLACIAR': [],
    'CARS': [] 
};

function loadSceneryAsset(folder, name) {
    return new Promise((resolve) => {
        const mtlLoader = new MTLLoader();
        mtlLoader.setPath(`./assets/scene/${folder}/`);
        mtlLoader.load(`${name}.mtl`, (materials) => {
            materials.preload();
            
            for (const key in materials.materials) {
                const mat = materials.materials[key];
                mat.side = THREE.DoubleSide;
                mat.transparent = false;
                mat.opacity = 1.0;
                if (mat.map) mat.map.magFilter = THREE.NearestFilter;
            }

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.setPath(`./assets/scene/${folder}/`);
            objLoader.load(`${name}.obj`, (object) => {
                object.scale.set(0.5, 0.5, 0.5); 
                resolve(object);
            }, undefined, (error) => {
                console.error(`Error cargando el modelo ${name}:`, error);
                resolve(null);
            });
        });
    });
}

async function populateProceduralObstacles(terrainGroup, stageName, rowTypes) {
    if (loadedScenery[stageName].length === 0) {
        if (stageName === 'VOXEL FOREST') {
            const assetsToLoad = ['birch', 'bush', 'flower', 'smallbirch', 'smalltree'];
            for (const asset of assetsToLoad) {
                const model = await loadSceneryAsset('nature', asset);
                if (model) loadedScenery[stageName].push(model);
            }
        } else if (stageName === 'NEON CITY') {
            const assetsToLoad = ['sign', 'fence', 'manhole'];
            for (const asset of assetsToLoad) {
                const model = await loadSceneryAsset('city', asset);
                if (model) loadedScenery[stageName].push(model);
            }
            const lantern = await loadSceneryAsset('lanterns', 'lantern');
            if (lantern) loadedScenery[stageName].push(lantern);
            
            if (loadedScenery['CARS'].length === 0) {
                const carAssets = ['schoolbus', 'car', 'taxi', 'police', 'ambulance', 'firefighter'];
                for (const car of carAssets) {
                    const model = await loadSceneryAsset('city', car);
                    if (model) loadedScenery['CARS'].push(model);
                }
            }

        } else if (stageName === 'GLACIAR') {
            const assetsToLoad = ['smallpruce', 'tree'];
            for (const asset of assetsToLoad) {
                const model = await loadSceneryAsset('nature', asset);
                if (model) loadedScenery[stageName].push(model);
            }
        }
    }

    const models = loadedScenery[stageName];
    const useFallbackCubes = models.length === 0;

    for (let z = -40; z <= 40; z += 2) {
        if (z === 0) continue;

        const rType = rowTypes[z] || 'normal';

        if (stageName === 'NEON CITY' && rType === 'road') {
            const carModels = loadedScenery['CARS'];
            if (carModels && carModels.length > 0) {
                const direction = Math.random() > 0.5 ? 1 : -1; 
                const numCars = Math.floor(Math.random() * 3) + 1; 
                
                for (let i = 0; i < numCars; i++) {
                    const template = carModels[Math.floor(Math.random() * carModels.length)];
                    const car = template.clone(); 
                    
                    car.scale.set(2.5, 2.5, 2.5); 
                    car.position.x = (Math.random() - 0.5) * 80; 
                    car.position.z = z;
                    car.position.y = -0.1; 
                    
                    car.rotation.y = direction === 1 ? Math.PI / 2 : -Math.PI / 2;
                    
                    car.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    terrainGroup.add(car);
                    
                    activeCars.push({
                        mesh: car,
                        speed: (5 + Math.random() * 5) * direction 
                    });
                }
            }
            continue; 
        }

        if (stageName === 'VOXEL FOREST' && (rType === 'water' || rType === 'path')) continue;
        if (stageName === 'GLACIAR' && rType === 'ice') continue;

        if (Math.random() > 0.5) { 
            const numObs = Math.floor(Math.random() * 4) + 1; 
            
            for (let i = 0; i < numObs; i++) {
                let obs;
                if (useFallbackCubes || (stageName === 'GLACIAR' && Math.random() > 0.5)) {
                    const obsHeight = 1 + Math.random() * 2;
                    const obsGeo = new THREE.BoxGeometry(1, obsHeight, 1);
                    const obsMat = new THREE.MeshStandardMaterial({ color: 0x85929e });
                    obs = new THREE.Mesh(obsGeo, obsMat);
                    obs.position.y = obsHeight / 2;
                } else {
                    const template = models[Math.floor(Math.random() * models.length)];
                    obs = template.clone(); 
                    const randomScale = 0.4 + (Math.random() * 0.3);
                    obs.scale.set(randomScale, randomScale, randomScale);
                    obs.rotation.y = Math.random() * Math.PI * 2; 
                }
                
                obs.userData.isObstacle = true;
                obs.traverse((child) => {
                    child.userData.isObstacle = true;
                    child.userData.rootObstacle = obs;
                    if (child.isMesh) {
                        child.castShadow = true;    
                        child.receiveShadow = true; 
                    }
                });
                
                obs.position.x = (Math.random() - 0.5) * 40; 
                obs.position.z = z;
                terrainGroup.add(obs);
            }
        }
    }
}

function generateTerrain(stageName) {
    const terrainGroup = new THREE.Group();
    const gridSize = 2; 
    const rowTypes = {}; 

    activeCars = []; 

    for (let z = -40; z <= 40; z += gridSize) {
        let type = 'grass';
        if (stageName === 'VOXEL FOREST') {
            const r = Math.random();
            if (r > 0.85) type = 'water'; 
            else if (r > 0.70) type = 'path'; 
        } else if (stageName === 'NEON CITY') {
            type = Math.random() > 0.5 ? 'road' : 'sidewalk'; 
        } else if (stageName === 'GLACIAR') {
            type = Math.random() > 0.80 ? 'ice' : 'snow'; 
        }
        rowTypes[z] = type;

        for (let x = -40; x <= 40; x += gridSize) {
            let laneColor, blockHeight = -0.5;

            if (stageName === 'VOXEL FOREST') {
                if (type === 'path') {
                    laneColor = 0x8b4513; blockHeight = -0.6; 
                } else if (type === 'water') {
                    laneColor = 0x2980b9; blockHeight = -0.8; 
                } else {
                    const pal = [0x2ecc71, 0x27ae60, 0x229954];
                    laneColor = pal[Math.floor(Math.random() * pal.length)];
                    blockHeight = -0.5 + (Math.random() * 0.25); 
                }
            } else if (stageName === 'NEON CITY') {
                if (type === 'road') {
                    laneColor = 0x111111; blockHeight = -0.6; 
                } else {
                    const pal = [0x212f3d, 0x2c3e50];
                    laneColor = pal[Math.floor(Math.random() * pal.length)];
                    blockHeight = -0.4; 
                }
            } else { 
                if (type === 'ice') {
                    laneColor = 0x85c1e9; blockHeight = -0.7; 
                } else {
                    const pal = [0xffffff, 0xebf5fb, 0xaed6f1];
                    laneColor = pal[Math.floor(Math.random() * pal.length)];
                    blockHeight = -0.5 + (Math.random() * 0.25); 
                }
            }

            const laneGeo = new THREE.BoxGeometry(gridSize, 1, gridSize);
            const laneMat = new THREE.MeshStandardMaterial({ color: laneColor });

            if (type === 'water' || type === 'ice') {
                laneMat.roughness = 0.1;
                laneMat.metalness = 0.2;
            }

            const lane = new THREE.Mesh(laneGeo, laneMat);
            lane.position.set(x, blockHeight, z);
            lane.receiveShadow = true; 
            terrainGroup.add(lane);
        }
    }

    populateProceduralObstacles(terrainGroup, stageName, rowTypes);

    return terrainGroup;
}

window.initMultiplayerGame = function() {
    if (gameInitialized) return;
    gameInitialized = true;

    const container = document.getElementById('threejs-container');
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4)); 
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 30, 10); 
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -40; 
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.bias = -0.001; 
    scene.add(dirLight);

    const stageDisplay = document.getElementById('stage-display');
    const currentStage = stageDisplay ? stageDisplay.innerText : 'NEON CITY';
    
    let skyColor = 0x0a0a1a; 
    if (currentStage === 'VOXEL FOREST') {
        skyColor = 0x87CEEB; 
    } else if (currentStage === 'GLACIAR') {
        skyColor = 0xb0c4de; 
    }
    
    scene.background = new THREE.Color(skyColor);
    scene.fog = new THREE.Fog(skyColor, 15, 45); 

    terrainGroup = generateTerrain(currentStage);
    scene.add(terrainGroup);

    let selectedColor = '#FF4500'; 
    const selectedCard = document.querySelector('.avatar-card.selected');
    
    if (selectedCard) {
        if (selectedCard.dataset.model) {
            selectedColor = selectedCard.dataset.model;
        } else {
            const avatarImage = selectedCard.querySelector('.avatar-image');
            if (avatarImage && avatarImage.style.backgroundColor) {
                selectedColor = avatarImage.style.backgroundColor;
            }
        }
    }

    myPlayerMesh = createPlayerModel(selectedColor);
    scene.add(myPlayerMesh);

    socket.emit('joinGame', selectedColor);

    window.addEventListener('keydown', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', e => { if(keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });
    window.addEventListener('resize', onWindowResize);

    animate();
};

socket.on('currentPlayers', (players) => {
    Object.keys(players).forEach(id => {
        if (id === socket.id) return; 
        addOtherPlayer(id, players[id]);
    });
});

socket.on('newPlayer', (data) => {
    addOtherPlayer(data.id, data.playerInfo);
});

socket.on('playerMoved', (data) => {
    if (remotePlayers[data.id]) {
        remotePlayers[data.id].userData.targetPosition = new THREE.Vector3(data.x, 0, data.z);
    }
});

socket.on('playerDisconnected', (id) => {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id]);
        delete remotePlayers[id];
    }
});

function addOtherPlayer(id, info) {
    const otherPlayer = createPlayerModel(info.color);
    otherPlayer.position.set(info.x, 0, info.z);
    otherPlayer.userData.targetPosition = new THREE.Vector3(info.x, 0, info.z);
    scene.add(otherPlayer);
    remotePlayers[id] = otherPlayer;
}

function animate() {
    requestAnimationFrame(animate);
    if (!window.isGameRunning) return;

    const delta = clock.getDelta();
    const time = clock.getElapsedTime();
    const speed = 5 * delta;
    let moved = false;

    activeCars.forEach(carData => {
        carData.mesh.position.x += carData.speed * delta;
        
        if (carData.speed > 0 && carData.mesh.position.x > 45) {
            carData.mesh.position.x = -45;
        } else if (carData.speed < 0 && carData.mesh.position.x < -45) {
            carData.mesh.position.x = 45;
        }
    });

    if (keys.w) { myPlayerMesh.position.z -= speed; moved = true; }
    if (keys.s) { myPlayerMesh.position.z += speed; moved = true; }
    if (keys.a) { myPlayerMesh.position.x -= speed; moved = true; }
    if (keys.d) { myPlayerMesh.position.x += speed; moved = true; }

    if (moved) {
        myPlayerMesh.position.y = Math.abs(Math.sin(time * 10)) * 0.5; 
        myPlayerMesh.rotation.y = Math.atan2((keys.a ? -1 : keys.d ? 1 : 0), (keys.w ? -1 : keys.s ? 1 : 0));
        socket.emit('move', { x: myPlayerMesh.position.x, z: myPlayerMesh.position.z });
    } else {
        myPlayerMesh.position.y = 0;
    }

    camera.position.x = myPlayerMesh.position.x;
    camera.position.z = myPlayerMesh.position.z + 8;
    camera.lookAt(myPlayerMesh.position);

    hiddenObstacles.forEach(obs => {
        if (obs) obs.visible = true;
    });
    hiddenObstacles.length = 0; 

    const direction = new THREE.Vector3().subVectors(myPlayerMesh.position, camera.position).normalize();
    const distance = camera.position.distanceTo(myPlayerMesh.position);
    raycaster.set(camera.position, direction);

    if (terrainGroup) {
        const intersects = raycaster.intersectObject(terrainGroup, true);
        
        for (let i = 0; i < intersects.length; i++) {
            const hit = intersects[i].object;
            if (intersects[i].distance < distance && hit.userData.isObstacle) {
                const rootObj = hit.userData.rootObstacle || hit;
                rootObj.visible = false; 
                hiddenObstacles.push(rootObj); 
            }
        }
    }

    for (let id in remotePlayers) {
        const rp = remotePlayers[id];
        if (rp.userData.targetPosition) {
            const dx = rp.userData.targetPosition.x - rp.position.x;
            const dz = rp.userData.targetPosition.z - rp.position.z;
            
            if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
                rp.rotation.y = Math.atan2(dx, dz);
            }

            rp.position.lerp(rp.userData.targetPosition, 0.1);
            
            if(rp.position.distanceTo(rp.userData.targetPosition) > 0.05) {
                rp.position.y = Math.abs(Math.sin(time * 10)) * 0.5;
            } else {
                rp.position.y = 0;
            }
        }
    }

    const totalPlayers = Object.keys(remotePlayers).length + 1;
    const counterElement = document.getElementById('players-count');
    if(counterElement) counterElement.innerText = totalPlayers;

    renderer.render(scene, camera);
}

function onWindowResize() {
    if(!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let exercisesInitialized = false;
window.initExercises = function() {
    if(exercisesInitialized) return;
    exercisesInitialized = true;
    
    const setups = [
        { id: 'ej1-container', geo: new THREE.BoxGeometry(1,1,1), mat: new THREE.MeshBasicMaterial({color:0xff007f, wireframe:true}) },
        { id: 'ej2-container', geo: new THREE.SphereGeometry(0.8, 16, 16), mat: new THREE.MeshNormalMaterial() },
        { id: 'ej3-container', geo: new THREE.TorusGeometry(0.5, 0.2, 16, 100), mat: new THREE.MeshStandardMaterial({color: 0x00f0ff}) },
        { id: 'ej4-container', geo: new THREE.ConeGeometry(0.8, 1.5, 32), mat: new THREE.MeshStandardMaterial({color: 0x32cd32}) }
    ];

    setups.forEach(setup => {
        const cont = document.getElementById(setup.id);
        if(!cont) return;
        const sc = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(50, cont.clientWidth/cont.clientHeight, 0.1, 10);
        cam.position.z = 3;
        const ren = new THREE.WebGLRenderer({alpha:true, antialias:true});
        ren.setSize(cont.clientWidth, cont.clientHeight);
        cont.appendChild(ren.domElement);

        sc.add(new THREE.AmbientLight(0xffffff, 0.8));
        const dl = new THREE.DirectionalLight(0xffffff, 1);
        dl.position.set(2,2,2);
        sc.add(dl);

        const mesh = new THREE.Mesh(setup.geo, setup.mat);
        sc.add(mesh);

        function animEj() {
            requestAnimationFrame(animEj);
            mesh.rotation.x += 0.01;
            mesh.rotation.y += 0.02;
            ren.render(sc, cam);
        }
        animEj();
    });
};