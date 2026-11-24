"use client";

import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ExplorerMode, ExplorerUnit, HotspotPoint } from "./types";

interface Property3DSceneProps {
  mode: ExplorerMode;
  selectedFloor: number;
  units: ExplorerUnit[];
  rooftopHotspots: HotspotPoint[];
  streetHotspots: HotspotPoint[];
  selectedUnitId: string | null;
  hoveredUnitId: string | null;
  onSelectUnit: (unit: ExplorerUnit | null) => void;
  onHoverUnit?: (unitId: string | null) => void;
  onSelectHotspot?: (hotspot: HotspotPoint) => void;
  onUpdateScreenPositions: (
    positions: { id: string; x: number; y: number; visible: boolean }[]
  ) => void;
}

export function Property3DScene({
  mode,
  selectedFloor,
  units,
  rooftopHotspots,
  streetHotspots,
  selectedUnitId,
  hoveredUnitId,
  onSelectUnit,
  onUpdateScreenPositions,
}: Property3DSceneProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = React.useRef<OrbitControls | null>(null);
  const buildingGroupRef = React.useRef<THREE.Group | null>(null);
  const floorGroupsRef = React.useRef<Map<number, THREE.Group>>(new Map());
  const rooftopGroupRef = React.useRef<THREE.Group | null>(null);
  const streetGroupRef = React.useRef<THREE.Group | null>(null);
  const roomMeshesRef = React.useRef<Map<string, THREE.Mesh>>(new Map());
  const cameraTargetPos = React.useRef(new THREE.Vector3(18, 16, 20));
  const controlsTargetLookAt = React.useRef(new THREE.Vector3(0, 2, 0));

  const stateRef = React.useRef({
    mode,
    selectedFloor,
    units,
    rooftopHotspots,
    streetHotspots,
    onUpdateScreenPositions,
  });

  React.useEffect(() => {
    stateRef.current = {
      mode,
      selectedFloor,
      units,
      rooftopHotspots,
      streetHotspots,
      onUpdateScreenPositions,
    };
  });

  // Initialize Three.js Canvas Scene
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f171a); // Elegant dark dusk background
    scene.fog = new THREE.FogExp2(0x0f171a, 0.015);
    sceneRef.current = scene;

    // 2. CAMERA
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(20, 18, 22);
    cameraRef.current = camera;

    // 3. RENDERER
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. ORBIT CONTROLS
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
    controls.minDistance = 6;
    controls.maxDistance = 50;
    controls.target.set(0, 2, 0);
    controlsRef.current = controls;

    // 5. LIGHTING
    // Ambient soft blue dusk light
    const ambientLight = new THREE.AmbientLight(0x7da4ba, 0.9);
    scene.add(ambientLight);

    // Warm key sun light (dusk angle)
    const sunLight = new THREE.DirectionalLight(0xffecd2, 1.8);
    sunLight.position.set(25, 35, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 80;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Secondary cool fill light from opposite angle
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(-20, 20, -20);
    scene.add(fillLight);

    // Ground reflective plane
    const groundGeo = new THREE.PlaneGeometry(120, 120);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x090e11,
      roughness: 0.85,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.05;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Subtle grid helper for architectural aesthetics
    const gridHelper = new THREE.GridHelper(80, 40, 0x1e3a47, 0x14252e);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Main Building Group
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);
    buildingGroupRef.current = buildingGroup;

    // 6. BUILD PROCEDURAL 3D ARCHITECTURAL MODELS
    createProceduralBuilding(buildingGroup, floorGroupsRef, rooftopGroupRef, streetGroupRef, roomMeshesRef);

    // 7. ANIMATION / RENDER LOOP
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      clock.getDelta();

      // Smooth camera interpolation towards cameraTargetPos
      camera.position.lerp(cameraTargetPos.current, 0.05);
      controls.target.lerp(controlsTargetLookAt.current, 0.05);
      controls.update();

      // Project 3D Hotspot & Room pin positions into 2D screen coordinates
      const {
        mode: curMode,
        selectedFloor: curFloor,
        units: curUnits,
        rooftopHotspots: curRooftop,
        streetHotspots: curStreet,
        onUpdateScreenPositions: curUpdatePositions,
      } = stateRef.current;

      updateScreenProjectedHotspots(
        camera,
        renderer,
        curMode,
        curFloor,
        curUnits,
        curRooftop,
        curStreet,
        curUpdatePositions
      );

      renderer.render(scene, camera);
    };

    animate();

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []);

  // Update Scene & Camera based on Mode and Selected Floor
  React.useEffect(() => {
    if (!controlsRef.current) return;

    if (mode === "HOMES") {
      // Camera looks down into cutaway floor
      cameraTargetPos.current.set(16, 17, 18);
      controlsTargetLookAt.current.set(0, (selectedFloor - 1) * 1.5 + 1.5, 0);

      // Floor visibility & elevation logic
      floorGroupsRef.current.forEach((group, floorNum) => {
        if (floorNum === selectedFloor) {
          group.visible = true;
          // Animate floor plate to highlighted elevation
          group.position.y = 0; // Cutaway view displays at center
        } else if (floorNum < selectedFloor) {
          // Lower floors shown translucent/dimmed
          group.visible = true;
          group.position.y = - (selectedFloor - floorNum) * 2.8;
        } else {
          // Upper floors hidden in cutaway mode so interior is visible
          group.visible = false;
        }
      });

      if (rooftopGroupRef.current) rooftopGroupRef.current.visible = false;
      if (streetGroupRef.current) streetGroupRef.current.visible = true;
    } else if (mode === "ROOFTOP") {
      // Camera transitions to high isometric view of rooftop
      cameraTargetPos.current.set(15, 20, 16);
      controlsTargetLookAt.current.set(0, 10, 0);

      // Show all floors stacked up to rooftop
      floorGroupsRef.current.forEach((group, floorNum) => {
        group.visible = true;
        group.position.y = (floorNum - 1) * 2.2;
      });

      if (rooftopGroupRef.current) rooftopGroupRef.current.visible = true;
      if (streetGroupRef.current) streetGroupRef.current.visible = false;
    } else if (mode === "STREET") {
      // Camera transitions down to ground street level
      cameraTargetPos.current.set(12, 4.5, 16);
      controlsTargetLookAt.current.set(0, 2, 4);

      floorGroupsRef.current.forEach((group, floorNum) => {
        group.visible = true;
        group.position.y = (floorNum - 1) * 2.2;
      });

      if (rooftopGroupRef.current) rooftopGroupRef.current.visible = false;
      if (streetGroupRef.current) streetGroupRef.current.visible = true;
    }
  }, [mode, selectedFloor]);

  // Highlight Room Mesh when Selected or Hovered
  React.useEffect(() => {
    roomMeshesRef.current.forEach((mesh, unitId) => {
      const isSelected = unitId === selectedUnitId;
      const isHovered = unitId === hoveredUnitId;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (isSelected) {
        mat.color.setHex(0x10b981); // Emerald green glow
        mat.emissive.setHex(0x064e3b);
        mat.emissiveIntensity = 0.6;
      } else if (isHovered) {
        mat.color.setHex(0x38bdf8); // Sky blue hover
        mat.emissive.setHex(0x0c4a6e);
        mat.emissiveIntensity = 0.4;
      } else {
        mat.color.setHex(0x27353f); // Dark luxury floor tile
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    });
  }, [selectedUnitId, hoveredUnitId]);

  // Raycaster click on canvas
  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!rendererRef.current || !cameraRef.current) return;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const meshes = Array.from(roomMeshesRef.current.values());
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as THREE.Mesh;
      const foundUnitId = hitMesh.userData.unitId as string;
      const unit = units.find((u) => u.id === foundUnitId) ?? null;
      onSelectUnit(unit);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      className="w-full h-full relative cursor-grab active:cursor-grabbing select-none"
    />
  );
}

