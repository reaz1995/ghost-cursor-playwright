# ghost-cursor-playwright

Modification of actual ghost-cursor for puppeteer, with more functionality and rewrited to work well with playwight.

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

### How to use

Create amd attach cursor to page

```
const cursor = await createCursor(page);
```

manipulate the cursor via:

```
await cursor.actions.move(target);
await cursor.actions.moveTo(destination);
await cursor.actions.click();
```

utility function to get actual mouse position on given page

```
await getActualPosOfMouse(page);
//will return Promise<Vector>;
```
