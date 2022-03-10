A website to control one or more Duplo® Trains. More than one device (browser) can connect and all controls are updated in real time.

## Raspberry Pi Zero W Install

Install [Node 8.x](https://www.thepolyglotdeveloper.com/2018/03/install-nodejs-raspberry-pi-zero-w-nodesource/) ([Not 10.x](https://github.com/noble/node-bluetooth-hci-socket/issues/95))

    curl -o node-v8.15.0-linux-armv6l.tar.gz https://nodejs.org/dist/latest-v8.x/node-v8.15.0-linux-armv6l.tar.gz
    tar -xzf node-v8.15.0-linux-armv6l.tar.gz
    sudo cp -r node-v8.15.0-linux-armv6l/* /usr/local/


Install dependencies

    sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev git

Allow Node access to [Bluetooth](https://github.com/noble/noble#running-on-linux)

    sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

Create user to run application

    sudo adduser conductor
    su conductor
    cd
    git clone https://github.com/firien/duplo-train.git
    cd duplo-train
    npm install

Auto Start Up

Save file as `duplo-train.service`

    [Unit]
    Description=Duplo Train
    After=network.target
    
    [Service]
    ExecStart=/usr/local/bin/node server.js
    WorkingDirectory=/home/conductor/duplo-train
    StandardOutput=inherit
    StandardError=inherit
    Restart=always
    
    User=conductor
    Group=conductor
    Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
    Environment=NODE_ENV=production
    
    [Install]
    WantedBy=multi-user.target

And setup systemd

    sudo cp duplo-train.service /etc/systemd/system/duplo-train.service
    sudo systemctl enable duplo-train.service

### Development

Run application; defaults to port 3000

    node server.js

### TODO

- [ ] Throttle label?
- [ ] icon/logo
- [ ] inline SVG in CSS
- [ ] support default action bricks
