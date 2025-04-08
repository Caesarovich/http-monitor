import EventEmitter from "node:events";
import * as process from "node:process";
import boxen, { type Options as BoxenOptions } from "boxen";
import Table from "cli-table";
import stringWidth from "string-width";
import widestLine from "widest-line";

export type RenderConstraints = {
	maxWidth: number;
	maxHeight: number;
};

export class TerminalUI extends EventEmitter {
	private rows: number;
	private columns: number;
	child: UIElement | null = null;
	private isRunning = false;

	constructor() {
		super();
		this.rows = process.stdout.rows || 24;
		this.columns = process.stdout.columns || 80;

		// Handle terminal resize
		process.stdout.on("resize", () => {
			this.rows = process.stdout.rows || 24;
			this.columns = process.stdout.columns || 80;
			this.render();
		});
	}

	cleanup() {
		process.stdout.write("\x1b[?25h");
		process.stdout.write("\n");
	}

	exit() {
		this.cleanup();
		process.exit(0);
	}

	// Start capturing key events
	start() {
		process.on("SIGINT", () => {
			console.log("Ctrl-C was pressed");
			process.exit();
		});
		if (this.isRunning) return;

		this.isRunning = true;

		// Clear screen and hide cursor
		process.stdout.write("\x1b[2J\x1b[0;0H\x1b[?25l");
	}

	setChild(child: UIElement) {
		this.child = child;
	}

	render() {
		process.stdout.cursorTo(0, 0);

		const content = this.child
			?.render({
				maxWidth: this.columns,
				maxHeight: this.rows,
			})
			.trim();

		if (content) {
			process.stdout.write(content);
		}
	}
}

export type UIElementOptions = {
	height?: number;
	width?: number;
	parent?: UIElement;
};

export abstract class UIElement {
	fixedHeight?: number;
	fixedWidth?: number;
	parent?: UIElement;

	constructor(options: UIElementOptions = {}) {
		this.fixedHeight = options.height;
		this.fixedWidth = options.width;
		this.parent = options.parent;
	}

	get height(): number {
		return this.fixedHeight ?? this.calculateHeight();
	}
	get width(): number {
		return this.fixedWidth ?? this.calculateWidth();
	}
	set height(value: number) {
		this.fixedHeight = value;
	}
	set width(value: number) {
		this.fixedWidth = value;
	}

	abstract calculateHeight(): number;
	abstract calculateWidth(): number;
	abstract render(dimensions: { maxWidth: number; maxHeight: number }): string;
}

export type FlexDirection = "horizontal" | "vertical";

export type UIFlexOptions = UIElementOptions & {
	direction?: FlexDirection;
	elements?: UIElement[];
};

export class UIFlex extends UIElement {
	elements: UIElement[];
	direction: FlexDirection;

	constructor(options: UIFlexOptions = {}) {
		super(options);
		this.elements = options.elements ?? [];
		this.direction = options.direction ?? "horizontal";
	}

	calculateHeight(): number {
		if (this.direction === "horizontal") {
			return Math.max(...this.elements.map((el) => el.height));
		}

		let remainingHeight = this.fixedHeight ?? Number.POSITIVE_INFINITY;
		const fixedHeightElements = this.elements.filter(
			(el) => el.fixedHeight !== undefined,
		);
		const flexibleHeightElements = this.elements.filter(
			(el) => el.fixedHeight === undefined,
		);

		// Deduct fixed heights from available height
		for (const el of fixedHeightElements) {
			remainingHeight -= el.height;
		}

		// Distribute remaining height among flexible elements
		const flexibleHeight = Math.max(
			0,
			Math.floor(remainingHeight / flexibleHeightElements.length),
		);
		return (
			fixedHeightElements.reduce((acc, el) => acc + el.height, 0) +
			flexibleHeightElements.length * flexibleHeight
		);
	}

	calculateWidth(): number {
		if (this.direction === "horizontal") {
			let remainingWidth = this.fixedWidth ?? Number.POSITIVE_INFINITY;
			const fixedWidthElements = this.elements.filter(
				(el) => el.fixedWidth !== undefined,
			);
			const flexibleWidthElements = this.elements.filter(
				(el) => el.fixedWidth === undefined,
			);

			// Deduct fixed widths from available width
			for (const el of fixedWidthElements) {
				remainingWidth -= el.width;
			}

			// Distribute remaining width among flexible elements
			const flexibleWidth = Math.max(
				0,
				Math.floor(remainingWidth / flexibleWidthElements.length),
			);
			return (
				fixedWidthElements.reduce((acc, el) => acc + el.width, 0) +
				flexibleWidthElements.length * flexibleWidth
			);
		}

		return Math.max(...this.elements.map((el) => el.width));
	}

