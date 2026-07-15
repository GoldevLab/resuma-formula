/**
 * Resuma Formula — original WebGPU desk-toy racer.
 * Modes: kit (parts on cutting mat) · drive (WASD) · studio (orbit).
 * Inspired by Patrick Heintzmann's closed-source Formula showcase; no code reuse.
 */
const WGSL = /* wgsl */ `
struct U {
  mvp : mat4x4f,
  light : vec3f,
  mode : f32,
  eye : vec3f,
  _pad : f32,
};
@group(0) @binding(0) var<uniform> u : U;

struct VSIn {
  @location(0) pos : vec3f,
  @location(1) nrm : vec3f,
  @location(2) col : vec3f,
};
struct VSOut {
  @builtin(position) clip : vec4f,
  @location(0) world : vec3f,
  @location(1) nrm : vec3f,
  @location(2) col : vec3f,
};

@vertex fn vs_main(input : VSIn) -> VSOut {
  var o : VSOut;
  o.clip = u.mvp * vec4f(input.pos, 1.0);
  o.world = input.pos;
  o.nrm = input.nrm;
  o.col = input.col;
  return o;
}

@fragment fn fs_main(input : VSOut) -> @location(0) vec4f {
  let n = normalize(input.nrm);
  let L = normalize(u.light - input.world);
  let V = normalize(u.eye - input.world);
  let ndl = max(dot(n, L), 0.0);
  let h = normalize(L + V);
  let spec = pow(max(dot(n, h), 0.0), 48.0) * 0.35;
  let ambient = 0.22;
  var shade = ambient + ndl * 0.78;
  // Cutting-mat grid (kit / drive floor)
  let grid = abs(fract(input.world.x * 0.5) - 0.5) * abs(fract(input.world.z * 0.5) - 0.5);
  let matBoost = select(0.0, step(0.42, grid) * 0.08, input.col.b > 0.35 && input.col.r < 0.35);
  var col = input.col * (shade + matBoost) + vec3f(spec);
  return vec4f(clamp(col, vec3f(0.0), vec3f(1.4)), 1.0);
}
`;

function mat4Id() {
  return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}
