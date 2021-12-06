# ghost-cursor-playwright

Modification of actual ghost-cursor for puppeteer, with more functionality and rewrite to work well with playwright.
Note! target elements rendered in the DOM will be scrolled vertically and horizontally to be visible in viewport

### Download

```
git clone https://github.com/reaz1995/ghost-cursor-playwright.git cursor
cd cursor
npm install
```

example of usage in src/example.ts
to run example use

```
npm run example
```

for wsl2 don't forget to set up displayer

### Download as package
```
npm i ghost-cursor-playwright
import { createCursor } from 'ghost-cursor-playwright';
or
const createCursor = require('ghost-cursor-playwright');
```

### How to use

Create amd attach cursor to page

```
const cursor = await createCursor(page);
```

manipulate the cursor via:

```
await cursor.actions.move(target: string | BoundingBox,paddingPercentage?: number);
await cursor.actions.moveTo(destination:Vector);
await cursor.actions.click({delay?:[number,number],doubleClick?:boolean});
```

utility function to get actual mouse position on given page

```
await getActualPosOfMouse(page);
//will return Promise<Vector>;
```
