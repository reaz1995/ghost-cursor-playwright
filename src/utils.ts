// Helper function to wait a specified number of milliseconds
export const sleep = async (ms: number): Promise<void> =>
	await new Promise((resolve) => setTimeout(resolve, ms));

// Helper function to pick random Value
export function randomValue(min: number, max: number): number {
	min = Math.ceil(min);
	max = ~~max;
	return ~~(Math.random() * (max - min)) + min;
}
