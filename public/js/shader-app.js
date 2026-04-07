// ============================================
// HARDCODED CONFIG — edit these values
// ============================================
const CONFIG = {
    size: 1200,
    intensity: 1.4,
    speed: 1.23,
    complexity: 5,
    flowStrength: 0.2,
    pushDistance: 0.0045,
    edgeGlow: 1.0,
    zoom: 1.0,

    colorA: [0xDC / 255, 0x26 / 255, 0x26 / 255],  // #DC2626 red
    colorB: [0xB9 / 255, 0x1C / 255, 0x1C / 255],  // #b91c1c red dark
    colorC: [0xFF / 255, 0xD6 / 255, 0x00 / 255],  // #FFD600 electric yellow
};

// ============================================
// WebGL Setup
// ============================================
const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    canvas.style.display = 'none';
    throw new Error('WebGL not supported');
}

gl.getExtension('OES_standard_derivatives');

// ============================================
// Offscreen Canvas for SVG texture
// ============================================
const textCanvas = document.createElement('canvas');
const tctx = textCanvas.getContext('2d');
textCanvas.width = 2048;
textCanvas.height = 2048;

let svgImage = null;
let maskDirty = false;

const img = new Image();
img.onload = () => {
    svgImage = img;
    updateTextCanvas();
    uploadMaskTexture();
};
img.src = '/images/logo.svg';

function updateTextCanvas() {
    const size = CONFIG.size;
    const cx = textCanvas.width / 2;
    const cy = textCanvas.height / 2;

    tctx.clearRect(0, 0, textCanvas.width, textCanvas.height);
    tctx.fillStyle = 'black';
    tctx.fillRect(0, 0, textCanvas.width, textCanvas.height);

    if (!svgImage) return;

    const drawSvg = (color, shadowBlur) => {
        tctx.shadowBlur = shadowBlur;
        tctx.shadowColor = color;
        const s = size / 200;
        tctx.drawImage(
            svgImage,
            cx - (svgImage.width * s) / 2,
            cy - (svgImage.height * s) / 2,
            svgImage.width * s,
            svgImage.height * s
        );
    };

    // Red channel: blurred physics map
    drawSvg('red', 60);
    // Green channel: crisp visual mask
    drawSvg('lime', 0);

    maskDirty = true;
}

function uploadMaskTexture() {
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    maskDirty = false;
}

// ============================================
// Shaders — UNTOUCHED
// ============================================
const vsSource = `
    attribute vec4 aVertexPosition;
    void main() { gl_Position = aVertexPosition; }
`;

