# ghost-cursor-playwright

[![npm version](https://img.shields.io/npm/v/ghost-cursor-playwright)](https://www.npmjs.com/package/ghost-cursor-playwright)
[![npm downloads](https://img.shields.io/npm/dw/ghost-cursor-playwright)](https://www.npmjs.com/package/ghost-cursor-playwright)
[![types](https://img.shields.io/npm/types/ghost-cursor-playwright)](https://www.npmjs.com/package/ghost-cursor-playwright)
[![node](https://img.shields.io/node/v/ghost-cursor-playwright)](https://nodejs.org)
[![license](https://img.shields.io/github/license/reaz1995/ghost-cursor-playwright)](LICENSE)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/reaz1995)

Human-like mouse movements for [Playwright](https://playwright.dev). Instead of jumping straight to an element, the cursor moves along curved paths, overshoots long distances and corrects itself, and clicks at a random point inside the element.

Based on [ghost-cursor](https://github.com/Xetera/ghost-cursor) for Puppeteer, rewritten for Playwright with extra features.


## Features

- Curved mouse paths based on Bézier curves, with random variation on every move
- Overshoot and correction when moving long distances
- Random click point inside the target, with optional padding from the edges
- Automatic scrolling (vertical and horizontal) until the target element is visible
- Move to a CSS selector, a bounding box, or exact coordinates
- Single and double clicks with random delays
- Checks that the cursor is really over the target before clicking, and falls back to a normal Playwright click if something covers it (for example a menu bar or dialog)
- Optional debug overlay that shows the cursor position on the page
- Written in TypeScript, types included

## Installation

```shell
npm i ghost-cursor-playwright
```

Requires Node.js 20 or newer.

## Quick start

```typescript
import { chromium } from 'playwright-core';
import { createCursor } from 'ghost-cursor-playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Create the cursor BEFORE navigating (see the note below)
  const cursor = await createCursor(page);
  await page.goto('https://example.com');

  await cursor.actions.move('h1');
  await cursor.actions.click({ target: 'a' });

  await browser.close();
})();
```

CommonJS works too:

```javascript
const { createCursor } = require('ghost-cursor-playwright');
```

> **Important:** call `createCursor(page)` before `page.goto()`. The cursor sets up its position and target tracking when a page loads. If you create it after the page has already loaded, `click` with a selector target and `getActualPosOfMouse()` will fail until the next page load.

## API

### `createCursor(page, options?)`

Creates a cursor attached to a Playwright page.

```typescript
const cursor = await createCursor(page, {
  overshootSpread: 10,  // how much the correction path after an overshoot can vary
  overshootRadius: 120, // how far (in px) the cursor can overshoot the target
  debug: true,          // show the debug overlay that follows the cursor
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `overshootSpread` | `number` | `10` | Spread of the correction path after an overshoot |
| `overshootRadius` | `number` | `120` | Maximum overshoot distance in pixels |
| `debug` | `boolean` | `true` | Shows a small circle on the page that follows the mouse. Set to `false` in production. |

Overshoot only happens when the cursor moves more than 500 px.

### `cursor.actions.move(target, moveOptions?)`

Moves the cursor to a target along a human-like path.

`target` can be:

- a **CSS selector** (`string`): waits for the element, scrolls it into view, and moves to a random point inside it
- a **bounding box** (`{ x, y, width, height }`): moves to a random point inside the box
- a **point** (`{ x, y }`): moves to exactly this position

```typescript
await cursor.actions.move('#submit', { paddingPercentage: 30 });
await cursor.actions.move({ x: 500, y: 300 }, { waitBeforeMove: [500, 1500] });
```

| Option | Type | Default | Description |
|---|---|---|---|
| `paddingPercentage` | `number` | `0` | Keeps the target point away from the element edges. `30` means the point is chosen from the central 70% of the element. Range `0` to `100`. |
| `waitForSelector` | `number` | `30000` | How long to wait (in ms) for a selector to appear |
| `waitBeforeMove` | `[min, max]` | `[0, 0]` | Random delay (in ms) before the move starts |

### `cursor.actions.click(clickOptions?, moveOptions?)`

Clicks at the current position, or moves to a target first and then clicks.

```typescript
// Move to the element and click
await cursor.actions.click({ target: '#submit' });

// Double click with custom delays
await cursor.actions.click(
  { target: 'input[name="q"]', doubleClick: true, waitBeforeClick: [300, 800] },
  { paddingPercentage: 50 }
);

// Click at the current cursor position
await cursor.actions.click();
```

| Option | Type | Default | Description |
|---|---|---|---|
| `target` | `string \| BoundingBox \| Vector` | none | Where to move before clicking. Without a target, clicks at the current position. |
| `waitBeforeClick` | `[min, max]` | `[0, 0]` | Random delay (in ms) between the move and the click |
| `waitBetweenClick` | `[min, max]` | `[20, 50]` | Random delay (in ms) between mouse down and mouse up |
| `doubleClick` | `boolean` | `false` | Performs a double click |

The second argument accepts the same `moveOptions` as `move`.

When `target` is a CSS selector, the cursor checks that the element under the mouse is really the target. If another element covers it, the click falls back to Playwright's native `page.click()`.

### `cursor.actions.randomMove(value)`

Moves the cursor to random points on the viewport, like an idle user.

```typescript
await cursor.actions.randomMove(0.7);
```

### Helper methods

```typescript
// Current mouse position on the page
const position = await cursor.getActualPosOfMouse(); // { x, y }

// Check if the element under the mouse matches a selector
const isOnTarget = await cursor.compareTargetOfMouse('#submit'); // boolean

// Bounding box of an element (scrolls until it is visible)
const box = await cursor.getElemBoundingBox('#submit'); // { x, y, width, height }

// Random point inside a bounding box, with optional padding
const point = cursor.getRandomPointInsideElem(box, 20); // { x, y }

// Random point inside the viewport, with optional padding
const viewportPoint = await cursor.getRandomPointOnViewport(10); // { x, y }
```

## Running the example

The repository includes a full example in [`src/example.ts`](src/example.ts).

```shell
git clone https://github.com/reaz1995/ghost-cursor-playwright.git
cd ghost-cursor-playwright
npm install
npm run example
```

The example launches Chrome with a visible window. On WSL2, make sure a display is set up (for example WSLg or an X server).

## Notes

- **Detection:** this library makes mouse movement look natural. It does not change the browser fingerprint or other signals that bot detection systems check, and in debug mode it adds a visible element to the page.
- **Page globals:** the cursor stores its position and target in `window.mousePos` and `window.mouseTarget` on the page.

## Used by

- [suno-api](https://github.com/gcui-art/suno-api)
- [BotBrowser](https://github.com/botswin/BotBrowser)

## Support

If this library saves you time, you can [buy me a coffee](https://buymeacoffee.com/reaz1995) ☕

## License

[MIT](LICENSE)
