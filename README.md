
## Raspberry Pi Zero


Install [Node 8.x](https://www.thepolyglotdeveloper.com/2018/03/install-nodejs-raspberry-pi-zero-w-nodesource/) ([Not 10.x](https://github.com/noble/node-bluetooth-hci-socket/issues/95))

    curl -o node-v8.15.0-linux-armv6l.tar.gz https://nodejs.org/dist/latest-v8.x/node-v8.15.0-linux-armv6l.tar.gz
    tar -xzf node-v8.15.0-linux-armv6l.tar.gz
    sudo cp -r node-v8.15.0-linux-armv6l/* /usr/local/


Install dependencies

    sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev git


Allow Node access to [Bluetooth](https://github.com/noble/noble#running-on-linux)

    sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)


### Development

Run application; defaults to port 3009

    npx coffee app.coffee

### TODO

* Throttle label?
* icon/logo
* rename train
* inline SVG in CSS