function mat4Mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    const ai0 = a[i], ai1 = a[i+4], ai2 = a[i+8], ai3 = a[i+12];
    o[i]    = ai0*b[0]  + ai1*b[1]  + ai2*b[2]  + ai3*b[3];
    o[i+4]  = ai0*b[4]  + ai1*b[5]  + ai2*b[6]  + ai3*b[7];
    o[i+8]  = ai0*b[8]  + ai1*b[9]  + ai2*b[10] + ai3*b[11];
    o[i+12] = ai0*b[12] + ai1*b[13] + ai2*b[14] + ai3*b[15];
  }
  return o;
}
function mat4Persp(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const o = new Float32Array(16);
  o[0] = f / aspect; o[5] = f; o[10] = far / (near - far); o[11] = -1;
  o[14] = (far * near) / (near - far);
  return o;
}
function mat4LookAt(eye, center, up) {
  let zx = eye[0]-center[0], zy = eye[1]-center[1], zz = eye[2]-center[2];
  let zl = Math.hypot(zx,zy,zz)||1; zx/=zl; zy/=zl; zz/=zl;
  let xx = up[1]*zz - up[2]*zy, xy = up[2]*zx - up[0]*zz, xz = up[0]*zy - up[1]*zx;
  let xl = Math.hypot(xx,xy,xz)||1; xx/=xl; xy/=xl; xz/=xl;
  const yx = zy*xz - zz*xy, yy = zz*xx - zx*xz, yz = zx*xy - zy*xx;
  const o = mat4Id();
  o[0]=xx; o[1]=yx; o[2]=zx;
  o[4]=xy; o[5]=yy; o[6]=zy;
  o[8]=xz; o[9]=yz; o[10]=zz;
  o[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
  o[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
  o[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
  return o;
}
function mat4Translate(m, x,y,z) {
  const t = mat4Id(); t[12]=x; t[13]=y; t[14]=z; return mat4Mul(m, t);
}
function mat4RotateY(m, a) {
  const c=Math.cos(a), s=Math.sin(a);
  const r = mat4Id(); r[0]=c; r[2]=s; r[8]=-s; r[10]=c;
  return mat4Mul(m, r);
}

function pushBox(verts, indices, cx,cy,cz, sx,sy,sz, col, yaw=0) {
  const hx=sx/2, hy=sy/2, hz=sz/2;
  const c=Math.cos(yaw), s=Math.sin(yaw);
  const corners = [
    [-hx,-hy,-hz],[ hx,-hy,-hz],[ hx, hy,-hz],[-hx, hy,-hz],
    [-hx,-hy, hz],[ hx,-hy, hz],[ hx, hy, hz],[-hx, hy, hz],
  ].map(([x,y,z]) => {
    const X = cx + x*c + z*s;
    const Z = cz - x*s + z*c;
    return [X, cy+y, Z];
  });
  const faces = [
    [0,1,2,3, 0,0,-1], [5,4,7,6, 0,0,1],
    [4,0,3,7,-1,0,0], [1,5,6,2, 1,0,0],
    [3,2,6,7, 0,1,0], [4,5,1,0, 0,-1,0],
  ];
  for (const [a,b,d,e, nx,ny,nz] of faces) {
    // rotate normals by yaw
    const N = [nx*c + nz*s, ny, -nx*s + nz*c];
    const base = verts.length / 9;
    for (const i of [a,b,d,e]) {
      const p = corners[i];
      verts.push(p[0],p[1],p[2], N[0],N[1],N[2], col[0],col[1],col[2]);
    }
    indices.push(base, base+1, base+2, base, base+2, base+3);
  }
}

function buildScene(mode, car) {
  const verts = [];
  const indices = [];
  const mat = [0.12, 0.42, 0.78];
  const red = [0.82, 0.08, 0.22];
  const dark = [0.08, 0.09, 0.12];
  const tire = [0.05, 0.05, 0.06];
  const cream = [0.9, 0.88, 0.82];
  const tool = [0.55, 0.58, 0.62];

  // Cutting mat floor
  pushBox(verts, indices, 0, -0.02, 0, 14, 0.04, 10, mat);

  if (mode === "kit") {
    // Scattered parts
    pushBox(verts, indices, -3.2, 0.08, -2.0, 1.8, 0.12, 0.7, red, 0.4);
    pushBox(verts, indices, -1.0, 0.08, -2.4, 1.2, 0.10, 0.5, red, -0.3);
    pushBox(verts, indices, 1.4, 0.12, -1.8, 0.45, 0.22, 0.45, tire);
    pushBox(verts, indices, 2.2, 0.12, -2.2, 0.45, 0.22, 0.45, tire);
    pushBox(verts, indices, 2.9, 0.12, -1.6, 0.45, 0.22, 0.45, tire);
    pushBox(verts, indices, 3.5, 0.12, -2.3, 0.45, 0.22, 0.45, tire);
    pushBox(verts, indices, -2.8, 0.06, 1.6, 0.8, 0.08, 0.25, cream, 0.2);
    pushBox(verts, indices, -0.5, 0.08, 2.0, 0.15, 0.15, 1.4, tool, 1.1);
    pushBox(verts, indices, 1.0, 0.1, 1.5, 0.35, 0.2, 0.35, [0.7,0.15,0.12]);
    // chassis core waiting assembly
    pushBox(verts, indices, 0.2, 0.15, 0.1, 2.4, 0.18, 0.9, dark, 0.05);
  } else {
    // Assembled F1-ish car at car.x, car.z, car.yaw
    const x = car.x, z = car.z, y = 0.22, yaw = car.yaw;
    pushBox(verts, indices, x, y, z, 2.6, 0.28, 1.0, red, yaw);
    pushBox(verts, indices, x, y + 0.22, z, 1.1, 0.28, 0.7, dark, yaw);
    pushBox(verts, indices, x, y + 0.38, z, 0.55, 0.18, 0.55, cream, yaw);
    // nose
    const nx = x + Math.sin(yaw) * 1.5;
    const nz = z + Math.cos(yaw) * 1.5;
    pushBox(verts, indices, nx, y - 0.02, nz, 0.9, 0.16, 0.35, red, yaw);
    // rear wing
    const rx = x - Math.sin(yaw) * 1.35;
    const rz = z - Math.cos(yaw) * 1.35;
    pushBox(verts, indices, rx, y + 0.35, rz, 0.2, 0.35, 1.15, dark, yaw);
    // tires
    const side = 0.62;
    const ax = 0.85;
    const offsets = [[ax, side], [ax, -side], [-ax, side], [-ax, -side]];
    for (const [lon, lat] of offsets) {
      const wx = x + Math.sin(yaw) * lon + Math.cos(yaw) * lat;
      const wz = z + Math.cos(yaw) * lon - Math.sin(yaw) * lat;
      pushBox(verts, indices, wx, 0.14, wz, 0.42, 0.28, 0.22, tire, yaw);
    }
    // soft barriers
    pushBox(verts, indices, 0, 0.25, -4.6, 13, 0.5, 0.25, [0.85,0.75,0.2]);
    pushBox(verts, indices, 0, 0.25, 4.6, 13, 0.5, 0.25, [0.85,0.75,0.2]);
    pushBox(verts, indices, -6.6, 0.25, 0, 0.25, 0.5, 9, [0.85,0.75,0.2]);
    pushBox(verts, indices, 6.6, 0.25, 0, 0.25, 0.5, 9, [0.85,0.75,0.2]);
  }

  return {
    vertices: new Float32Array(verts),
    indices: new Uint32Array(indices),
  };
}

async function create(canvas, opts = {}) {
  if (!navigator.gpu) throw new Error("WebGPU no disponible");
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("sin adapter WebGPU");
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const module = device.createShaderModule({ code: WGSL });
  const bindLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } }],
  });
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindLayout] }),
    vertex: {
      module,
      entryPoint: "vs_main",
      buffers: [{
        arrayStride: 36,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" },
          { shaderLocation: 2, offset: 24, format: "float32x3" },
        ],
      }],
    },
    fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
    primitive: { topology: "triangle-list", cullMode: "back" },
    depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
    multisample: { count: 4 },
  });

  const uniformBuf = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bindGroup = device.createBindGroup({
    layout: bindLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuf } }],
  });

  let vBuf = null, iBuf = null, indexCount = 0;
  let colorMs = null, depthMs = null, depthW = 0, depthH = 0;
  let mode = "drive";
  let raf = 0;
  let yawCam = 0.6, pitchCam = 0.35, distCam = 9;
  let dragging = false, lastX = 0, lastY = 0;
  const keys = Object.create(null);
  const car = { x: 0, z: 0, yaw: 0, v: 0 };
  let dirty = true;
  const onHud = typeof opts.onHud === "function" ? opts.onHud : () => {};

  function ensureTargets(w, h) {
    if (depthW === w && depthH === h && colorMs) return;
    colorMs?.destroy(); depthMs?.destroy();
    colorMs = device.createTexture({
      size: { width: w, height: h }, format, sampleCount: 4,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    depthMs = device.createTexture({
      size: { width: w, height: h }, format: "depth24plus", sampleCount: 4,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    depthW = w; depthH = h;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor((canvas.clientWidth || 640) * dpr));
    const h = Math.max(2, Math.floor((canvas.clientHeight || 400) * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      ensureTargets(w, h);
    }
  }

  function uploadMesh() {
    const mesh = buildScene(mode, car);
    vBuf?.destroy(); iBuf?.destroy();
    vBuf = device.createBuffer({
      size: Math.max(4, mesh.vertices.byteLength),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    iBuf = device.createBuffer({
      size: Math.max(4, mesh.indices.byteLength),
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    if (mesh.vertices.byteLength) device.queue.writeBuffer(vBuf, 0, mesh.vertices);
    if (mesh.indices.byteLength) device.queue.writeBuffer(iBuf, 0, mesh.indices);
    indexCount = mesh.indices.length;
    dirty = false;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    resize();
    if (!colorMs || !depthMs) return;

    const dt = 1 / 60;
    if (mode === "drive") {
      const accel = (keys["KeyW"] || keys["ArrowUp"] ? 1 : 0) - (keys["KeyS"] || keys["ArrowDown"] ? 1 : 0);
      const steer = (keys["KeyA"] || keys["ArrowLeft"] ? 1 : 0) - (keys["KeyD"] || keys["ArrowRight"] ? 1 : 0);
      if (keys["Space"]) car.v *= 0.92;
      car.v += accel * 28 * dt;
      car.v *= 0.985;
      car.v = Math.max(-18, Math.min(42, car.v));
      car.yaw += steer * 2.2 * dt * Math.sign(car.v || 1) * Math.min(1, Math.abs(car.v) / 8);
      car.x += Math.sin(car.yaw) * car.v * dt;
      car.z += Math.cos(car.yaw) * car.v * dt;
      car.x = Math.max(-6, Math.min(6, car.x));
      car.z = Math.max(-4, Math.min(4, car.z));
      dirty = true;
      onHud({ speed: Math.abs(car.v) * 3.6, status: "Drive · pista esterilla" });
    } else if (mode === "kit") {
      onHud({ speed: 0, status: "Kit · piezas en la mesa" });
    } else {
      onHud({ speed: 0, status: "Studio · arrastra para orbitar" });
    }

    if (dirty) uploadMesh();

    const aspect = canvas.width / Math.max(1, canvas.height);
    const proj = mat4Persp(Math.PI / 4, aspect, 0.1, 80);
    let eye, center;
    if (mode === "drive") {
      const back = 5.5;
      eye = [
        car.x - Math.sin(car.yaw) * back,
        3.2,
        car.z - Math.cos(car.yaw) * back,
      ];
      center = [car.x + Math.sin(car.yaw) * 1.5, 0.4, car.z + Math.cos(car.yaw) * 1.5];
    } else if (mode === "kit") {
      eye = [0, 9, 7];
      center = [0, 0, 0];
    } else {
      eye = [
        Math.sin(yawCam) * Math.cos(pitchCam) * distCam,
        Math.sin(pitchCam) * distCam + 1.2,
        Math.cos(yawCam) * Math.cos(pitchCam) * distCam,
      ];
      center = [0, 0.3, 0];
    }
    const view = mat4LookAt(eye, center, [0, 1, 0]);
    const mvp = mat4Mul(proj, view);
    const uData = new Float32Array(24);
    uData.set(mvp, 0);
    uData[16] = 4; uData[17] = 8; uData[18] = 5;
    uData[19] = mode === "kit" ? 0 : mode === "drive" ? 1 : 2;
    uData[20] = eye[0]; uData[21] = eye[1]; uData[22] = eye[2];
    device.queue.writeBuffer(uniformBuf, 0, uData.buffer, uData.byteOffset, 96);

    const colorTex = context.getCurrentTexture();
    if (colorTex.width !== depthW || colorTex.height !== depthH) {
      ensureTargets(colorTex.width, colorTex.height);
    }
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({
      colorAttachments: [{
        view: colorMs.createView(),
        resolveTarget: colorTex.createView(),
        clearValue: { r: 0.02, g: 0.03, b: 0.05, a: 1 },
        loadOp: "clear",
        storeOp: "discard",
      }],
      depthStencilAttachment: {
        view: depthMs.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vBuf);
    pass.setIndexBuffer(iBuf, "uint32");
    pass.drawIndexed(indexCount);
    pass.end();
    device.queue.submit([enc.finish()]);
  }

  function onKey(e, down) {
    keys[e.code] = down;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  }
  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener("pointerup", () => { dragging = false; });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging || mode !== "studio") return;
    yawCam += (e.clientX - lastX) * 0.008;
    pitchCam = Math.max(0.12, Math.min(1.2, pitchCam + (e.clientY - lastY) * 0.006));
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener("wheel", (e) => {
    if (mode !== "studio") return;
    distCam = Math.max(4, Math.min(18, distCam + e.deltaY * 0.01));
    e.preventDefault();
  }, { passive: false });

  resize();
  uploadMesh();
  raf = requestAnimationFrame(frame);

  return {
    setMode(m) {
      mode = String(m || "drive");
      if (mode === "drive") { car.x = 0; car.z = 0; car.yaw = 0; car.v = 0; }
      dirty = true;
      canvas.focus?.();
    },
    destroy() {
      cancelAnimationFrame(raf);
      vBuf?.destroy(); iBuf?.destroy();
      colorMs?.destroy(); depthMs?.destroy();
      uniformBuf.destroy();
      device.destroy?.();
    },
  };
}

window.FormulaGpu = { create };

for (const root of document.querySelectorAll('[data-r-client="formula-gpu"]:not([data-r-client-mounted])')) {
  root.dataset.rClientMounted = "true";
}
