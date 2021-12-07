import playwright from 'playwright';
import { Vector, direction, magnitude, overshoot, path, BoundingBox } from './math';
import installMouseHelper from './mouse-helper';
import { sleep, randomValue } from './utils';

export async function createCursor(
	page,
	overshootSpread = 10,
	overshootRadius = 120,
	debug = true
) {
	if (debug) await installMouseHelper(page);
	await addMousePositionTracker(page);
	const randomStartPoint = await getRandomStartPoint(page);
	return new Cursor(page, randomStartPoint, overshootSpread, overshootRadius);
}

export interface Cursor {
	page: playwright.Page;
	previous: Vector;
	overshootSpread: number;
	overshootRadius: number;
	overshootThreshold: number;

	shouldOvershoot(a: Vector, b: Vector): boolean;
	getElemBoundingBox(selector: string): Promise<BoundingBox>;
	getViewportBoundingBox(): Promise<BoundingBox>;
	getRandomPointOnViewport(paddingPercentage: number): Promise<Vector>;
	getRandomPointInsideElem(
		{ x, y, width, height }: BoundingBox,
		paddingPercentage?: number
	): Vector;
	tracePath(vectors: Iterable<Vector>): Promise<void>;
	performRandomMove(): Promise<void>;
}
export interface Actions {
	click(clickOptions?: clickOptions): Promise<void>;
	move(moveOptions: moveOptions): Promise<void>;
	moveTo(moveToOptions: moveToOptions): Promise<void>;
}

export type clickOptions = {
	waitBeforeClick?: [number, number];
	waitBetweenClick?: [number, number];
	doubleClick?: boolean;
};
export type moveOptions = {
	targetElem: string | BoundingBox;
	paddingPercentage?: number;
	waitForSelector?: number;
	waitBeforeMove?: [number, number];
};
export type moveToOptions = {
	destination: Vector;
	waitBeforeMove?: [number, number];
};

// ---------------------------------------------------------------

export async function getRandomStartPoint(page: playwright.Page) {
	const windowDimension = JSON.parse(
		await page.evaluate(() => {
			const windowDimension = {
				width: window.innerWidth,
				height: window.innerHeight,
			};
			return JSON.stringify(windowDimension);
		})
	);

	const { width, height } = windowDimension;
	const randomStartPoint = {
		x: randomValue(0, width),
		y: randomValue(0, height),
	};
	return randomStartPoint;
}

export async function addMousePositionTracker(page: playwright.Page) {
	page.on('load', async () => {
		/*
		 * add global variable mousePos to page with init mouse position
		 * add event listener for mousemove which update mousePos
		 */
		await page.evaluate(() => {
			(window as any).mousePos = { x: 0, y: 0 };
			document.addEventListener('mousemove', (e) => {
				const { clientX, clientY } = e;
				(window as any).mousePos.x = clientX;
				(window as any).mousePos.y = clientY;
			});
		});
	});
}

export async function getActualPosOfMouse(page: playwright.Page): Promise<Vector> {
	const actualPos = JSON.parse(
		await page.evaluate(() => JSON.stringify(window['mousePos']))
	) as Vector;
	return actualPos;
}
// ----------------------------------------------------------------------------------

export class Cursor {
	page: playwright.Page;
	previous: Vector;
	overshootSpread: number;
	overshootRadius: number;
	overshootThreshold: number;

	constructor(
		page: playwright.Page,
		randomStartPoint: Vector,
		overshootSpread: number,
		overshootRadius: number
	) {
		this.previous = randomStartPoint;
		this.overshootSpread = overshootSpread;
		this.overshootRadius = overshootRadius;
		this.overshootThreshold = 500;
		this.page = page;
	}

	shouldOvershoot(a: Vector, b: Vector): boolean {
		return magnitude(direction(a, b)) > this.overshootThreshold;
	}

	async getElemBoundingBox(selector: string): Promise<BoundingBox> {
		let viewPortBox: BoundingBox;
		let elemBoundingBox = await (await this.page.locator(selector)).boundingBox();
		if (elemBoundingBox === null) throw new Error(`Selector ${selector} is not present in DOM`);

		let { y: elemY, x: elemX, height: elemHeight, width: elemWidth } = elemBoundingBox;

		let totalElemHeight = 10,
			vwHeight = 1;
		let totalElemWidth = 10,
			vwWidth = 1;
		// scroll until elem is visible
		while (totalElemHeight > vwHeight || totalElemWidth > vwWidth || elemY < 0 || elemX < 0) {
			elemBoundingBox = await (await this.page.locator(selector)).boundingBox();
			if (elemBoundingBox === null) throw new Error(`Selector ${selector} is not present in DOM`);

			elemY = elemBoundingBox.y;
			elemHeight = elemBoundingBox.height;

			elemX = elemBoundingBox.x;
			elemWidth = elemBoundingBox.width;

			totalElemHeight = Math.abs(elemY) + elemHeight;
			totalElemWidth = Math.abs(elemX) + elemWidth;

			viewPortBox = await this.getViewportBoundingBox();
			vwHeight = viewPortBox.height;
			vwWidth = viewPortBox.width;

			if (totalElemHeight <= vwHeight && elemY >= 0) break;
			if (elemY > 0) {
				await this.page.mouse.wheel(0, 100);
			} else if (elemY < 0) {
				await this.page.mouse.wheel(0, -100);
			}

			if (totalElemWidth <= vwWidth && elemX >= 0) break;
			if (elemX > 0) {
				await this.page.mouse.wheel(100, 0);
			} else if (elemX < 0) {
				await this.page.mouse.wheel(-100, 0);
			}

			await sleep(randomValue(40, 80));
		}
		// it will only return if elem is visible on the page
		return elemBoundingBox;
	}

