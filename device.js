'use strict';

const ActionProperty = require("./action-property");
const { Device } = require('gateway-addon');

const wait = (time) => {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    });
};

const RECOGNIZTED_PROPERTIES = {
    muteState: {
        type: 'boolean',
        toggle: 'Mute',
        title: 'muted'
    },
    status: {
        type: 'boolean',
        map: (v) => v !== 'pause',
        enable: 'Play',
        disable: 'Pause',
        title: 'playing'
    },
    // volumeLevel: { very hard to do...
    //     type: 'number',
    //     unit: 'percent',
    //     increase: 'VolumeUp', // pretty sure there's a set command for this somewhere.
    //     decrease: 'VolumeDown',
    //     title: 'volume'
    // },
    shuffle: {
        type: 'boolean',
        toggle: 'Shuffle'
    },
    repeat: {
        type: 'boolean',
        toggle: 'Repeat'
    },
    crossfade: {
        type: 'boolean',
        toggle: 'Crossfade'
    },
};
const HANDLED_ACTIONS = [].concat(...Object.values(RECOGNIZTED_PROPERTIES).map((d) => [ d.toggle, d.enable, d.disable, d.increase, d.decrease ])).filter((v) => v);

// Generic device controlled by the hub.
class HarmonyDevice extends Device {
    constructor(adapter, hub, id, device) {
        super(adapter, id);
        this.name = device.label;
        this.description = `${device.manufacturer} ${device.deviceTypeDisplayName} ${device.model}`;
        this.hub = hub;
        this.actionInfo = {};
        this.pendingActions = new Set();
        this.rawId = device.id;
        this.rawType = device.type;
        // this.activities = new Set();

        const handledActions = this.getHandledActions();
        for(const g of device.controlGroup) {
            if(g.function.length) {
                for(const action of g.function) {
                    if(!handledActions.includes(action.name)) {
                        this.addAction(action.name, {
                            title: action.label
                        });
                    }
                    this.actionInfo[action.name] = action.action;
                }
            }
        }

        // this.addEvent('on', {
        //     type: 'string',
        //     title: 'activity ID'
        // });
        //
        // this.addEvent('off', {
        //     type: 'string',
        //     title: 'activity ID'
        // });

        //TODO figure out how a device <-> activity association is found

        this.finalize(handledActions);
    }

    // addActivity(activityId) {
    //     this.activities.add(activityId);
    // }
    //
    // shouldHandleActivity(activityId) {
    //     return this.activities.has(activityId);
    // }
    //
    // handleActivity(activityId, direction) {
    //     if(this.shouldHandleActivity(activityId)) {
    //         this.eventDispatch(new Event(diection ? 'on' : 'off', activityId));
    //     }
    // }

    getHandledActions() {
        if(this.rawType == 'DigitalMusicServer') {
            return HANDLED_ACTIONS;
        }
        return [];
    }

    async getMetadata()
    {
        // if(this.rawType == 'DigitalMusicServer') {
            // const metadata = await new Promise((resolve) => {
                // const metaId = Math.floor(Math.random() * 1000000);
                // this.hub.client._responseHandlerQueue.push({
                //     canHandleStanza: (s) => s.attr('id') == metaId,
                //     deferred: { resolve },
                //     responseType: 'json'
                // });
                // this.hub.client._xmppClient.send(`<iq type="get" id="${metaId}"><oa xmlns="connect.logitech.com" mime="vnd.logitech.setup/vnd.logitech.setup.content?getAllMetadata">deviceId=${this.rawId}</oa></iq>`);
            // });
            // return metadata.musicMeta;
        // }
        return {};
    }

    async finalize(handledActions) {
        if(handledActions.length) {
            const meta = await this.getMetadata();
            for(const prop in RECOGNIZTED_PROPERTIES) {
                if(prop in meta) {
                    this.properties.set(prop, new ActionProperty(this, prop, RECOGNIZTED_PROPERTIES[prop], meta[prop]));
                }
            }
        }

        this.adapter.handleDeviceAdded(this);
    }

    async sendAction(actionName) {
        if(actionName in this.actionInfo) {
            const actionSpec = this.actionInfo[actionName];
            await this.hub.client.send('holdAction', actionSpec, 1000);
        }
        else {
            console.warn("Unknown action", actionName);
        }
    }

    async performAction(action) {
        // Ensure we only perform the action once at a time (since else we're essentially rolling over IR keys).
        if(action.name in this.actionInfo && !this.pendingActions.has(action.name)) {
            this.pendingActions.add(action.name);
            try {
                action.start();
                this.sendAction(action.name);
                action.finish();
            }
            catch(e) {
                console.error(e);
            }
            this.pendingActions.delete(action.name);
        }
    }

    updateMeta(meta) {
        for(const key in meta) {
            if(key in RECOGNIZTED_PROPERTIES) {
                const prop = this.findProperty(key);
                prop.setCachedValue(prop.spec.map(meta[key]));
                this.notifyPropertyChanged(prop);
            }
        }
    }
}

module.exports = HarmonyDevice;
