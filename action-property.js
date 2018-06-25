"use strict";

const Property = require("./property");
const identity = (v) => v;

class ActionProperty extends Property {
    constructor(device, name, description, value) {
        if(!description.map) {
            description.map = identity;
        }
        super(device, name, {
            type: description.type,
            unit: description.unit,
            label: description.label
        }, description.map(value));
        this.spec = description;
    }

    async setValue(value) {
        if(value !== this.value) {
            let actionName;
            if(this.spec.type == 'boolean') {
                if(this.spec.toggle) {
                    actionName = this.spec.toggle;
                }
                else {
                    if(value && !this.value) {
                        actionName = this.spec.enable;
                    }
                    else {
                        actionName = this.spec.disable;
                    }
                }
            }
            else if(this.spec.type == 'number') {
                if(value > this.value) {
                    actionName = this.spec.increase;
                }
                else {
                    actionName = this.spec.decrease;
                }
            }
            if(actionName) {
                await this.device.sendAction(actionName);
                this.setCachedValue(value);
                await this.device.notifyPropertyChanged(this);
            }
        }
    }
}

module.exports = ActionProperty;
