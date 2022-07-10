import playwright from 'playwright-core';
import { Vector, direction, magnitude, overshoot, path, BoundingBox } from './math';
import installMouseHelper from './mouse-helper';
import { sleep, randomValue } from './utils';

export type createCursorOptions = {
	overshootSpread?: number;
	overshootRadius?: number;
	debug?: boolean;
};

export async function createCursor(
	page: playwright.Page,
	createCursorOptions?: createCursorOptions
) {
	// defaults
	let overshootSpread = 10,
		overshootRadius = 120,
		debug = true;

	if (createCursorOptions !== undefined) {
		overshootSpread = createCursorOptions.overshootSpread || 10;
		overshootRadius = createCursorOptions.overshootRadius || 120;
		debug = createCursorOptions.debug || true;
	}

	if (debug) installMouseHelper(page);
	const randomStartPoint = await getRandomStartPoint(page);
	const cursor = new Cursor(page, randomStartPoint, overshootSpread, overshootRadius);
	cursor.addMousePositionTracker();
	cursor.addMouseTargetTracker();

	return cursor;
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

	addMousePositionTracker(): void;
	addMouseTargetTracker(): void;
	getActualPosOfMouse(): Promise<Vector>;
	compareTargetOfMouse(selector: string): Promise<boolean>;
}
export interface Actions {
	click(clickOptions?: clickOptions, moveOptions?: moveOptions): Promise<void>;
	move(target: string | BoundingBox | Vector, moveOptions?: moveOptions): Promise<void>;
}

export type clickOptions = {
	target?: string | BoundingBox | Vector;
	waitBeforeClick?: [number, number];
	waitBetweenClick?: [number, number];
	doubleClick?: boolean;
};

export type moveOptions = {
	paddingPercentage?: number;
	waitForSelector?: number;
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

	addMousePositionTracker(): void {
		this.page.on('load', () => {
			/*
			 * add global variable mousePos to page with init mouse position
			 * add event listener for mousemove which update mousePos
			 */
			this.page.evaluate(() => {
				(window as any).mousePos = { x: 0, y: 0 };
				document.addEventListener('mousemove', (e) => {
					const { clientX, clientY } = e;
					(window as any).mousePos.x = clientX;
					(window as any).mousePos.y = clientY;
				});
			}).catch(() => {});
		});
  }

	addMouseTargetTracker(): void {
		this.page.on('load', () => {
			/*
			 * add global variable mouseTarget to page
			 * add event listener for mousemove which update mouseTarget
			 */
			this.page.evaluate(() => {
				(window as any).mouseTarget = '';
				document.addEventListener('mousemove', (e) => {
					(window as any).mouseTarget = e.target;
				});
			}).catch(() => {});
		});
	}

	async getActualPosOfMouse(): Promise<Vector> {
		const actualPos = JSON.parse(
			await this.page.evaluate(() => JSON.stringify(window['mousePos']))
		) as Vector;
		return actualPos;
  }
  
	async compareTargetOfMouse(selector: string): Promise<boolean> {
		const isEqual = await this.page.evaluate((selector: string) => {
			const actualTarget = window['mouseTarget'] as HTMLElement;
			const selectedTarget = document.querySelector(selector);
			const isEqual = actualTarget.isEqualNode(selectedTarget);
			return isEqual;
		}, selector);
		return isEqual;
	}

	actions: Actions = {
		click: async (clickOptions: clickOptions, moveOptions: moveOptions): Promise<void> => {
			// defaults
			let waitBeforeClick: [number, number] = [0, 0],
				waitBetweenClick: [number, number] = [20, 50],
				doubleClick = false,
				target = undefined;

			if (clickOptions !== undefined) {
				waitBeforeClick = clickOptions.waitBeforeClick || [0, 0];
				waitBetweenClick = clickOptions.waitBetweenClick || [20, 50];
				doubleClick = clickOptions.doubleClick || false;
				target = clickOptions.target || undefined;
			}

			// utils
			const justClick = async (
				waitBetweenClick = [20, 50] as [number, number],
				doubleClick = false
			): Promise<void> => {
				await this.page.mouse.down();
				await sleep(randomValue(...waitBetweenClick));
				await this.page.mouse.up();
				doubleClick && (await justClick());
			};

			// move before click if target is given
			target && (await this.actions.move(target, { ...moveOptions }));
			let correctTarget =
				typeof target === 'string' ? await this.compareTargetOfMouse(target) : false;

			await sleep(randomValue(...waitBeforeClick));

			/*
      check if cursor is on correct target (support only for JS PATH)
        if its on wrong target then proceed fallback (native playwright click),
        in every other cases dispatch events mousedown and mouseup
      */

			if (typeof target !== 'string' || correctTarget) {
				await justClick(waitBetweenClick, doubleClick);
			} else {
				doubleClick
					? await this.page.click(target, {
							clickCount: 2,
							delay: randomValue(...waitBetweenClick),
					  })
					: await this.page.click(target, { delay: randomValue(...waitBetweenClick) });
			}
		},

		move: async (target, moveOptions: moveOptions): Promise<void> => {
			// defaults
			let paddingPercentage = 0,
				waitForSelector = 30_000,
				waitBeforeMove: [number, number] = [0, 0];

			if (moveOptions !== undefined) {
				paddingPercentage = moveOptions.paddingPercentage || 0;
				waitForSelector = moveOptions.waitForSelector || 30_000;
				waitBeforeMove = moveOptions.waitBeforeMove || [0, 0];
			}

			await this.performRandomMove();
			await sleep(randomValue(...waitBeforeMove));

			if (instanceOfVector(target)) {
				const destination = target as Vector;
				await this.tracePath(path(this.previous, destination));
				this.previous = destination;
			} else {
				let elemBox: BoundingBox;
				if (typeof target === 'string') {
					try {
						await this.page.waitForSelector(target, { timeout: waitForSelector });
					} catch (error) {
						throw new Error(`Selector ${target} is not present in DOM`);
					}
					elemBox = await this.getElemBoundingBox(target);
				} else {
					elemBox = target as BoundingBox;
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
			}
		},
	};
}

function instanceOfVector(object: any): boolean {
	if (typeof object === 'string') return false;
	return 'x' in object && 'y' in object && Object.keys(object).length === 2 ? true : false;
}
