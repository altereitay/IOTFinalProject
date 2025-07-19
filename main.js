const Switcher = require('switcher-js2');
const envFile = require('./env.json');
const mqtt = require('mqtt')
const awsIot = require('aws-iot-device-sdk');
const {spawn} = require('node:child_process')
const path = require('path')

const device = awsIot.device({
  keyPath: './certs/eitay_raspberrypi4.private.key',
  certPath: './certs/eitay_raspberrypi4.cert.pem',
  caPath: './certs/root-CA.crt',
  clientId: 'eitay-rpi',
  host: envFile.MQTT_GLOBAL
});

device.on('connect', function () {
  console.log('✅ Connected to AWS IoT');
});

device.on('error', function (err) {
  console.error('❌ Error:', err);
});


const client = mqtt.connect(`${envFile.MQTT_IP}: 1883`)

client.on('connect', () =>{
    console.log('conncted to MQTT'),
    client.subscribe(envFile.MQTT_TOPIC, err =>{
        if (!err) {
            console.log('subscribed successfully')
        }
    })
})

client.on('message', handleMQTT)

const switcher = new Switcher(envFile.DEVICE_ID, envFile.DEVICE_IP,console.log, false, envFile.DEVICE_TYPE, false, envFile.API_KEY, envFile.DEVICE_KEY);

const proxy = Switcher.listen(console.log);

proxy.on('message', (message) => {
    const msg = {
        type: 'usage',
        name: message.name,
        id: message.device_ip,
        is_on: Boolean(message.state.power_consumption > 50),
        value: message.state.power_consumption
    }
    client.publish(envFile.MQTT_TOPIC, JSON.stringify(msg))
    device.publish(envFile.MQTT_TOPIC, JSON.stringify(msg))
});

// switcher.close()

function handleMQTT(topic, message) {
    if (topic !== envFile.MQTT_TOPIC) {
        return
    }
    const msg = JSON.parse(message)
    if (msg.type === 'device') {
        switch (msg.action){
            case 'turn_off':
            switcher.turn_off();
            break;
            case 'ignore':
                console.log('ignoring alerts');
                break;
            default:
                console.log('unknown command');
        }
        
    }
}

const doorHandle = spawn('python3', [path.join(__dirname, 'ultra_sonic.py')]);

doorHandle.stdout.on('data', data =>{
    dataString = data.toString().trim();
    dis = parseFloat(dataString.split(':')[1].split('cm')[0].trim());
    console.log(dis);
});

doorHandle.stderr.on('data', data => {
    console.error('Python stderr:', data.toString());
});

doorHandle.on('error', err => {
    console.error('Failed to start Python process:', err);
});
