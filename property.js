"use strict";

const { Property } = require('gateway-addon');

class HarmonyProperty extends Property {
    constructor(device, name, description, value) {
        super(device, name, description);
        this.setCachedValue(value);
    }

    async setValue(value) {
        if(value !== this.value) {
            this.setCachedValue(value);
            await this.device.notifyPropertyChanged(this);
        }
        return this.value;
    }
}

module.exports = HarmonyProperty;