// ----------------------------------------------------------------------------
// HELPER: BUILD PROCEDURAL 3D LUXURY APARTMENT BUILDING
// ----------------------------------------------------------------------------
function createProceduralBuilding(
  parentGroup: THREE.Group,
  floorGroupsMap: React.MutableRefObject<Map<number, THREE.Group>>,
  rooftopGroupRef: React.MutableRefObject<THREE.Group | null>,
  streetGroupRef: React.MutableRefObject<THREE.Group | null>,
  roomMeshesMap: React.MutableRefObject<Map<string, THREE.Mesh>>
) {
  // Shared materials
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xdde6ed, roughness: 0.6 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xa5f3fc,
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
    transmission: 0.9,
    ior: 1.5,
  });
  const furnitureMat = new THREE.MeshStandardMaterial({ color: 0x2b3842, roughness: 0.7 });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
  const bedAccentMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.5 });

  // 1. CREATE FLOORS 1 to 5
  for (let floorNum = 1; floorNum <= 5; floorNum++) {
    const floorGroup = new THREE.Group();
    floorGroup.position.y = (floorNum - 1) * 2.2;
    parentGroup.add(floorGroup);
    floorGroupsMap.current.set(floorNum, floorGroup);

    // Floor Base Concrete Slab
    const slabGeo = new THREE.BoxGeometry(15, 0.4, 11);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0x1a262e, roughness: 0.8 });
    const slabMesh = new THREE.Mesh(slabGeo, slabMat);
    slabMesh.position.set(0, 0, 0);
    slabMesh.receiveShadow = true;
    floorGroup.add(slabMesh);

    // Central Corridor
    const corridorGeo = new THREE.BoxGeometry(14.8, 0.02, 1.8);
    const corridorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const corridorMesh = new THREE.Mesh(corridorGeo, corridorMat);
    corridorMesh.position.set(0, 0.21, 0);
    floorGroup.add(corridorMesh);

    // 6 Room layouts per floor (3 North, 3 South)
    const roomOffsets = [
      { idNum: `${floorNum}01`, pos: [-4.5, 0.22, -2.8], w: 4.2, l: 3.4 },
      { idNum: `${floorNum}03`, pos: [0, 0.22, -2.8], w: 4.2, l: 3.4 },
      { idNum: `${floorNum}05`, pos: [4.5, 0.22, -2.8], w: 4.2, l: 3.4 },
      { idNum: `${floorNum}02`, pos: [-4.5, 0.22, 2.8], w: 4.2, l: 3.4 },
      { idNum: `${floorNum}04`, pos: [0, 0.22, 2.8], w: 4.2, l: 3.4 },
      { idNum: `${floorNum}06`, pos: [4.5, 0.22, 2.8], w: 4.2, l: 3.4 },
    ];

    roomOffsets.forEach((room) => {
      const unitKey = `unit-${room.idNum}`;

      // Room Floor Plate (Clickable for Raycasting)
      const roomGeo = new THREE.BoxGeometry(room.w, 0.04, room.l);
      const roomTileMat = new THREE.MeshStandardMaterial({
        color: 0x27353f,
        roughness: 0.45,
        metalness: 0.1,
      });
      const roomMesh = new THREE.Mesh(roomGeo, roomTileMat);
      roomMesh.position.set(room.pos[0], room.pos[1], room.pos[2]);
      roomMesh.receiveShadow = true;
      roomMesh.userData = { unitId: unitKey, unitNumber: room.idNum };
      floorGroup.add(roomMesh);
      roomMeshesMap.current.set(unitKey, roomMesh);

      // Low Cutaway Perimeter Walls (Isometric Cutaway height 0.9m)
      createRoomCutawayWalls(floorGroup, room.pos[0], room.pos[2], room.w, room.l, wallMat);

      // Stylized Interior Furniture
      createRoomFurniture(floorGroup, room.pos[0], room.pos[2], bedMat, bedAccentMat, furnitureMat);

      // Warm Room Spotlight
      const warmLight = new THREE.PointLight(0xfef08a, 0.8, 4.5);
      warmLight.position.set(room.pos[0], 1.2, room.pos[2]);
      floorGroup.add(warmLight);
    });

    // Outer Glass Balconies on South Side
    const balconyGeo = new THREE.BoxGeometry(14.6, 0.7, 0.1);
    const balconyMesh = new THREE.Mesh(balconyGeo, glassMat);
    balconyMesh.position.set(0, 0.6, 5.4);
    floorGroup.add(balconyMesh);
  }

  // 2. CREATE ROOFTOP AMENITIES (SKY GARDEN & TERRACE)
  const rooftopGroup = new THREE.Group();
  rooftopGroup.position.y = 5 * 2.2 + 0.4;
  parentGroup.add(rooftopGroup);
  rooftopGroupRef.current = rooftopGroup;
  rooftopGroup.visible = false;

  // Rooftop Wooden Deck
  const deckGeo = new THREE.BoxGeometry(15, 0.3, 11);
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
  const deckMesh = new THREE.Mesh(deckGeo, deckMat);
  rooftopGroup.add(deckMesh);

  // Rooftop Glass Perimeter Railing
  const roofRailNorth = new THREE.Mesh(new THREE.BoxGeometry(15, 1.1, 0.1), glassMat);
  roofRailNorth.position.set(0, 0.7, -5.4);
  const roofRailSouth = new THREE.Mesh(new THREE.BoxGeometry(15, 1.1, 0.1), glassMat);
  roofRailSouth.position.set(0, 0.7, 5.4);
  const roofRailEast = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 11), glassMat);
  roofRailEast.position.set(7.4, 0.7, 0);
  const roofRailWest = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 11), glassMat);
  roofRailWest.position.set(-7.4, 0.7, 0);
  rooftopGroup.add(roofRailNorth, roofRailSouth, roofRailEast, roofRailWest);

  // Pergola Pavilion (BBQ Zone)
  const pergolaPillarGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2);
  const pergolaMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
  [-5, -2].forEach((x) => {
    [-3, 1].forEach((z) => {
      const p = new THREE.Mesh(pergolaPillarGeo, pergolaMat);
      p.position.set(x, 1.1, z);
      rooftopGroup.add(p);
    });
  });
  const pergolaRoof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.08, 4.6), pergolaMat);
  pergolaRoof.position.set(-3.5, 2.2, -1);
  rooftopGroup.add(pergolaRoof);

  // Green Planters & Lounge Seats
  const planterMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.9 });
  [-5, 0, 5].forEach((x) => {
    const planterBox = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 0.8), wallMat);
    planterBox.position.set(x, 0.45, 4.6);
    const foliage = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.6), planterMat);
    foliage.position.set(x, 0.85, 4.6);
    rooftopGroup.add(planterBox, foliage);
  });

  // Warm Lanterns on rooftop
  const roofLantern = new THREE.PointLight(0xf59e0b, 1.8, 8);
  roofLantern.position.set(-3.5, 1.8, -1);
  rooftopGroup.add(roofLantern);

  // 3. CREATE STREET LEVEL (GROUND LOBBY, CAFÉ & ROAD)
  const streetGroup = new THREE.Group();
  parentGroup.add(streetGroup);
  streetGroupRef.current = streetGroup;

  // Sidewalk
  const sidewalk = new THREE.Mesh(
    new THREE.BoxGeometry(24, 0.2, 5),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
  );
  sidewalk.position.set(0, 0.08, 8);
  streetGroup.add(sidewalk);

  // Asphalt Street
  const road = new THREE.Mesh(
    new THREE.BoxGeometry(36, 0.05, 7),
    new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 })
  );
  road.position.set(0, 0.02, 14);
  streetGroup.add(road);

  // Modern Entrance Canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.15, 2.5), pergolaMat);
  canopy.position.set(0, 1.8, 6.2);
  streetGroup.add(canopy);

  // Warm Entrance Light
  const entranceLight = new THREE.PointLight(0xffedd5, 1.5, 6);
  entranceLight.position.set(0, 1.6, 6.2);
  streetGroup.add(entranceLight);

  // Streetlamps
  [-8, 8].forEach((lx) => {
    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.5), pergolaMat);
    lampPost.position.set(lx, 1.8, 10.2);
    const lampLight = new THREE.PointLight(0xffedd5, 1.4, 9);
    lampLight.position.set(lx, 3.4, 10.2);
    streetGroup.add(lampPost, lampLight);
  });
}

