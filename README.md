# ghost-cursor-playwright

Modification of actual ghost-cursor for puppeteer, with more functionality and rewrite to work well with playwright.
Note! target elements rendered in the DOM will be scrolled vertically and horizontally to be visible in viewport

### Download

```shell
git clone https://github.com/reaz1995/ghost-cursor-playwright.git cursor
cd cursor
npm install
```

example of usage in src/example.ts
to run example use

```shell
npm run example
```

for wsl2 don't forget to set up display

### Download as package

```shell
npm i ghost-cursor-playwright
```

```typescript
import { createCursor } from 'ghost-cursor-playwright';
or;
const createCursor = require('ghost-cursor-playwright');
```

### How to use

Create amd attach cursor to page

```typescript
const cursor = await createCursor(page);
```

manipulate the cursor via:

```typescript
//move actions before execute will keep performing random move (30% chance).
cursor.actions.move(target: string | BoundingBox | Vector, moveOptions?: moveOptions): Promise<void>;

type moveOptions = {
	paddingPercentage?: number;
	waitForSelector?: number;
	waitBeforeMove?: [number, number];
};


cursor.actions.click(clickOptions?: clickOptions, moveOptions?: moveOptions): Promise<void>;

type clickOptions = {
	target?: string | BoundingBox | Vector;
	waitBeforeClick?: [number, number];
	waitBetweenClick?: [number, number];
	doubleClick?: boolean;
};
// if target is given then cursor will use move function before click
// if target is JS path string, then function will check if for sure is on correct target (sometimes rendered objects are covered in viewport by menu bar or dialogs etc.), if false will proceed fallback to native click


```

util functions
```typescript
// actual position of cursor is mounted on window.mousePos, its value can be retrieve by
  cursor.getActualPosOfMouse(): Promise<Vector>;

// actual target of cursor is mounted on window.mouseTarget, to compare target under cursor with given JS PATH selector use:
  cursor.compareTargetOfMouse(selector: string): Promise<boolean>
```