	async getViewportBoundingBox(): Promise<BoundingBox> {
		const viewportDimension = JSON.parse(
			await this.page.evaluate(() =>
				JSON.stringify({
					width: window.innerWidth,
					height: window.innerHeight,
				})
			)
		) as { width: number; height: number };
		return {
			x: 0,
			y: 0,
			width: viewportDimension.width,
			height: viewportDimension.height,
		};
	}

	async getRandomPointOnViewport(paddingPercentage = 0): Promise<Vector> {
		const windowBoundaryBox = JSON.parse(
			await this.page.evaluate(() =>
				JSON.stringify({ width: window.innerWidth, height: window.innerHeight })
			)
		);
		const randomPointInsideViewPort = this.getRandomPointInsideElem(
			{
				x: 0,
				y: 0,
				width: windowBoundaryBox.width,
				height: windowBoundaryBox.height,
			},
			paddingPercentage
		);

		return randomPointInsideViewPort;
	}

	getRandomPointInsideElem({ x, y, width, height }: BoundingBox, paddingPercentage = 0): Vector {
		if (paddingPercentage < 0 && paddingPercentage > 100)
			throw new Error('Wrong padding value, choose from scope [0-100]');

		const paddingWidth = (width * paddingPercentage) / 100;
		const paddingHeight = (height * paddingPercentage) / 100;

		return {
			x: x + paddingWidth / 2 + Math.random() * (width - paddingWidth),
			y: y + paddingHeight / 2 + Math.random() * (height - paddingHeight),
		};
	}

	async tracePath(vectors: Iterable<Vector>): Promise<void> {
		for (const v of vectors) {
			try {
				// In case this is called from random mouse movements and the users wants to move the mouse, abort
				await this.page.mouse.move(v.x, v.y);
				this.previous = v;
			} catch (error: any) {
				console.log(error.message);
			}
		}
	}

	// Start random mouse movements. Function recursively calls itself
	async performRandomMove(): Promise<void> {
		while (Math.random() > 0.7) {
      try {
				const rand = await this.getRandomPointOnViewport();
				await this.tracePath(path(this.previous, rand));
				this.previous = rand;
				await sleep(randomValue(20, 80));
			} catch (_) {
				console.log('Warning: stopping random mouse movements');
			}
		}
	}

	actions: Actions = {
		click: async ({
			waitBeforeClick,
			waitBetweenClick,
			doubleClick,
		}: clickOptions): Promise<void> => {
			// default
			waitBeforeClick = waitBeforeClick || [0, 0];
			waitBetweenClick = waitBetweenClick || [20, 50];
			doubleClick = doubleClick || false;

			await sleep(randomValue(...waitBeforeClick));

			await this.page.mouse.down();
			await sleep(randomValue(...waitBetweenClick));
			await this.page.mouse.up();

			doubleClick && this.actions.click({ waitBetweenClick });
		},

		move: async ({
			targetElem,
			paddingPercentage,
			waitForSelector,
			waitBeforeMove,
		}: moveOptions): Promise<void> => {
			// default
			paddingPercentage = paddingPercentage || 0;
			waitForSelector = waitForSelector || 30_000;
			waitBeforeMove = waitBeforeMove || [0, 0];

			await this.performRandomMove();
			await sleep(randomValue(...waitBeforeMove));

			let elemBox: BoundingBox;
			if (typeof targetElem === 'string') {
				try {
					await this.page.waitForSelector(targetElem, { timeout: waitForSelector });
				} catch (error) {
					throw new Error(`Selector ${targetElem} is not present in DOM`);
				}
				elemBox = await this.getElemBoundingBox(targetElem);
			} else {
				elemBox = targetElem;
			}

			const { height, width } = elemBox;
			const destination = this.getRandomPointInsideElem(elemBox, paddingPercentage);
			const boxDimension = { height, width };

			const overshooting = this.shouldOvershoot(this.previous, destination);
			const to = overshooting ? overshoot(destination, this.overshootRadius) : destination;
			await this.tracePath(path(this.previous, to));

			if (overshooting) {
				const correction = path(to, { ...boxDimension, ...destination }, this.overshootSpread);
				await this.tracePath(correction);
			}
			this.previous = destination;
		},

		moveTo: async ({ destination, waitBeforeMove }: moveToOptions): Promise<void> => {
			// default
			waitBeforeMove = waitBeforeMove || [0, 0];

			await this.performRandomMove();
			await sleep(randomValue(...waitBeforeMove));

			await this.tracePath(path(this.previous, destination));
		},
	};
}
