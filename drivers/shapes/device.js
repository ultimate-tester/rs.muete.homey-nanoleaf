'use strict';

const Homey = require('homey');
const {NanoleafApi} = require('nanoleaf-cove');

class MyDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('MyDevice has been initialized');

    this.data = this.getData();
    this.client = new NanoleafApi({host: this.data.ipAddress, authToken: this.data.token});
    this.activatedScene = null;

    this.registerCapabilityListener('onoff', this.onOnOffChange.bind(this));
    this.registerCapabilityListener('dim', this.onDimChange.bind(this));
    this.registerCapabilityListener('previous_scene', this.onPreviousSceneChange.bind(this));
    this.registerCapabilityListener('next_scene', this.onNextSceneChange.bind(this));

    let setSceneAction = this.homey.flow.getActionCard('set_scene');
    setSceneAction.registerRunListener(function(args) {
      return this.setScene(args['scene']);
    }.bind(this));

    await this.synchronizeStatus();
    this.homey.setInterval(this.synchronizeStatus.bind(this), 10000);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  onAdded() {
    this.log('MyDevice has been added');
  }

  calculatePowerConsumption(power, panelCount, brightness) {
    let powerConsumption = 2; // Base consumption of 2 watts due to adapter

    if (!power) {
      // If turned off, panels don't consume power
      return powerConsumption;
    }

    // A very linear approach to estimate power consumption according to brightness. Full brightness is 2 watts per panel
    powerConsumption += panelCount * (2 * (brightness / 100));
    return powerConsumption;
  }

  async synchronizeStatus() {
    console.log('synchronizeStatus');

    try {
      const res = await this.client.getAllInfo();
      const data = res.data;

      if (!!data.effects && !!data.effects.select) {
        this.activatedScene = data.effects.select;
      }

      await this.setCapabilityValue('onoff', data.state.on.value);
      await this.setCapabilityValue('dim', data.state.brightness.value / 100);
      await this.setCapabilityValue('measure_power',
          this.calculatePowerConsumption(data.state.on.value, data.panelLayout.layout.numPanels, data.state.brightness.value));
    } catch (err) {
      // TODO: What to do with errors?
    }
  }

  async onOnOffChange(value, opts) {
    console.log('onOnOffChange', value);

    await this.client.setLightState({
      on: {
        value: value,
      },
    });

    await this.synchronizeStatus();
  }

  async onDimChange(value, opts) {
    console.log('onDimChange', value);

    await this.client.setLightState({
      brightness: {
        value: value * 100,
      },
    });

    await this.synchronizeStatus();
  }

  async onPreviousSceneChange() {
    console.log('onPreviousSceneChange');

    const res = await this.client.getAllScenes();
    const scenes = res.data;

    let previousIndex = 0;

    if (!!this.activatedScene) {
      const currentIndex = scenes.indexOf(this.activatedScene);
      previousIndex = currentIndex - 1;
      if (previousIndex < 0) {
        previousIndex = scenes.length - 1;
      }
    }

    await this.client.activateScene(scenes[previousIndex]);
    await this.synchronizeStatus();
  }

  async onNextSceneChange() {
    console.log('onNextSceneChange');

    const res = await this.client.getAllScenes();
    const scenes = res.data;

    let nextIndex = 0;

    if (!!this.activatedScene) {
      const currentIndex = scenes.indexOf(this.activatedScene);
      nextIndex = currentIndex + 1;
      if (nextIndex >= scenes.length) {
        nextIndex = 0;
      }
    }

    await this.client.activateScene(scenes[nextIndex]);
    await this.synchronizeStatus();
  }

  async setScene(name) {
    console.log(`setScene ${name}`);

    try {
      await this.client.activateScene(name);
      await this.synchronizeStatus();
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = MyDevice;
