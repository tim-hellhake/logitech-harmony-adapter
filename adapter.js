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
            const dev = this.getDevice(device.uuid);
            if(dev instanceof HarmonyHub) {
                await dev.getChildDevices();
            }
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
    async removeDevice(deviceId) {
        const device = this.devices[deviceId];
        if(device) {
            const deviceCount = Object.keys(this.devices).length;
            const isHub = device instanceof HarmonyHub;
            if(deviceCount == 1 && isHub) {
                device.client.end();
                device.client.removeAllListeners();
                device.client._xmppClient.removeAllListeners();
            }
            // Only remove hub when it's the last device. Breaks if there are multiple hubs...
            if(!isHub || deviceCount == 1) {
                this.handleDeviceRemoved(device);
            }

            if(!isHub && deviceCount == 2 && this.getDevice(device.hub.id)) {
                await this.removeDevice(device.hub.id);
            }

            return device;
        }
        else {
            throw 'Device: ' + deviceId + ' not found.';
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
                //TODO should probably also remove all child devices controlled by this hub.
                this.removeDevice(hub.uuid).catch(console.error);
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
            this.discover.ping.socket.unref();
            this.discover.ping.socket = undefined;
            this.discover = undefined;
        }
    }

    /**
    * Unpair the provided the device from the adapter.
    *
    * @param {Object} device Device to unpair with
    */
    removeThing(device) {
        this.removeDevice(device.id).then(() => {
            console.log('HarmonyAdapter: device:', device.id, 'was unpaired.');
        }).catch((err) => {
            console.error('HarmonyAdapter: unpairing', device.id, 'failed');
            console.error(err);
        });
    }
}

function loadAdapter(addonManager, manifest, _errorCallback) {
    const adapter = new HarmonyAdapter(addonManager, manifest.name);
}

module.exports = loadAdapter;
