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
/* global CW */

/*
 * Background script that handles tab states and updates the browser actions.
 */

CW.updateTabIcon = (tabId) => {
	if (CW.enabled === false) {
		browser.browserAction.setIcon({
			tabId: tabId,
			path: {
				16: "icons/cw_16_disabled.png"
			}
		});
		browser.browserAction.setTitle({
			tabId: tabId,
			title: browser.i18n.getMessage("extensionName") + "\n" + browser.i18n.getMessage("tooltipDisabled")
		});

	} else {
		const tab = CW.getTab(tabId);
		const status = tab.highestStatus;
		browser.browserAction.setIcon({
			tabId: tabId,
			path: {
				16: status.icon
			}
		});
		browser.browserAction.setTitle({
			tabId: tabId,
			title: browser.i18n.getMessage("extensionName") + "\n" + status.text
		});
	}

};

function tabAdded(tab) {
	CW.logDebug("New tab", tab.id);
	CW.tabs[tab.id] = new CW.Tab(tab.id);
}
browser.tabs.onCreated.addListener(tabAdded);

function tabRemoved(tabId) {
	CW.logDebug("Tab removed", tabId);
	delete CW.tabs[tabId];
}
browser.tabs.onRemoved.addListener(tabRemoved);

function tabUpdated(tabId, changeInfo) {
	const tab = CW.getTab(tabId);

	if (changeInfo.status === "loading") {
		// only use the first "loading" state until the next complete comes through
		// this is because there is another "loading" event when the first request went through
		if (!tab.lastState || tab.lastState === "complete") {
			CW.logDebug("Clearing tab", tabId);
			tab.clear();
		}
		tab.lastState = "loading";

	} else if (changeInfo.status === "complete") {
		tab.lastState = "complete";
	}

	// always update on any change event, as sometimes the default icon is
	// applied automatically...
	CW.updateTabIcon(tabId);
}
browser.tabs.onUpdated.addListener(tabUpdated);
