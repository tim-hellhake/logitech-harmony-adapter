'use strict';

const Property = require('./property');
const HarmonyDevice = require('./device');
// const HarmonyBulb = require("./bulb");
const { getHarmonyClient } = require("@harmonyhub/client");

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

const OFF_LABEL = 'Off';

class HarmonyHub extends Device {
    constructor(adapter, id, hub) {
        //TODO big client disconnect problems
        super(adapter, id);
        this.name = hub.friendlyName;
        this.description = "Logitech Harmony Hub";
        this.ip = hub.ip;
        this['@type'] = [ 'OnOffSwitch' ];
        this.activityMap = {};

        this.properties.set('on', new Property(this, 'on', {
            label: "On/Off",
            type: "boolean",
            "@type": "OnOffProperty"
        }, false));

        this.properties.set('activity', new Property(this, 'activity', {
            label: "Activity",
            type: "string",
            "@type": "EnumProperty",
            enum: [ OFF_LABEL ]
        }, OFF_LABEL));

        this.ready = getHarmonyClient(this.ip).then((client) => {
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
                this.updateProp('activity', OFF_LABEL);
            }
            else if(state.activityStatus == 2) {
                // this.notifyChildren(state.activityId);
                for(const activityLabel in this.activityMap) {
                    if(this.activityMap[activityLabel] == state.activityId) {
                        this.updateProp('activity', activityLabel);
                        break;
                    }
                }
                this.updateProp('on', true);
            }
        });

        // this.client._xmppClient.on('stanza', (stanza) => {
        //     if(stanza.name == 'message') {
        //         for(const child of stanza.children) {
        //             if(child.name == "event" && child.attrs.type == 'harmonyengine.metadata?notify') {
        //                 //has children with '{"musicMeta":{"crossfade":false,"deviceId":"34596878"}}' etc.
        //                 for(const change of child.children) {
        //                     if(typeof change === "string") {
        //                         const parsed = JSON.parse(change);
        //                         if("musicMeta" in parsed) {
        //                             const device = this.adapter.getDevice(this.id + parsed.musicMeta.deviceId);
        //                             if(device) {
        //                                 device.updateMeta(parsed.musicMeta);
        //                             }
        //                         }
        //                     }
        //                 }
        //             }
        //         }
        //     }
        // });

        const activities = await this.client.getActivities();
        const currentActivity = await this.client.getCurrentActivity();
        const activityProperty = this.findProperty('activity');
        for(const activity of activities) {
            if(activity.id != -1) {
                this.activityMap[activity.label] = activity.id;
                activityProperty.enum.push(activity.label);
                if(currentActivity === activity.id) {
                    activityProperty.setCachedValue(activity.label);
                }
            }
        }

        this.getChildDevices().catch(console.error);
    }

    async getChildDevices() {
        const commands = await this.client.getAvailableCommands();

        for(const device of commands.device) {
            const id = this.id + device.id;
            if(device.controlGroup.length && !this.adapter.getDevice(id) && device.manufacturer.toLowerCase() != 'sonos') {
                const dev = new HarmonyDevice(this.adapter, this, id, device);
            }
        }

        // const automation = await new Promise((resolve) => {
        //     const autoId = Math.floor(Math.random() * 1000000);
        //     this.client._responseHandlerQueue.push({
        //         canHandleStanza: (s) => s.attr('id') == autoId,
        //         deferred: { resolve },
        //         responseType: 'json'
        //     });
        //     this.client._xmppClient.send(`<iq type="get" id="${autoId}"><oa xmlns="connect.logitech.com" mime="vnd.logitech.harmony/vnd.logitech.harmony.automation?getState"/></iq>`);
        // });
        //
        // for(const id in automation) {
        //     const dev = new HarmonyBulb(this.adapter, this, id, automation[id]);
        // }
    }

    // async notifyChildren(activityId) {
    //     for(const device of devices) {
    //         const child = this.adapter.getDevice(this.id + device.id);
    //         child.handleActivity(activityId);
    //     }
    // }

    async notifyPropertyChanged(property) {
        switch(property.name) {
            case 'on':
                if(property.value) {
                    throw "Don't know which activity to start, use activity property instead.";
                }
                else {
                    await this.client.turnOff();
                }
            break;
            case 'activity':
                if(property.value === OFF_LABEL) {
                    await this.client.turnOff;
                }
                else if(this.activityMap.hasOwnProperty(property.value)) {
                    await this.client.startActivity(this.activityMap[property.value]);
                }
            break;
        }
        super.notifyPropertyChanged(property);
    }
}

module.exports = HarmonyHub