const fsSource = `
    #extension GL_OES_standard_derivatives : enable
    precision highp float;

    uniform float uTime, uSpeed, uIntensity, uComplexity, uFlowStrength, uPushDistance, uEdgeGlow, uZoom;
    uniform vec2 uResolution;
    uniform vec3 uColorA, uColorB, uColorC, uTextColor;
    uniform sampler2D uTextTexture;

    float rand(vec2 co){ return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453); }

    void main() {
        vec2 uv = gl_FragCoord.xy / uResolution.xy;

        // Correct textUv for aspect ratio to prevent stretching
        vec2 textUv = uv;
        float aspect = uResolution.x / uResolution.y;
        if (aspect > 1.0) {
            textUv.x = (textUv.x - 0.5) * aspect + 0.5;
        } else {
            textUv.y = (textUv.y - 0.5) / aspect + 0.5;
        }

        // Apply Zoom to the text texture coordinates
        textUv = (textUv - 0.5) / uZoom + 0.5;
        textUv.y = 1.0 - textUv.y; // Flip for texture

        vec2 centeredUv = (uv * 2.0 - 1.0);
        centeredUv.x *= aspect;
        centeredUv /= uZoom;

        float t = uTime * uSpeed;

        // 1. Better Gradient Sampling for Flow
        float d = max(uPushDistance, 0.001);
        float mR = texture2D(uTextTexture, textUv + vec2(d, 0.0)).r;
        float mL = texture2D(uTextTexture, textUv - vec2(d, 0.0)).r;
        float mU = texture2D(uTextTexture, textUv + vec2(0.0, d)).r;
        float mD = texture2D(uTextTexture, textUv - vec2(0.0, d)).r;
        vec2 flowGrad = vec2(mR - mL, mU - mD);
        float flowGradLen = length(flowGrad);
        if(flowGradLen > 0.001) flowGrad /= flowGradLen;

        // 2. Warped Domain
        vec2 p = centeredUv + (rand(uv + t) - 0.5) * 0.001;
        for(float i = 1.0; i < 8.0; i++) {
            p.x += 0.3/i * sin(i*3.0*p.y + t) + flowGrad.x * flowGradLen * uFlowStrength;
            p.y += 0.3/i * cos(i*3.0*p.x + t) - flowGrad.y * flowGradLen * uFlowStrength;
        }

        // 3. Fluid Color
        float w1 = sin(p.x * uComplexity + t) * 0.5 + 0.5;
        float w2 = sin(p.y * uComplexity + t * 0.8) * 0.5 + 0.5;
        float w3 = sin((p.x + p.y) * uComplexity + t * 1.2) * 0.5 + 0.5;
        vec3 fluid = (uColorA*w1 + uColorB*w2 + uColorC*w3) / (w1+w2+w3+0.1) * max(uIntensity, 0.01);
        fluid = mix(fluid, vec3(1.0), 0.3); // lift dark areas toward white

        // 4. ANALYTICAL ANTI-ALIASING (The Elegant Solution)
        vec4 texData = texture2D(uTextTexture, textUv);
        float blurredMask = texData.r;
        float crispMask = texData.g;

        // Calculate screen-space gradient of the mask to find the 'pixel-width' of the edge
        // This makes the edge perfectly smooth regardless of how much the domain is warped
        vec2 vGrad = vec2(dFdx(crispMask), dFdy(crispMask));
        float vGradLen = max(length(vGrad), 0.0001);

        // Analytical AA formula: distance / gradient_length
        // We center the edge at 0.5 (since lime green is 1.0 and background is 0.0)
        float dist = crispMask - 0.5;
        float aa_mask = clamp(0.5 + dist / vGradLen, 0.0, 1.0);

        vec3 finalColor = mix(fluid, uTextColor, aa_mask);

        // 5. Smooth Rim
        float rim = smoothstep(0.2, 0.5, blurredMask) * (1.0 - aa_mask);
        finalColor += rim * uColorB * uEdgeGlow;

        // Global Dither
        finalColor += (rand(uv) - 0.5) * 0.01;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// ============================================
// WebGL Program & Buffers
// ============================================
function createShader(gl, type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
    }
    return s;
}

const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
const program = gl.createProgram();
if (vs && fs) {
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        canvas.style.display = 'none';
        throw new Error('WebGL program linking failed');
    }
}

const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);

const posAttrib = gl.getAttribLocation(program, 'aVertexPosition');
const uniforms = {
    uTime: gl.getUniformLocation(program, 'uTime'),
    uRes: gl.getUniformLocation(program, 'uResolution'),
    uSpeed: gl.getUniformLocation(program, 'uSpeed'),
    uInt: gl.getUniformLocation(program, 'uIntensity'),
    uComp: gl.getUniformLocation(program, 'uComplexity'),
    uFlow: gl.getUniformLocation(program, 'uFlowStrength'),
    uPush: gl.getUniformLocation(program, 'uPushDistance'),
    uEdge: gl.getUniformLocation(program, 'uEdgeGlow'),
    uZoom: gl.getUniformLocation(program, 'uZoom'),
    uColA: gl.getUniformLocation(program, 'uColorA'),
    uColB: gl.getUniformLocation(program, 'uColorB'),
    uColC: gl.getUniformLocation(program, 'uColorC'),
    uTextCol: gl.getUniformLocation(program, 'uTextColor'),
    uTextTex: gl.getUniformLocation(program, 'uTextTexture'),
};

const textTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

// ============================================
// Responsive Resize
// ============================================
function resize() {
    const hero = canvas.parentElement;
    const w = hero ? hero.clientWidth : window.innerWidth;
    const h = hero ? hero.clientHeight : window.innerHeight;
    const dpr = window.innerWidth < 768 ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();
if (canvas.parentElement && typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(canvas.parentElement);
}

// ============================================
// Render Loop
// ============================================
function drawFrame(time) {
    if (maskDirty) uploadMaskTexture();

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.uniform1i(uniforms.uTextTex, 0);

    gl.enableVertexAttribArray(posAttrib);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(posAttrib, 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(uniforms.uTime, time);
    gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uSpeed, CONFIG.speed);
    gl.uniform1f(uniforms.uInt, CONFIG.intensity);
    gl.uniform1f(uniforms.uComp, CONFIG.complexity);
    gl.uniform1f(uniforms.uFlow, CONFIG.flowStrength);
    gl.uniform1f(uniforms.uPush, CONFIG.pushDistance);
    gl.uniform1f(uniforms.uEdge, CONFIG.edgeGlow);
    gl.uniform1f(uniforms.uZoom, CONFIG.zoom);

    gl.uniform3f(uniforms.uColA, CONFIG.colorA[0], CONFIG.colorA[1], CONFIG.colorA[2]);
    gl.uniform3f(uniforms.uColB, CONFIG.colorB[0], CONFIG.colorB[1], CONFIG.colorB[2]);
    gl.uniform3f(uniforms.uColC, CONFIG.colorC[0], CONFIG.colorC[1], CONFIG.colorC[2]);
    gl.uniform3f(uniforms.uTextCol, 1, 1, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function render(time) {
    time *= 0.001;
    drawFrame(time);
    if (!prefersReducedMotion) requestAnimationFrame(render);
}

requestAnimationFrame(render);
