'use strict';

const HarmonyHubDiscover = require("harmonyhubjs-discover");
const HarmonyHub = require("./harmony-hub");

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

        this.discover = new HarmonyHubDiscover(61991);

        this.discover.on('online', (hub) => {
            this.addDevice(hub);
        });

        this.discover.on('offline', (hub) => {
            this.removeDevice(hub.uuid);
        });

        this.startPairing(30);
    }

    /**
    * @param {HarmonyHub} device Sonos device to add.
    * @return {Promise} which resolves to the device added.
    */
    async addDevice(device) {
        if(device.uuid in this.devices) {
            throw 'Device: ' + device.host + ' already exists.';
        }
        else {
            const hub = new HarmonyHub(this, device.uuid, device);
            await hub.ready;
        }
    }

    /**
    * @param {String} deviceId ID of the device to remove.
    * @return {Promise} which resolves to the device removed.
    */
    removeDevice(deviceId) {
        return new Promise((resolve, reject) => {
            const device = this.devices[deviceId];
            if(device) {
                this.handleDeviceRemoved(device);
                resolve(device);
            }
            else {
                reject('Device: ' + deviceId + ' not found.');
            }
        });
    }

    /**
    * Start the pairing/discovery process.
    *
    * @param {Number} timeoutSeconds Number of seconds to run before timeout
    */
    startPairing(_timeoutSeconds) {
        this.discover.start();
        setTimeout(() => this.cancelPairing(), _timeoutSeconds * 1000);
    }

    /**
    * Cancel the pairing/discovery process.
    */
    cancelPairing() {
        this.discover.stop();
    }

    /**
    * Unpair the provided the device from the adapter.
    *
    * @param {Object} device Device to unpair with
    */
    removeThing(device) {
        this.removeDevice(device.id).then(() => {
            console.log('SonosAdapter: device:', device.id, 'was unpaired.');
        }).catch((err) => {
            console.error('SonosAdapter: unpairing', device.id, 'failed');
            console.error(err);
        });
    }
}

function loadAdapter(addonManager, manifest, _errorCallback) {
    const adapter = new HarmonyAdapter(addonManager, manifest.name);
}

module.exports = loadAdapter;
