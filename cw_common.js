"use strict";

/*
 * Utility functions included in all other scripts
 * This also handles data-i18n attributes in all HTML files its included in
 */

// convert a unix timestamp (in milliseconds) into ISO 8601 string (seconds resoultion)
function convertDate(unix) {
	const date = new Date(unix);
	return date.getFullYear() + "-" +
			date.getMonth().toString().padStart(2, "0") +
			"-" + date.getDate().toString().padStart(2, "0") +
			" " + date.getHours().toString().padStart(2, "0") +
			":" + date.getMinutes().toString().padStart(2, "0") +
			":" + date.getSeconds().toString().padStart(2, "0");
}

// formats bytes like "15.32 MiB"
function formatBytes(bytes) {
	const prefixes = ["B", "KiB", "MiB", "GiB", "TiB"];
	let prefixIndex = 0;
	while (bytes >= 1024 && prefixIndex + 1 < prefixes.length) {
		bytes = bytes / 1024;
		prefixIndex++;
	}

	if (prefixIndex > 0) {
		bytes = bytes.toFixed(2);
	}

	return bytes + " " + prefixes[prefixIndex];
}

// creates a string like "16 days ago", "today" or "in 15 days"
// date is a unix timestamp in milliseconds
function timeDiffToToday(date) {
	const MS_PER_DAY = 24*60*60*1000; // hours*minutes*seconds*milliseconds
	const now = new Date();
	// start of day, thus use floor
	const diff = Math.floor(date / MS_PER_DAY) - Math.floor(now.getTime() / MS_PER_DAY);

	if (diff === 0) {
		return browser.i18n.getMessage("timeDiffToday");
	} else if (diff === -1) {
		return browser.i18n.getMessage("timeDiffBeforeToday-single", -diff);
	} else if (diff < 0) {
		return browser.i18n.getMessage("timeDiffBeforeToday-many", -diff);
	} else if (diff === 1) {
		return browser.i18n.getMessage("timeDiffAfterToday-single", diff);
	} else {
		return browser.i18n.getMessage("timeDiffAfterToday-many", diff);
	}
}

// adds the given text message to the parentNode
// the message contains a single substitution, which is the given nestedElement
function addMessageNested(parentNode, messageName, nestedElement) {
	const placeholder = "__CW_PLACEHOLDER__";
	const translated = browser.i18n.getMessage(messageName, placeholder);
	/*if (translated.startsWith(placeholder)) {
		parentNode.appendChild(nestedElement);
		parentNode.appendChild(document.createTextNode(translated));

	} else if (translated.endsWith(placeholder)) {
		parentNode.appendChild(nestedElement);
		parentNode.appendChild(document.createTextNode(translated));

	} else {*/
		const [front, back] = translated.split(placeholder);
		parentNode.appendChild(document.createTextNode(front));
		parentNode.appendChild(nestedElement);
		parentNode.appendChild(document.createTextNode(back));

	//}
}

/*
 * I18N automatically applied to all HTML
 * adapted from: https://github.com/erosman/HTML-Internationalization
 */
(function() {
	for (const node of document.querySelectorAll("[data-i18n]")) {
		for (const i18n of node.dataset.i18n.split(";")) {
			let [attr, key] = i18n.split("=");
			if (!key) {
				key = attr;
				attr = null;
			}
			const translated= browser.i18n.getMessage(key);
			if (attr) {
				node[attr] = translated;
			} else {
				node.appendChild(document.createTextNode(translated));
			}
		}
	}
})();
