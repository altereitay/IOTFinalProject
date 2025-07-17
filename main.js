const Switcher = require('switcher-js2');
const envFile = require('./env.json');
const mqtt = require('mqtt')

const switcher = new Switcher(envFile.DEVICE_ID, envFile.DEVICE_IP,console.log, true, envFile.DEVICE_TYPE, false, envFile.API_KEY, envFile.DEVICE_KEY);

const proxy = Switcher.listen(console.log);

proxy.on('message', (message) => {
    const msg = {
        name: message.name,
        id: message.device_ip,
        is_on: Boolean(message.state.power)
    }
    console.log(msg)
});

switcher.close()