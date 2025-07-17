const Switcher = require('switcher-js2');
const envFile = require('./env.json');
//
const switcher = new Switcher(envFile.DEVICE_ID, envFile.DEVICE_IP,console.log, true, envFile.DEVICE_TYPE, false, envFile.API_KEY, envFile.DEVICE_KEY);

//
// switcher.get_state().then((state) => {
//     console.log('📋 Device State:', state);
// }).catch((err) => {
//     console.error('⚠️ Error getting device state:', err);
// });

switcher.turn_on()

// async function status(switcher) {
//     const s = await switcher.status()
//     console.log(s)
// }
//
// status(switcher)
//
//
// switcher.on('status', s => {
//     console.log(s)
// })

switcher.close()

const proxy = Switcher.listen(console.log);

proxy.on('message', (message) => {
    console.log(message)
});

proxy.close();