import chalk from "chalk";
import { TerminalUI, UIFlex, UILogBox, UITable } from "./tui";

type RequestResult = {
	url: URL;
	timestamp: Date;
	duration: number;
	status: number;
	success: boolean;
	protocol: "http" | "https";
	error?: string;
};

type SiteRequestResult = {
	siteURL: URL;
	minDuration: number;
	maxDuration: number;
	avgDuration: number;
	httpResult: RequestResult;
	httpsResult: RequestResult;
};

async function requestSite(siteURL: URL): Promise<SiteRequestResult> {
	const start = Date.now();

	const httpURL = new URL(`http://${siteURL.hostname}${siteURL.pathname}`);
	const httpsURL = new URL(`https://${siteURL.hostname}${siteURL.pathname}`);

	const requests = [httpURL, httpsURL].map(async (url) => {
		let req: Response | null = null;

		try {
			req = await fetch(url.toString(), {
				redirect: "manual",
				signal: AbortSignal.timeout(5000),
			});
		} catch (error) {
			let errorMessage = "Unknown error";
			if (Error.isError(error)) {
				errorMessage = error.message;
			}

			return {
				url: url,
				timestamp: new Date(),
				duration: 5000,
				status: 0,
				success: false,
				error: errorMessage,
				protocol: url.protocol.replace(":", "") as "http" | "https",
			} satisfies RequestResult;
		}

		const duration = Date.now() - start;

		const isOk = req.ok || (req.status >= 300 && req.status < 400);

		return {
			url: url,
			timestamp: new Date(),
			duration,
			status: req.status,
			success: isOk,
			protocol: url.protocol.replace(":", "") as "http" | "https",
			error: isOk ? undefined : `Error: ${req.statusText}`,
		} satisfies RequestResult;
	});

	const [httpResult, httpsResult] = await Promise.all(requests);

	const minDuration = Math.min(httpResult.duration, httpsResult.duration);
	const maxDuration = Math.max(httpResult.duration, httpsResult.duration);
	const avgDuration = (httpResult.duration + httpsResult.duration) / 2;

	return {
		siteURL,
		minDuration,
		maxDuration,
		avgDuration,
		httpResult,
		httpsResult,
	};
}

function checkSite(
	sites: Map<string, SiteRequestResult>,
	onUpdate: (site: SiteRequestResult) => void,
): (url: URL) => Promise<void> {
	return async (url: URL) => {
		const res = await requestSite(url);
		sites.set(url.toString(), res);
		onUpdate(res);
	};
}

function parallelMonitor(
	urls: URL[],
	interval: number,
	onUpdate: (site: SiteRequestResult) => void,
) {
	const sites = new Map<string, SiteRequestResult>();

	const check = checkSite(sites, onUpdate);

	const startMonitoringSite = async (url: URL) => {
		await check(url);
		setTimeout(() => startMonitoringSite(url), interval);
	};

	for (const url of urls) {
		startMonitoringSite(url);
	}
}

function sequentialMonitor(
	urls: URL[],
	interval: number,
	onUpdate: (site: SiteRequestResult) => void,
) {
	const sites = new Map<string, SiteRequestResult>();

	const check = checkSite(sites, onUpdate);

	const checkSites = async () => {
		for (const url of urls) {
			await check(url);
		}

		setTimeout(checkSites, interval);
	};

	checkSites();
}

function makeRequestResultMessage(result: RequestResult): string {
	const status = result.success
		? chalk.green(`OK (${result.status})`)
		: chalk.red(`ERROR ${result.status}`);
	const duration = result.duration ? `${result.duration}ms` : "N/A";
	const error = result.error ? chalk.red(result.error) : "";

	const timestamp = result.timestamp
		.toISOString()
		.split("T")[1]
		.replace("Z", "");
	const formattedTimestamp = chalk.dim(`[${timestamp}]`);

	return `${formattedTimestamp} ${result.url.toString()} - ${status} - ${duration} ${error}`;
}

function logSiteRequestResults(result: SiteRequestResult, logBox: UILogBox) {
	const { httpResult, httpsResult } = result;

	const results = [httpResult, httpsResult].sort(
		(a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
	);

	const logMessages = results.map((res) => makeRequestResultMessage(res));

	for (const message of logMessages) {
		logBox.appendLog(message);
	}
}

function makeSiteStatusData(result: SiteRequestResult): string[] {
	const { siteURL, httpResult, httpsResult } = result;
	const httpStatus = httpResult.success
		? chalk.green(`OK (${httpResult.status})`)
		: chalk.red(`ERROR ${httpResult.status}`);
	const httpsStatus = httpsResult.success
		? chalk.green(`OK (${httpsResult.status})`)
		: chalk.red(`ERROR ${httpsResult.status}`);
	const latestResponseTime = `${result.avgDuration}ms`;

	return [siteURL.hostname, httpStatus, httpsStatus, latestResponseTime];
}

export type MonitorMode = "parallel" | "sequential";

export type MonitorOptions = {
	interval: number; // Interval in milliseconds
	mode: MonitorMode; // Mode of operation
};

export function createMonitor(urls: URL[], options: MonitorOptions) {
	// Create a blessed screen

	const screen = new TerminalUI();

	process.on("SIGINT", () => {
		screen.exit();
	});

	// Create a table for displaying status
	const statusTable = new UITable({
		headers: ["URL", "HTTP Status", "HTTPS Status", "Avg. latency"],
	});

	statusTable.setData(
		urls.map((url) => [url.hostname, "Pending", "Pending", "N/A"]),
	);

	// Create a box for logs
	const logBox = new UILogBox({
		boxOptions: {
			borderColor: "grey",
			borderStyle: "single",
			title: "Logs",
		},
	});

	const flexBox = new UIFlex({
		direction: "vertical",
		elements: [statusTable, logBox],
	});

	// Add elements to the screen
	screen.setChild(flexBox);

	screen.start();

	// Focus the screen
	screen.render();

	// Store recent results
	const results: Map<string, SiteRequestResult> = new Map();

	// Update the status table
	const updateStatusTable = () => {
		const data = Array.from(results.values()).map(makeSiteStatusData);
		statusTable.setData(data);
	};

	const onUpdate = (result: SiteRequestResult) => {
		results.set(result.siteURL.toString(), result);

		updateStatusTable();

		logSiteRequestResults(result, logBox);

		screen.render();
	};

	if (options.mode === "parallel") {
		parallelMonitor(urls, options.interval, onUpdate);
	} else if (options.mode === "sequential") {
		sequentialMonitor(urls, options.interval, onUpdate);
	}
}