// Helper to draw clean architectural cutaway walls
function createRoomCutawayWalls(
  parent: THREE.Group,
  cx: number,
  cz: number,
  w: number,
  l: number,
  mat: THREE.Material
) {
  const wallH = 0.9;
  const wallT = 0.12;

  // North wall
  const nw = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, wallT), mat);
  nw.position.set(cx, wallH / 2 + 0.2, cz - l / 2);
  // West wall
  const ww = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, l), mat);
  ww.position.set(cx - w / 2, wallH / 2 + 0.2, cz);
  // East wall
  const ew = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, l), mat);
  ew.position.set(cx + w / 2, wallH / 2 + 0.2, cz);

  parent.add(nw, ww, ew);
}

// Helper to build miniature stylized furniture
function createRoomFurniture(
  parent: THREE.Group,
  cx: number,
  cz: number,
  bedMat: THREE.Material,
  accentMat: THREE.Material,
  woodMat: THREE.Material
) {
  // 1. Bed (Base + Mattress + Pillows + Blanket)
  const bedBase = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 2.0), woodMat);
  bedBase.position.set(cx - 0.8, 0.33, cz - 0.5);

  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 1.9), bedMat);
  mattress.position.set(cx - 0.8, 0.5, cz - 0.5);

  const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.1, 1.1), accentMat);
  duvet.position.set(cx - 0.8, 0.55, cz - 0.1);

  // Pillows
  const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.35), bedMat);
  pillow.position.set(cx - 1.1, 0.62, cz - 1.15);
  const pillow2 = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.35), bedMat);
  pillow2.position.set(cx - 0.5, 0.62, cz - 1.15);

  // 2. Sofa & Coffee table
  const sofa = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.7), accentMat);
  sofa.position.set(cx + 0.9, 0.45, cz + 0.6);

  const table = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.5), woodMat);
  table.position.set(cx + 0.9, 0.35, cz - 0.1);

  parent.add(bedBase, mattress, duvet, pillow, pillow2, sofa, table);
}

