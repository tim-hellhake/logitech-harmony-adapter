'use strict';

const { Explorer } = require("@harmonyhub/discover");
const HarmonyHub = require("./hub");

//TODO hue bulbs?

let Adapter;
try {
    Adapter = require('../adapter');
}
catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
        throw e;
    }

    const gwa = require('gateway-addon');
    Adapter = gwa.Adapter;
}

class HarmonyAdapter extends Adapter {
    constructor(addonManager, packageName) {
        super(addonManager, 'HarmonyAdapter', packageName);
        addonManager.addAdapter(this);

        this.startPairing(30);
    }

    /**
    * @param {HarmonyHub} device Sonos device to add.
    * @return {Promise} which resolves to the device added.
    */
    async addDevice(device) {
        if(device.uuid in this.devices) {
            throw 'Device: ' + device.uuid + ' already exists.';
        }
        else {
            const hub = new HarmonyHub(this, device.uuid, device);
            await hub.ready;
        }
    }

    async removeDevice(device, force = false) {
        const isHub = device instanceof HarmonyHub;
        let devicesForHub = 0;
        if(isHub) {
            for(const dev of Object.values(this.devices)) {
                if(dev.id !== device.id && !(dev instanceof HarmonyHub) && dev.hub.id === device.id) {
                    if(force) {
                        await this.removeThing(dev);
                    }
                    else {
                        ++devicesForHub;
                    }
                }
            }
            this.handleDeviceRemoved(device);
            // Only unload hub when it's the last device depending on itself.
            if(devicesForHub === 0) {
                device.unload();
            }
        }
        else {
            this.handleDeviceRemoved(device);
            for(const dev of Object.values(this.devices)) {
                if(dev.id !== device.hub.id && !(dev instanceof HarmonyHub) && device.hub.id === dev.hub.id) {
                    ++devicesForHub;
                }
            }
            if(devicesForHub === 0 && this.getDevice(device.hub.id)) {
                await this.removeDevice(device.hub.id);
            }
            else {
                device.hub.unload();
            }
        }
    }

    /**
    * Start the pairing/discovery process.
    *
    * @param {Number} timeoutSeconds Number of seconds to run before timeout
    */
    startPairing(_timeoutSeconds) {
        if(!this.discover) {
            this.discover = new Explorer(61991);
            this.discover.on('online', (hub) => {
                this.addDevice(hub).catch(console.error);
            });

            this.discover.on('offline', (hub) => {
                this.removeDevice(hub.uuid, true).catch(console.error);
            });
            this.discover.start();
            setTimeout(() => this.cancelPairing(), _timeoutSeconds * 1000);
        }
    }

    /**
    * Cancel the pairing/discovery process.
    */
    cancelPairing() {
        if(this.discover) {
            this.discover.stop();
            this.discover.removeAllListeners();
            this.discover = undefined;
        }
    }

    /**
    * Unpair the provided the device from the adapter.
    *
    * @param {Object} device Device to unpair with.
    * @param {boolean} [force=false] If all child devices should also be removed.
    */
    removeThing(device, force = false) {
        this.removeDevice(device, force).then(() => {
            console.log('HarmonyAdapter: device:', device.id, 'was unpaired.');
        }).catch((err) => {
            console.error('HarmonyAdapter: unpairing', device.id, 'failed');
            console.error(err);
        });
    }

    async unload() {
        for(const device of Object.values(this.devices)) {
            if(device instanceof HarmonyHub) {
                device.unload();
            }
            else {
                device.hub.unload();
            }
        }
        return super.unload();
    }
}

function loadAdapter(addonManager, manifest, _errorCallback) {
    const adapter = new HarmonyAdapter(addonManager, manifest.name);
}

module.exports = loadAdapter;
