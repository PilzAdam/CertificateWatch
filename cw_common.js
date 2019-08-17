'use strict';

/*
 * Utility functions included in all other scripts
 * This also handles data-i18n attributes in all HTML files its included in
 */

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

/*
 * I18N automatically applied to all HTML
 * adapted from: https://github.com/erosman/HTML-Internationalization
 */
for (const node of document.querySelectorAll('[data-i18n]')) {
	for (const i18n of node.dataset.i18n.split(';')) {
		let [attr, key] = i18n.split("=");
		if (!key) {
			key = attr;
			attr = null;
		}
		const translated= browser.i18n.getMessage(key);
		attr ? node[attr] = translated : node.appendChild(document.createTextNode(translated));
	}
}
