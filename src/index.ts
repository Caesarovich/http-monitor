#!/usr/bin/env bun

import meow from "meow";
import { type MonitorMode, createMonitor } from "./monitor";

function parseArguments() {
	return meow(
		`
    Usage
      $ http-monitor [options] <urls...> 

    Options
      --interval, -i  Interval between requests in seconds (default: 10)
      --mode, -m      Mode of operation (parallel or sequential) (default: parallel)
      --help          Show help
      --version       Show version number

    Examples
      $ http-monitor google.com
      $ http-monitor google.com github.com
      $ http-monitor --interval 5 google.com github.com 
      $ http-monitor --mode sequential google.com github.com 
  `,
		{
			importMeta: import.meta,
			flags: {
				interval: {
					type: "number",
					shortFlag: "i",
					default: 10,
				},
				mode: {
					type: "string",
					shortFlag: "m",
					default: "parallel",
					choices: ["parallel", "sequential"],
				},
			},
		},
	);
}

type CLI = ReturnType<typeof parseArguments>;

function main(input: CLI["input"], flags: CLI["flags"]) {
	if (input.length === 0) {
		console.error("Please provide at least one URL to monitor.");
		process.exit(1);
	}

	// Convert URLs to URL objects
	const urlObjects = input.map((url) => {
		let parsedUrl: string = url.trim();
		try {
			if (!/^https?:\/\//i.test(parsedUrl)) {
				parsedUrl = `http://${parsedUrl}`;
			}
			return new URL(parsedUrl);
		} catch (e) {
			console.error(`Invalid URL: ${url}`);
			process.exit(1);
		}
	});

	createMonitor(urlObjects, {
		interval: flags.interval * 1000,
		mode: flags.mode as MonitorMode,
	});
}

try {
	const cli = parseArguments();
	main(cli.input, cli.flags);
} catch (e) {
	if (Error.isError(e)) {
		console.error(e.message);
	} else {
		console.error("An unknown error occurred.");
		console.error(e);
	}
	process.exit(1);
}
