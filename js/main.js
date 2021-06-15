import * as THREE from '../node_modules/three/build/three.module.js';
import { OrbitControls } from '../node_modules/three/examples/jsm/controls/OrbitControls.js';
import * as Utils from './utils.js';
import { circleInstance, getCoordinates, getMesh } from './instancing.js';
import { GLTFLoader } from '../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from '../node_modules/three/examples/jsm/loaders/RGBELoader.js';
import Curve from './curve.js';

class App {
    constructor(canvas) {
        this.canvas = canvas;
        this.continents = null;
        this.points = null;                                                                     // coordinates of continents except for artic & antarctic
        this.spikes = [];                                                                       // array of tower & top
        this.curves = [];
        this.circles = [];
        this.init();
    }

    /*
        function:   initialises scene, camera, light, renderer, control, axeshelper and sky.
                    resize & mousemove events.
                    reads envmap.
                    gets coordinates of all continents including/excluding artic & antartic.
                    calls start() finally.
    */
    init() {
        this.scene = new THREE.Scene();

        this.scene.background = new THREE.Color(0x000000);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 0.5, 90);
        this.scene.add(this.camera);
        // this.scene.fog = new THREE.Fog(0, 0, 6e7);

        var hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.4);
        this.scene.add(hemiLight);
        // this.scene.add(new THREE.AmbientLight(0x404040));
        // this.scene.add(new THREE.DirectionalLight(0xffffff, 0.5));
        var pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(-300, 500, 0);
        this.camera.add(pointLight);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        const DPR = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
        this.renderer.setPixelRatio(DPR);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enablePan = false;
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enableZoom = false;
        this.controls.autoRotate = true;
        this.controls.update();
        this.controls.autoRotateSpeed = 0.5;

        this.axesHelper = new THREE.AxesHelper(70);
        // this.scene.add(this.axesHelper);

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        const skyMap = new THREE.TextureLoader().load('assets/space.jpeg');
        skyMap.encoding = THREE.sRGBEncoding;
        const sky = new THREE.Mesh(
            new THREE.SphereBufferGeometry(400, 20, 20).scale(-1, 1, 1),
            new THREE.MeshBasicMaterial({
                // color: 0x446688,
                // color: 0x000000
                color: 0x050817
                // map: skyMap
            })
        );
        sky.name = 'sky';
        sky.position.set(0, -5, 0)
        this.scene.add(sky);

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }, false);

        window.addEventListener('mousemove', e => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = - (e.clientY / window.innerHeight) * 2 + 1;
            document.getElementById('description').style.left = e.clientX - 150 + 'px';
            document.getElementById('description').style.top = e.clientY - 47 + 'px';
            document.getElementById('description').style.display = 'none';
        });

        Promise.all([
            new Promise(resolve => {
                new RGBELoader().setDataType(THREE.UnsignedByteType).load('assets/venice_sunset_1k.hdr', resolve)
            }).then(result => {
                var texture = result;
                var pmremGenerator = new THREE.PMREMGenerator(this.renderer);
                pmremGenerator.compileEquirectangularShader();
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                this.scene.environment = envMap;
                texture.dispose();
                pmremGenerator.dispose();
            }),
            this.loadModel('assets/tower.glb').then(result => { }),
            new Promise(resolve => { circleInstance(this.scene, resolve) }).then(() => {
                this.points = getCoordinates().coordinates;                                     // continents except for artic & antartic
                this.pixels = getCoordinates().pixels;                                          // continents including artic & antartic
                this.continents = getMesh();                                                    // instanced mesh that holds continents
            })
        ]).then(() => {
            this.start();
        });
    }

    /*
        function:   builds globe and static spikes & tops.
                    calls animate() finally.
    */
    start() {
        Utils.buildGlobe(this.scene);

        // const result = Utils.buildCurves(this.scene)
        // this.curves = result.c;
        // this.circles = result.o;

        for (var i = 0; i < 200; i++) {
            this.spikes.push({ tower: null, top: null });
            this.spikes.push({ tower: null, top: null });
            this.curves.push(null);
        }

        // makes spike geometry & material
        var spikeGeo = new THREE.CylinderBufferGeometry(.08, .08, 5, 32).rotateX(Math.PI / 2).translate(.04, .04, 2.5);
        var spikeMat = new THREE.MeshPhongMaterial({ color: 0x00ff00, transparent: true, opacity: .7 });
        // makes spike top geometry & material
        var topGeo = new THREE.SphereGeometry(.25, 2, 2);
        var topMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

        // makes state spikes & tops
        for (i = 40; i < 50; i++) {
            var startPoint = this.points[parseInt(this.points.length * Math.random())];
            this.spikes[i].tower = new THREE.Mesh(spikeGeo, spikeMat);
            this.spikes[i].tower.name = 'point';
            this.spikes[i].tower.position.copy(startPoint);
            this.spikes[i].tower.lookAt(0, 0, 0);
            this.spikes[i].tower.scale.z = -.35;
            this.spikes[i].top = new THREE.Mesh(topGeo, topMat);
            this.spikes[i].top.position.copy(this.top(startPoint));
            this.spikes[i].top.lookAt(new THREE.Vector3(0, 0, 0));
            this.scene.add(this.spikes[i].tower);
            this.scene.add(this.spikes[i].top);
        }

        this.animate();
    }

    /*  
        param:      mesh
        function:   removes mesh from scene
    */
    remove(m) {
        m.geometry.dispose();
        m.material.dispose();
        this.scene.remove(m);
    }

    /*
        param:      url
        function:   loads model from url
    */
    loadModel(url) {
        return new Promise(resolve => { new GLTFLoader().load(url, resolve); });
    }

    /*
        param:      spike position as Vector3
        function:   converts cartesian(x, y, z) to spherical(r, phi, theta) which is followed by conversion back to cartesian with radius (GLOBE_RADIUS + TOWER_HEIGHT)
    */
    top(point) {
        var phi = Math.acos(point.z / 25);
        var theta = Math.atan(point.y / point.x);
        if (point.x > 0) {
            return new THREE.Vector3(27.2 * Math.sin(phi) * Math.cos(theta), 27.2 * Math.sin(phi) * Math.sin(theta), 27.2 * Math.cos(phi));
        } else {
            return new THREE.Vector3(-27.2 * Math.sin(phi) * Math.cos(theta), -27.2 * Math.sin(phi) * Math.sin(theta), 27.2 * Math.cos(phi));
        }
    }

    /*
        function:   makes a maximum of 20 curves which will be created after a certian periord of delay time.
                    animates curves and spikes and removes them once animation is finished.
    */
    animate() {
        var delays = [];
        var timers = [];
        for (var i = 0; i < 200; i++) {
            delays.push(parseInt(Math.random() * 2000));
            timers.push(0);
            this.spikes.push({ tower: null, top: null });
            this.spikes.push({ tower: null, top: null });
            this.curves.push(null);
        }

        var startPoint = null;

        // makes spike geometry & material
        var spikeGeo = new THREE.CylinderBufferGeometry(.1, .1, 5, 32).rotateX(Math.PI / 2).translate(.1, .1, 2.5);
        var spikeMat = new THREE.MeshPhongMaterial({ color: 0x00ff00, transparent: true, opacity: .7 });
        // makes spike top geometry & material
        var topGeo = new THREE.SphereGeometry(.25, 2, 2);
        var topMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

        delays[0] = 0;

        var render = () => {
            // shows description when hovering on spikes(towers)
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children, false);
            if (intersects.length > 0 && intersects[0].object.name == 'point') {
                document.getElementById('description').style.display = 'block';
            }

            for (i = 0; i < 20; i++) {
                timers[i]++;
                if (this.curves[i] == null) {
                    if (timers[i] > delays[i] && i != 0) {
                        // initialises start & end spikes and tops
                        this.spikes[2 * i] = { tower: null, top: null };
                        this.spikes[2 * i + 1] = { tower: null, top: null };

                        // chooses a random start point on continents
                        startPoint = this.points[parseInt(this.points.length * Math.random())];

                        // makes start spike & top
                        this.spikes[2 * i].tower = new THREE.Mesh(spikeGeo, spikeMat);
                        this.spikes[2 * i].tower.name = 'point';
                        this.spikes[2 * i].tower.position.copy(startPoint);
                        this.spikes[2 * i].tower.lookAt(new THREE.Vector3(0, 0, 0));
                        this.spikes[2 * i].tower.scale.z = 0;
                        this.spikes[2 * i].top = new THREE.Mesh(topGeo, topMat);
                        this.spikes[2 * i].top.position.copy(this.top(startPoint));
                        this.spikes[2 * i].top.lookAt(new THREE.Vector3(0, 0, 0));

                        // chooses a random end point with distance to start point smaller than 40
                        var endPoint = this.points[parseInt(this.points.length * Math.random())];
                        while (endPoint.distanceTo(startPoint) > 40) {
                            endPoint = this.points[parseInt(this.points.length * Math.random())];
                        }

                        // makes end spike & top
                        this.spikes[2 * i + 1].tower = this.spikes[2 * i].tower.clone();
                        this.spikes[2 * i + 1].tower.name = 'point';
                        this.spikes[2 * i + 1].tower.position.copy(endPoint);
                        this.spikes[2 * i + 1].tower.lookAt(new THREE.Vector3(0, 0, 0));
                        this.spikes[2 * i + 1].tower.scale.z = 0;
                        this.spikes[2 * i + 1].top = this.spikes[2 * i].top.clone();
                        this.spikes[2 * i + 1].top.position.copy(this.top(endPoint));
                        this.spikes[2 * i + 1].top.lookAt(new THREE.Vector3(0, 0, 0));

                        // makes a curve
                        this.curves[i] = new Curve(this.scene, startPoint, endPoint);

                        this.scene.add(this.spikes[2 * i].tower);
                        this.scene.add(this.spikes[2 * i + 1].tower);
                        this.scene.add(this.spikes[2 * i].top);
                        this.scene.add(this.spikes[2 * i + 1].top);
                    }
                } else {
                    // destroy curve & towers
                    if (!this.curves[i].animation) {
                        this.curves[i] = null;
                        this.remove(this.spikes[2 * i].tower);
                        this.remove(this.spikes[2 * i + 1].tower);
                        this.remove(this.spikes[2 * i].top);
                        this.remove(this.spikes[2 * i + 1].top);
                        this.spikes[2 * i] = null;
                        this.spikes[2 * i + 1] = null;
                        timers[i] = 0;
                    } else {
                        if (this.curves[i].dir == 1) {
                            if (this.curves[i].drawCounts < 3600) {
                                this.spikes[2 * i].tower.scale.z -= .004;
                                this.spikes[2 * i + 1].tower.scale.z -= .004;
                            }
                        } else {
                            if (this.curves[i].drawCounts < 3600) {
                                this.spikes[2 * i].tower.scale.z += .004;
                                this.spikes[2 * i + 1].tower.scale.z += .004;
                            }
                        }
                    }
                }
            }

            this.renderer.render(this.scene, this.camera);
            this.controls.update();
            requestAnimationFrame(render);
        }

        render();
    }
}

var app = new App(document.getElementById('canvas'));
