/*
 * Common functions included in all other scripts
 * - Logging
 * - Settings
 */

function logDebug() {
	getSetting("logLevel").then((result) => {
		if (result == "debug") {
			var args = Array.prototype.slice.call(arguments);
			args.unshift("[Certificate Checker]", "[Debug]");
			console.log.apply(console, args);
		}
	});
}

function logInfo() {
	getSetting("logLevel").then((result) => {
		if (result == "debug" || result == "info") {
			var args = Array.prototype.slice.call(arguments);
			args.unshift("[Certificate Checker]", "[Info]");
			console.log.apply(console, args);
		}
	});
}

const SETTING_KEY = "certificate_checker:settings";

function getSetting(key, fallback) {
	return browser.storage.local.get(SETTING_KEY).then(
		(result) => {
			let settings = result[SETTING_KEY];
			if (settings && key in settings) {
				return settings[key];
			} else {
				return fallback;
			}
		},
		(ex) => {
			return fallback;
		}
	);
}

async function setSetting(key, value) {
	let result = await browser.storage.local.get(SETTING_KEY);
	let settings = result[SETTING_KEY];
	if (!settings) {
		settings = {};
	}
	settings[key] = value;
	await browser.storage.local.set({[SETTING_KEY]: settings});
}

async function deleteSetting(key) {
	let result = await browser.storage.local.get(SETTING_KEY);
	let settings = result[SETTING_KEY];
	if (!settings) {
		settings = {};
	}
	delete settings[key];
	await browser.storage.local.set({[SETTING_KEY]: settings});
}
