"use strict";

// See https://gist.github.com/freaktechnik/53e8bf5d80fcf3ab44361cc240acdbd6

const Property = require('./property');

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

const MAX_BRIGHTNESS = 255;

class HarmonyBulb extends Device {
    constructor(adapter, hub, id, info) {
        super(adapter, id);
        this.hub = hub;
        this.type = "dimmableColorLight";
        //TODO human readable name is missing from API.

        this.properties.set('on', new Property(this, 'on', {
            type: "boolean"
        }, info.on));
        this.properties.set('level', new Property(this, 'level', {
            type: "number",
            unit: "percent"
        }, this.getBrightness(info.birghtness)));
        this.properties.set('color', new Property(this, 'color', {
            type: "string"
        }, this.getHex(info.color)));

        this.adapter.handleDeviceAdded(this);
    }

    getBrightness(brightness) {
        return Math.floor((brightness / MAX_BRIGHTNESS) * 100);
    }

    getHex(colorSpec) {
        if("hueSat" in colorSpec) {
            //Probably easiest way to get a hex?
            return "#ffffff";
        }
    }
}

module.exports = HarmonyBulb;
