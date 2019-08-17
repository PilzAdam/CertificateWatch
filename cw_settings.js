'use strict';

/*
 * The script for the settings page.
 */

browser.runtime.getBackgroundPage().then((bg) => {
const CW = bg.getCW();

(function() {
	// initialize values
	let certChecks = document.getElementById("certChecks");
	certChecks.value = CW.getSetting("certChecks", "all");
	
	let logLevel = document.getElementById("logLevel");
	logLevel.value = CW.getSetting("logLevel", "none");
	
	let ignoredDomains = document.getElementById("ignoredDomains");
	ignoredDomains.value = CW.getSetting("ignoredDomains", []).join("\n");
	
	// set up listeners
	certChecks.addEventListener("change", function() {
		CW.setSetting("certChecks", certChecks.value);
	});
	logLevel.addEventListener("change", function() {
		CW.setSetting("logLevel", logLevel.value);
	});
	ignoredDomains.addEventListener("change", function() {
		CW.setSetting("ignoredDomains", ignoredDomains.value.split("\n"));
	});
})();


}); // CW getter
