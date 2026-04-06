# Garam Masala Shader

A responsive, full-screen WebGL fluid shader with an embedded SVG logo.
Zero dependencies, no build step, no server required — just open `shader.html`.

## Quick Start

Open `shader.html` in any browser. That's it. Works from `file://` protocol.

## Project Structure

```text
shader.html            — minimal HTML shell (canvas + script tag)
shader-app.js          — all logic: config, SVG data, WebGL shader, render loop
swap-svg.sh            — helper script to swap the logo automatically
logo.svg               — flat logo SVG (used at runtime via base64 in shader-app.js)
logo-with-stroke.svg   — stroke variant of the logo (alternate version)
```

## Changing Shader Values

Edit the `CONFIG` object at the top of `shader-app.js`:

```js
const CONFIG = {
    size: 1030,          // logo scale (higher = bigger)
    intensity: 1.45,     // color brightness (0–5)
    speed: 1.23,         // animation speed (0–5)
    complexity: 6.1,     // fluid detail (1–30)
    flowStrength: 0.4,   // how much the logo shape warps the fluid (0–1)
    pushDistance: 0.005,  // edge detection spread (0.001–0.5)
    edgeGlow: 1.03,      // rim glow brightness (0–5)
    zoom: 1.0,           // camera zoom (0.1–10)

    // Colors as normalized RGB (0.0–1.0). Use hex/255 pattern:
    colorA: [0x8E / 255, 0x9F / 255, 0xB1 / 255],  // steel blue
    colorB: [0x42 / 255, 0x38 / 255, 0x9D / 255],  // deep indigo
    colorC: [0xBF / 255, 0x0E / 255, 0x4B / 255],  // crimson
};
```

To set a color from hex like `#FF5500`:
```js
colorA: [0xFF / 255, 0x55 / 255, 0x00 / 255]
```

## Replacing the Logo

### Automated (recommended)

Use the included helper script:

```bash
./swap-svg.sh /path/to/your-logo.svg
```

This base64-encodes the SVG and updates `SVG_DATA_URI` in `shader-app.js` automatically.

### Manual

1. Convert your SVG to a base64 data URI:
   ```bash
   cat your-logo.svg | base64 | tr -d '\n'
   ```
2. Replace the value of `SVG_DATA_URI` in `shader-app.js` with:
   ```text
   "data:image/svg+xml;base64,<your-base64-string>"
   ```

The current logo source is `logo.svg` (a stroke variant is in `logo-with-stroke.svg`).

## Embedding in Another Webpage

### Option A: iframe (simplest)
```html
<iframe
  src="surbhi-shader-export/shader.html"
  style="width:100%; height:100vh; border:none;"
></iframe>
```

### Option B: Inline (full control)
Copy the `<canvas>` from `shader.html` and the `<script src>` tag into your page.
The shader fills its parent container — wrap it in a div with your desired dimensions:

```html
<div style="width: 100%; height: 100vh; overflow: hidden;">
  <canvas id="glCanvas"></canvas>
</div>
<script src="shader-app.js"></script>
```

### Option C: React / Next.js
```jsx
import { useEffect, useRef } from 'react';

export default function ShaderBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/shader-app.js';
    ref.current?.appendChild(script);
  }, []);

  return <div ref={ref} style={{ width: '100%', height: '100vh' }} />;
}
```

## Making Values Dynamic (e.g. from a CMS)

Replace the hardcoded `CONFIG` with a function that reads from URL params, an API, or props:

```js
// Read from URL params: ?speed=2.0&complexity=12
const params = new URLSearchParams(window.location.search);
const CONFIG = {
    speed: parseFloat(params.get('speed')) || 1.23,
    complexity: parseFloat(params.get('complexity')) || 6.1,
    // ... rest stays hardcoded
};
```

## Browser Support

Requires WebGL (supported in all modern browsers).
Uses `OES_standard_derivatives` extension for anti-aliased edges.
No WebGL2 requirement — works on older devices and Safari.
