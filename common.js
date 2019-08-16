'use strict';

/*
 * Utility functions included in all other scripts
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

// from https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript
function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}
