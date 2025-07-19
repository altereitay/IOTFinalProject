const Switcher = require('switcher-js2');
const envFile = require('./env.json');
const mqtt = require('mqtt');
const awsIot = require('aws-iot-device-sdk');
const { spawn } = require('node:child_process');
const path = require('path');

let personInside = true;
let leaveTimer = null;

let consecutiveInCount = 0;
const CONSECUTIVE_REQUIRED = 2;
const DISTANCE_THRESHOLD = 50;
const TIMER_MS = 10 * 1000; // 10 seconds for testing

async function isOn(switcher) {
    const state = await switcher.status();
    return state.power_consumption > 50;
}

function handleAWSMessage(topic, message, switcher) {
    if (topic !== envFile.MQTT_TOPIC) return;

    try {
        const msg = JSON.parse(message);
        if (msg.type === 'device' && msg.device_id === '1') {
            if (msg.action === 'turn_off') {
                console.log('🔌 Turning off device due to remote AWS command.');
                switcher.turn_off();
            }
        }
    } catch (err) {
        console.error('❌ Failed to parse AWS IoT message:', err);
    }
}

function setupDoorSensor(switcher, device) {
    const doorHandle = spawn('python3', [path.join(__dirname, 'ultra_sonic.py')]);

    doorHandle.stdout.on('data', async data => {
        const dataString = data.toString().trim();
        const dis = parseFloat(dataString.split(':')[1].split('cm')[0].trim());
        console.log('🔎 Distance:', dis);

        if (dis < DISTANCE_THRESHOLD) {
            let enteredToIf = false;
            consecutiveInCount++;
            console.log(`🟢 Close-reading #${consecutiveInCount}`);

            if (!personInside && consecutiveInCount >= CONSECUTIVE_REQUIRED && !enteredToIf) {
                enteredToIf = true;
                console.log('🚪 Person returned.');
                personInside = true;

                if (leaveTimer) {
                    clearTimeout(leaveTimer);
                    leaveTimer = null;
                    console.log('🛑 Timer cancelled.');
                }
            }

            if (personInside && consecutiveInCount >= CONSECUTIVE_REQUIRED && !enteredToIf) {
                enteredToIf = true;
                console.log('🚪 Person left. Starting timer...');
                personInside = false;
                leaveTimer = setTimeout(() => {
                    console.log('⏰ Timer finished — triggering AWS IoT message...');
                    const snsPayload = JSON.stringify({
                        type: 'SNS',
                        value: 'send'
                    });
                    device.publish(envFile.MQTT_TOPIC, snsPayload);
                }, TIMER_MS);
            }

        } else {
            consecutiveInCount = 0; // reset on any far reading
        }
    });

    doorHandle.stderr.on('data', data => {
        console.error('Python stderr:', data.toString());
    });

    doorHandle.on('error', err => {
        console.error('Failed to start ultrasonic sensor script:', err);
    });
}

async function main() {
    // Initialize Switcher
    const switcher = new Switcher(
        envFile.DEVICE_ID,
        envFile.DEVICE_IP,
        console.log,
        false,
        envFile.DEVICE_TYPE,
        false,
        envFile.API_KEY,
        envFile.DEVICE_KEY
    );

    const proxy = Switcher.listen(console.log);
    proxy.on('message', message => {
        const msg = {
            type: 'usage',
            name: message.name,
            id: message.device_ip,
            is_on: message.state.power_consumption > 50,
            value: message.state.power_consumption
        };

        const payload = JSON.stringify(msg);
        client.publish(envFile.MQTT_TOPIC, payload);
        device.publish(envFile.MQTT_TOPIC, payload);
    });

    // AWS IoT device setup
    const device = awsIot.device({
        keyPath: './certs/eitay_raspberrypi4.private.key',
        certPath: './certs/eitay_raspberrypi4.cert.pem',
        caPath: './certs/root-CA.crt',
        clientId: 'eitay-rpi',
        host: envFile.MQTT_GLOBAL
    });

    device.on('connect', () => {
        console.log('✅ Connected to AWS IoT');

        // Subscribe to AWS topic
        device.subscribe(envFile.MQTT_TOPIC, err => {
            if (err) {
                console.error('❌ Failed to subscribe to AWS topic:', err);
            } else {
                console.log('✅ Subscribed to AWS IoT topic');
            }
        });
    });

    device.on('error', err => {
        console.error('❌ AWS IoT Error:', err);
    });

    device.on('message', (topic, message) => {
        handleAWSMessage(topic, message, switcher);
    });

    // Optional: Local MQTT client (for LAN use)
    const client = mqtt.connect(`${envFile.MQTT_IP}:1883`);
    client.on('connect', () => {
        console.log('✅ Connected to local MQTT');
        client.subscribe(envFile.MQTT_TOPIC, err => {
            if (!err) console.log('✅ Subscribed to local MQTT topic');
        });
    });

    // Launch ultrasonic distance sensor logic
    setupDoorSensor(switcher, device);
}

main().catch(err => console.error('❌ Main error:', err));