	private renderHorizontal(dimensions: RenderConstraints): string {
		let remainingWidth = dimensions.maxWidth;
		const fixedWidthElements = this.elements.filter(
			(el) => el.fixedWidth !== undefined,
		);
		const flexibleWidthElements = this.elements.filter(
			(el) => el.fixedWidth === undefined,
		);

		// Deduct fixed widths from available width
		for (const el of fixedWidthElements) {
			remainingWidth -= el.width;
		}

		// Distribute remaining width among flexible elements
		const flexibleWidth = Math.max(
			0,
			Math.floor(remainingWidth / flexibleWidthElements.length),
		);
		const elementsDimensions = this.elements.map((el) => {
			const width = el.fixedWidth ?? flexibleWidth;
			const height = Math.min(el.height, dimensions.maxHeight);
			return {
				width,
				height,
				rendered: el.render({ maxWidth: width, maxHeight: height }).split("\n"),
			};
		});

		const lines: string[] = [];
		for (
			let i = 0;
			i < Math.max(...elementsDimensions.map((el) => el.height));
			i++
		) {
			const line = elementsDimensions
				.map((el) => el.rendered[i] || " ".repeat(el.width))
				.join(" ");
			lines.push(line);
		}

		return lines.join("\n");
	}

	private renderVertical(dimensions: RenderConstraints): string {
		let remainingHeight = dimensions.maxHeight;
		const fixedHeightElements = this.elements.filter(
			(el) => el.fixedHeight !== undefined,
		);

		const widestWidth = Math.max(...this.elements.map((el) => el.width));

		// Deduct fixed heights from available height
		for (const el of fixedHeightElements) {
			remainingHeight -= el.height;
		}

		const content = this.elements
			.map((el) => {
				const height =
					el.fixedHeight ?? Math.min(el.calculateHeight(), remainingHeight);
				remainingHeight -= height;
				const width = Math.min(widestWidth, dimensions.maxWidth);
				return el.render({ maxWidth: width, maxHeight: height });
			})
			.join("\n");

		// Pad content on the right to fit the widest element
		const paddedContent = content
			.split("\n")
			.map((line) => {
				const padding = " ".repeat(
					Math.max(0, widestWidth - stringWidth(line)),
				);
				return line + padding;
			})
			.join("\n");

		return paddedContent;
	}

	render(dimensions: { maxWidth: number; maxHeight: number }): string {
		if (this.direction === "horizontal") {
			return this.renderHorizontal(dimensions);
		}
		return this.renderVertical(dimensions);
	}
}

export type UIBoxOptions = UIElementOptions & {
	boxOptions?: BoxenOptions;
	content?: string;
};

export class UIBox extends UIElement {
	boxOptions: BoxenOptions;
	content: string;

	constructor(options: UIBoxOptions = {}) {
		super(options);
		this.content = options.content ?? "";
		this.boxOptions = {};

		if (options.boxOptions) {
			this.boxOptions = {
				...options.boxOptions,
				width: options.width,
				height: options.height,
			};
		}
	}

	calculateHeight(): number {
		return this.render().split("\n").length;
	}
	calculateWidth(): number {
		return widestLine(this.render());
	}

	render(constraints?: RenderConstraints): string {
		return boxen(this.content, {
			...this.boxOptions,
			width: constraints?.maxWidth,
			height: constraints?.maxHeight,
		});
	}
}

export class UILogBox extends UIBox {
	private logs: string[];

	constructor(options: UIBoxOptions = {}) {
		super(options);
		this.logs = [];
	}

	appendLog(log: string) {
		this.logs.unshift(log);
		this.content = this.logs.join("\n");
	}
}

export type UITableOptions = UIElementOptions & {
	data?: string[][];
	headers?: string[];
};

export class UITable extends UIElement {
	data: string[][];
	headers: string[];

	constructor(options: UITableOptions = {}) {
		super(options);
		this.data = options.data ?? [];
		this.headers = options.headers ?? [];
	}

	setData(data: string[][]) {
		this.data = data;
	}

	render(): string {
		const table = new Table({
			head: this.headers,
			style: {
				head: ["bold"],
			},
			rows: this.data,
		});
		return table.toString();
	}

	calculateHeight(): number {
		return this.render().split("\n").length;
	}
	calculateWidth(): number {
		return widestLine(this.render());
	}
}
