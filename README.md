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

for wsl2 don't forget to set up displayer

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

move actions before execute will keep performing random move (30% chance).

manipulate the cursor via:

```typescript
cursor.actions.move(moveOptions: moveOptions): Promise<void>;
type moveOptions = {
	targetElem: string | BoundingBox;
	paddingPercentage?: number;
	waitForSelector?: number;
	waitBeforeMove?: [number, number];
};

cursor.actions.moveTo(moveToOptions: moveToOptions): Promise<void>;
type moveToOptions = {
	destination: Vector;
	waitBeforeMove?: [number, number];
};

cursor.actions.click(clickOptions?: clickOptions): Promise<void>;
type clickOptions = {
	waitBeforeClick?: [number, number];
	waitBetweenClick?: [number, number];
	doubleClick?: boolean;
};

```

utility function to get actual mouse position on given page

```typescript
await getActualPosOfMouse(page:playwright.Page);;
// will work only after mounting cursor;
```