// ----------------------------------------------------------------------------
// PROJECT 3D HOTSPOT LOCATIONS TO 2D SCREEN PIXELS FOR HTML OVERLAYS
// ----------------------------------------------------------------------------
function updateScreenProjectedHotspots(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  mode: ExplorerMode,
  selectedFloor: number,
  units: ExplorerUnit[],
  rooftopHotspots: HotspotPoint[],
  streetHotspots: HotspotPoint[],
  callback: (positions: { id: string; x: number; y: number; visible: boolean }[]) => void
) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const results: { id: string; x: number; y: number; visible: boolean }[] = [];
  const tempVec = new THREE.Vector3();

  if (mode === "HOMES") {
    // Project pins for units on selected floor
    const floorUnits = units.filter((u) => u.floor === selectedFloor);
    floorUnits.forEach((u) => {
      tempVec.set(u.position3D[0], u.position3D[1] + 1.2, u.position3D[2]);
      tempVec.project(camera);

      // Check if within visible frustum
      const isVisible = tempVec.z < 1.0 && tempVec.x >= -1.1 && tempVec.x <= 1.1 && tempVec.y >= -1.1 && tempVec.y <= 1.1;
      const x = ((tempVec.x + 1) * width) / 2;
      const y = ((-tempVec.y + 1) * height) / 2;

      results.push({ id: u.id, x, y, visible: isVisible });
    });
  } else if (mode === "ROOFTOP") {
    rooftopHotspots.forEach((hs) => {
      tempVec.set(hs.position3D[0], hs.position3D[1], hs.position3D[2]);
      tempVec.project(camera);
      const isVisible = tempVec.z < 1.0;
      const x = ((tempVec.x + 1) * width) / 2;
      const y = ((-tempVec.y + 1) * height) / 2;
      results.push({ id: hs.id, x, y, visible: isVisible });
    });
  } else if (mode === "STREET") {
    streetHotspots.forEach((hs) => {
      tempVec.set(hs.position3D[0], hs.position3D[1], hs.position3D[2]);
      tempVec.project(camera);
      const isVisible = tempVec.z < 1.0;
      const x = ((tempVec.x + 1) * width) / 2;
      const y = ((-tempVec.y + 1) * height) / 2;
      results.push({ id: hs.id, x, y, visible: isVisible });
    });
  }

  callback(results);
}
