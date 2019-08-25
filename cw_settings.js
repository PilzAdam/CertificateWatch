/*
 * Copyright 2019 PilzAdam
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

/*
 * The script for the settings page.
 */

browser.runtime.getBackgroundPage().then((bg) => {
const CW = bg.getCW();

(() => {
	// initialize values
	const certChecks = document.getElementById("certChecks");
	const logLevel = document.getElementById("logLevel");
	const ignoredDomains = document.getElementById("ignoredDomains");
	const resetBtn = document.getElementById("reset");
	const saveBtn = document.getElementById("save");

	/*
	 * A separate save button with a "click" event handler is required for
	 * browser.permissions.request() to work properly. This API is bugged, as
	 * it does not classify "change" events on a <select> as "user action"
	 * (https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/User_actions)
	 */

	function reset() {
		resetBtn.disabled = true;
		saveBtn.disabled = true;

		certChecks.value = CW.getSetting("certChecks", "all");
		logLevel.value = CW.getSetting("logLevel", "none");
		ignoredDomains.value = CW.getSetting("ignoredDomains", []).join("\n");
	}

	function save() {
		resetBtn.disabled = true;
		saveBtn.disabled = true;

		CW.setSetting("logLevel", logLevel.value);
		CW.setSetting("ignoredDomains", ignoredDomains.value.split("\n"));

		if (certChecks.value === "domain") {
			// "domain" checking requires the "tabs" permission, wich is optional
			CW.logInfo("Requesting \"tabs\" permission for domain checking");

			// disable UI while we wait for the permission to come through
			certChecks.disabled = true;
			browser.permissions.request({
				permissions: ["tabs"]
			}).then(
				(response) => {
					if (response) {
						CW.logInfo("\"tabs\" permission was allowed");
						certChecks.disabled = false;

					} else {
						CW.logInfo("\"tabs\" permission was not allowed");
						// change back to "all"
						certChecks.value = "all";
						certChecks.disabled = false;
					}
					CW.setSetting("certChecks", certChecks.value);
				}
			);
		} else {
			CW.setSetting("certChecks", certChecks.value);
		}
	}

	function modified() {
		resetBtn.disabled = false;
		saveBtn.disabled = false;
	}

	// set initial values
	reset();

	// set up listeners
	resetBtn.addEventListener("click", reset);
	saveBtn.addEventListener("click", save);

	certChecks.addEventListener("change", modified);
	logLevel.addEventListener("change", modified);
	ignoredDomains.addEventListener("input", modified);
})();


}); // CW getter
