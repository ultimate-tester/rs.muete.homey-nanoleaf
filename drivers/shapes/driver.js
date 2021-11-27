'use strict';

const Homey = require('homey');
const {NanoleafApi} = require('nanoleaf-cove');

class MyDriver extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  onInit() {
    this.log('MyDriver has been initialized');
  }

  onPair(socket) {
    socket.setHandler('start_pairing', async function(data) {
      const client = new NanoleafApi();
      data.data.token = await client.authorize(data.data.ipAddress);
      if (!data.data.token) {
        throw new Error('Unable to get token!');
      }

      return data;
    });
  }
}

module.exports = MyDriver;
