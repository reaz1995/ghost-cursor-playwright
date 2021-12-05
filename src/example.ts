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
		await cursor.actions.moveTo({ x: 50, y: 10 });
		await cursor.actions.moveTo({ x: 700, y: 700 });
		await cursor.actions.moveTo({ x: 50, y: 10 });
		await cursor.actions.move('#L2AGLb > div');
		await cursor.actions.moveTo({ x: 50, y: 10 });
		await cursor.actions.move('#L2AGLb > div');
		await cursor.actions.click({ delay: [20, 50] });
		await cursor.actions.move(
			'body > div.L3eUgb > div.o3j99.ikrT4e.om7nvf > form > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input'
		);
		await cursor.actions.click({ delay: [20, 50] });
	} catch (error: any) {
		console.log(error.message);
	}
})();
