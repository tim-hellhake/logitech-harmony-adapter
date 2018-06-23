'use strict';

const Property = require('./property');
const HarmonyDevice = require('./device');
const harmony = require("harmonyhubjs-client");

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

class HarmonyHub extends Device {
    constructor(adapter, id, hub) {
        //TODO big client disconnect problems
        super(adapter, id);
        this.name = hub.friendlyName;
        this.description = "Logitech Harmony Hub";
        this.ip = hub.ip;

        this.properties.set('on', new Property(this, 'on', {
            type: "boolean"
        }, false));

        this.ready = harmony(this.ip).then((client) => {
            this.client = client;
            return this.setupClient();
        }).then(() => this.adapter.handleDeviceAdded(this));
    }

    updateProp(name, value) {
        const prop = this.findProperty(name);
        if(value !== prop.value) {
            prop.setCachedValue(value);
            super.notifyPropertyChanged(prop);
        }
    }

    async setupClient() {
        this.client._xmppClient.on('offline', () => {
            harmony(this.ip).then((client) => {
                this.client.end();
                this.client.removeAllListeners();
                this.client._xmppClient.removeAllListeners();
                this.client = client;
                return this.setupClient();
            });
        });

        const isOff = await this.client.isOff();
        if(!isOff) {
            this.updateProp('on', true);
        }

        this.client.on('stateDigest', (state) => {
            if(state.activityStatus == 0) {
                this.updateProp('on', false);
            }
            else if(state.activityStatus == 2) {
                this.updateProp('on', true);
            }
        });

        const activities = await this.client.getActivities();
        for(const activity of activities) {
            if(activity.id != -1) {
                this.addAction(activity.id, {
                    label: activity.label,
                    description: activity.label
                });
            }
        }

        const commands = await this.client.getAvailableCommands();

        for(const device of commands.device) {
            if(device.controlGroup.length) {
                const dev = new HarmonyDevice(this.adapter, this, device.id, device);
            }
        }
    }

    async notifyPropertyChanged(property) {
        switch(property.name) {
            case 'on':
                if(property.value) {
                    return Promise.reject("Don't know which activity to start, use activity actions instead.");
                }
                else {
                    await this.client.turnOff();
                }
            break;
        }
        super.notifyPropertyChanged(property);
    }

    async performAction(action) {
        await this.client.startActivity(action.name);
    }
}

module.exports = HarmonyHub
