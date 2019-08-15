'use strict';

/*
 * Common functions included in all other scripts
 * - Logging
 * - Settings
 * - Other utility functions
 */

function logDebug() {
	getSetting("logLevel").then((result) => {
		if (result == "debug") {
			var args = Array.prototype.slice.call(arguments);
			args.unshift("[Certificate Watch]", "[Debug]");
			console.log.apply(console, args);
		}
	});
}

function logInfo() {
	getSetting("logLevel").then((result) => {
		if (result == "debug" || result == "info") {
			var args = Array.prototype.slice.call(arguments);
			args.unshift("[Certificate Watch]", "[Info]");
			console.log.apply(console, args);
		}
	});
}

const SETTING_KEY = "certificate_watch:settings";

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

// convert a unix timestamp (in milliseconds) into ISO 8601 string (seconds resoultion)
function convertDate(unix){
	var date = new Date(unix);
	return date.getFullYear() + "-"
			+ date.getMonth().toString().padStart(2, "0")
			+ "-" + date.getDate().toString().padStart(2, "0")
			+ " " + date.getHours().toString().padStart(2, "0")
			+ ":" + date.getMinutes().toString().padStart(2, "0")
			+ ":" + date.getSeconds().toString().padStart(2, "0");
}

// from https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
