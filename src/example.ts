import { chromium } from 'playwright';
import { createCursor } from './cursor';

(async () => {
	try {
		const browser = await chromium.launch({
			channel: 'chrome',
			headless: false,
		});
		const browserContext = await browser.newContext({
			viewport: null,
		});

		const page = await browserContext.newPage();
		const cursor = await createCursor(page);
		await page.goto('https://www.google.com');

		await page.waitForTimeout(5000);
		await cursor.actions.moveTo({ destination: { x: 50, y: 10 } });
		await cursor.actions.moveTo({ destination: { x: 700, y: 700 }, waitBeforeMove: [500, 1_500] });
		await cursor.actions.moveTo({ destination: { x: 50, y: 10 } });
		await cursor.actions.move({ targetElem: '#L2AGLb > div', paddingPercentage: 30 });
		await cursor.actions.moveTo({ destination: { x: 50, y: 10 } });
		await cursor.actions.move({
			targetElem: '#L2AGLb > div',
			paddingPercentage: 50,
			waitBeforeMove: [1_000, 2_000],
			waitForSelector: 30_000,
		});
		await cursor.actions.click({ waitBetweenClick: [20, 50] });
		await cursor.actions.move({
			targetElem:
				'body > div.L3eUgb > div.o3j99.ikrT4e.om7nvf > form > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input',
		});
		await cursor.actions.click({ waitBeforeClick: [500, 1_000], waitBetweenClick: [20, 50] });
		await cursor.actions.moveTo({ destination: { x: 50, y: 10 } });
		await cursor.actions.move({
			targetElem:
				'body > div.L3eUgb > div.o3j99.ikrT4e.om7nvf > form > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input',
			paddingPercentage: 70,
			waitBeforeMove: [500, 2_500],
		});
		await cursor.actions.click({ waitBetweenClick: [20, 50], doubleClick: true });
	} catch (error: any) {
		console.log(error.message);
	}
})();
