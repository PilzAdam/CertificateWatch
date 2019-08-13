
(async function() {
	// initialize values
	let certChecks = document.getElementById("certChecks");
	certChecks.value = await getSetting("certChecks", "all");
	
	let logLevel = document.getElementById("logLevel");
	logLevel.value = await getSetting("logLevel", "none");
	
	let ignoredDomains = document.getElementById("ignoredDomains");
	ignoredDomains.value = (await getSetting("ignoredDomains", [])).join("\n");
	
	// set up listeners
	certChecks.addEventListener("change", function() {
		setSetting("certChecks", certChecks.value);
	});
	logLevel.addEventListener("change", function() {
		setSetting("logLevel", logLevel.value);
	});
	ignoredDomains.addEventListener("change", function() {
		setSetting("ignoredDomains", ignoredDomains.value.split("\n"));
	});
})();
