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
	start: Vector;
	previous: Vector;
	actualPos: Vector;
	moving: boolean;
	performRandomMoves: boolean;
	overshootSpread: number;
	overshootRadius: number;
	overshootThreshold: number;

	toggleRandomMove(random: boolean): void;
	shouldOvershoot(a: Vector, b: Vector): boolean;
	getElemBoundingBox(selector: string): Promise<BoundingBox>;
	getViewportBoundingBox(): Promise<BoundingBox>;
	getRandomPointOnViewport(paddingPercentage: number): Promise<Vector>;
	getRandomPointInsideElem(
		{ x, y, width, height }: BoundingBox,
		paddingPercentage?: number
	): Vector;
	tracePath(vectors: Iterable<Vector>, abortOnMove: boolean): Promise<void>;
	randomMove(): Promise<void>;
}
export interface Actions {
	click(
		{ delayMin, delayMax }: { delayMin: number; delayMax: number },
		doubleClick?: boolean
	): Promise<void>;
	move(targetElem: string | BoundingBox): Promise<void>;
	moveTo(destination: Vector): Promise<void>;
}

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
	start: Vector;
	previous: Vector;
	actualPos: Vector;
	moving = false;
	performRandomMoves = false;
	overshootSpread: number;
	overshootRadius: number;
	overshootThreshold: number;

	constructor(
		page: playwright.Page,
		randomStartPoint: Vector,
		overshootSpread: number,
		overshootRadius: number
	) {
		this.start = randomStartPoint;
		this.actualPos = randomStartPoint;
		this.previous = randomStartPoint;
		this.overshootSpread = overshootSpread;
		this.overshootRadius = overshootRadius;
		this.overshootThreshold = 500;
		this.page = page;
	}

	toggleRandomMove(random: boolean): void {
		this.moving = !random;
	}

	shouldOvershoot(a: Vector, b: Vector): boolean {
		return magnitude(direction(a, b)) > this.overshootThreshold;
	}

	async getElemBoundingBox(selector: string): Promise<BoundingBox> {
		let viewPortBox: BoundingBox;
		let elemBoundingBox = await (await this.page.locator(selector)).boundingBox();
		if (elemBoundingBox === null) throw new Error('Couldnt get Element Box');

		let { y: elemY, x: elemX, height: elemHeight, width: elemWidth } = elemBoundingBox;

		let totalElemHeight = 10,
			vwHeight = 1;
		let totalElemWidth = 10,
			vwWidth = 1;
		// scroll until elem is visible
		while (totalElemHeight > vwHeight || totalElemWidth > vwWidth || elemY < 0 || elemX < 0) {
			elemBoundingBox = await (await this.page.locator(selector)).boundingBox();
			if (elemBoundingBox === null) throw new Error('Couldnt get Element Box');

			elemY = elemBoundingBox.y;
			elemHeight = elemBoundingBox.height;

			elemX = elemBoundingBox.x;
			elemWidth = elemBoundingBox.width;

			totalElemHeight = Math.abs(elemY) + elemHeight;
			totalElemWidth = Math.abs(elemX) + elemWidth;

			viewPortBox = await this.getViewportBoundingBox();
			vwHeight = viewPortBox.height;
			vwWidth = viewPortBox.width;

			if (totalElemHeight <= vwHeight && totalElemWidth <= vwWidth && elemY > 0 && elemX > 0) break;
			if (elemY > 0) {
				await this.page.mouse.wheel(0, 200);
			} else if (elemY < 0) {
				await this.page.mouse.wheel(0, -200);
			}
			if (elemX > 0) {
				await this.page.mouse.wheel(200, 0);
			} else if (elemX < 0) {
				await this.page.mouse.wheel(-200, 0);
			}

			await sleep(randomValue(80, 150));
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

	getRandomPointInsideElem(
		{ x, y, width, height }: BoundingBox,
		paddingPercentage?: number
	): Vector {
		let paddingWidth = 0;
		let paddingHeight = 0;

		if (paddingPercentage !== undefined) {
			if (paddingPercentage > 0 && paddingPercentage < 100) {
				paddingWidth = (width * paddingPercentage) / 100;
				paddingHeight = (height * paddingPercentage) / 100;
			}
		}

		return {
			x: x + paddingWidth / 2 + Math.random() * (width - paddingWidth),
			y: y + paddingHeight / 2 + Math.random() * (height - paddingHeight),
		};
	}

	async tracePath(vectors: Iterable<Vector>, abortOnMove = false): Promise<void> {
		for (const v of vectors) {
			try {
				// In case this is called from random mouse movements and the users wants to move the mouse, abort
				if (abortOnMove && this.moving) {
					return;
				}
				await this.page.mouse.move(v.x, v.y);
				this.previous = v;
			} catch (error) {
				console.debug('Warning: could not move mouse, error message:', error);
			}
		}
	}

	// Start random mouse movements. Function recursively calls itself
	async randomMove(): Promise<void> {
		try {
			if (!this.moving) {
				const rand = await this.getRandomPointOnViewport();
				await this.tracePath(path(this.previous, rand), true);
				this.previous = rand;
			}
			await sleep(Math.random() * 2000); // 2s by default
			this.randomMove().then(
				(_) => {
					('');
				},
				(_) => {
					('');
				}
			); // fire and forget, recursive function
		} catch (_) {
			console.debug('Warning: stopping random mouse movements');
		}
	}

	actions: Actions = {
		click: async ({ delayMin = 20, delayMax = 50 }, doubleClick?: boolean): Promise<void> => {
			if (delayMin > delayMax || delayMax < 0 || delayMin < 0) throw new Error('wrong max delay');

			const delayTime = randomValue(delayMin, delayMax);
			if (this.performRandomMoves) this.randomMove();
			this.toggleRandomMove(false);
			await this.page.mouse.down();
			await sleep(delayTime);
			await this.page.mouse.up();

			if (doubleClick !== undefined && doubleClick === true)
				this.actions.click({ delayMin, delayMax });

			this.toggleRandomMove(true);
		},

		move: async (targetElem: string | BoundingBox): Promise<void> => {
			if (this.performRandomMoves) await this.randomMove();
			this.toggleRandomMove(false);
			let elemBox: BoundingBox;
			// picking object by selector
			if (typeof targetElem === 'string') {
				const elem = await this.page.$(targetElem);
				if (elem === null) throw new Error(`Could not find element with selector "${targetElem}"`);
				elemBox = await this.getElemBoundingBox(targetElem);
			} else {
				elemBox = targetElem;
			}

			const { height, width } = elemBox;
			const destination = this.getRandomPointInsideElem(elemBox);
			const boxDimension = { height, width };

			const overshooting = this.shouldOvershoot(this.previous, destination);
			const to = overshooting ? overshoot(destination, this.overshootRadius) : destination;
			await this.tracePath(path(this.previous, to));

			if (overshooting) {
				const correction = path(to, { ...boxDimension, ...destination }, this.overshootSpread);
				await this.tracePath(correction);
			}
			this.previous = destination;

			this.toggleRandomMove(true);
		},

		moveTo: async (destination: Vector): Promise<void> => {
			if (this.performRandomMoves) await this.randomMove();

			this.toggleRandomMove(false);
			await this.tracePath(path(await this.previous, destination));
			this.toggleRandomMove(true);
		},
	};
}
