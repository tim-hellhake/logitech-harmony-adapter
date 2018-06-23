'use strict';

let Device;
try {
    Device = require('../device');
}
catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }

    const gwa = require('gateway-addon');
    Device = gwa.Device;
}

const wait = (time) => {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
};

// Generic device controlled by the hub.
class HarmonyDevice extends Device {
    constructor(adapter, hub, id, device) {
        super(adapter, id);
        this.name = device.label;
        this.description = `${device.manufacturer} ${device.deviceTypeDisplayName} ${device.model}`;
        this.hub = hub;
        this.actionInfo = {};
        this.pendingActions = new Set();

        //TODO some actions are actually toggleable in the harmony app. Figure out how that state transition works.
        for(const g of device.controlGroup) {
            if(g.function.length) {
                for(const action of g.function) {
                    this.addAction(action.name, {
                        label: action.label
                    });
                    this.actionInfo[action.name] = action.action;
                }
            }
        }

        this.adapter.handleDeviceAdded(this);
    }

    async performAction(action) {
        // Ensure we only perform the action once at a time (since else we're essentially rolling over IR keys).
        if(action.name in this.actionInfo && !this.pendingActions.has(action.name)) {
            this.pendingActions.add(action.name);
            try {
                action.start();
                // Escape JSON for weird : = format.
                const actionSpec = this.actionInfo[action.name].replace(/:/g, '::');
                await this.hub.client.request('holdAction', `action=${actionSpec}:status=press`, 'encoded', (stanza) => true);
                await wait(1000);
                await this.hub.client.request('holdAction', `action=${actionSpec}:status=release`, 'encoded', (stanza) => true);
                action.finish();
            }
            catch(e) {
                console.error(e);
            }
            this.pendingActions.delete(action.name);
        }
    }
}

module.exports = HarmonyDevice;
