
import express from 'express';
import bodyParser from 'body-parser';
import ws from 'express-ws';
import PoweredUP from 'node-poweredup';

let app = express();
let expressWs = ws(app)
let port = 3020;

app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(bodyParser.json());

let pup = new PoweredUP.PoweredUP();
let $sounds = PoweredUP.Consts.DuploTrainBaseSound;
let $colors = PoweredUP.Consts.Color;
let $trains = {};

pup.on('discover', async function(train) {
  await train.connect();
  train.commanded = false;
  train.speed = 50;
  train.actionBrick = true;
  $trains[train.uuid] = train;
  broadcastTrains();
  let _direction = 'none';
  let hysteresis = 0;
  Object.defineProperty(train, 'direction', {
    get: function() {
      return _direction;
    },
    set: function(val) {
      if (val !== _direction) {
        this.commanded = true;
        _direction = val;
        clearTimeout(hysteresis);
        return hysteresis = setTimeout(() => {
          return this.commanded = false;
        }, 1500);
      }
    }
  });
  // broadcast 
  setInterval(function() {
    return broadcast({
      train: train.uuid,
      batteryLevel: train.batteryLevel
    });
  }, 1000 * 15);
  train.on('speed', function(port, motor) {
    let speed = motor.speed
    if (!train.commanded) {
      // push-and-go (start motor)
      if (speed > 0 && train.direction === 'none') {
        train.direction = 'forward';
        setMotor(train);
        broadcast({
          train: train.uuid,
          direction: 'forward'
        });
      } else if (speed < 0 && train.direction === 'none') {
        train.direction = 'reverse';
        setMotor(train);
        broadcast({
          train: train.uuid,
          direction: 'reverse'
        });
      }
    }
    // the train will stop automatically if the
    // front wheels stop moving (thats where the speedometer is)
    if (speed === 0 && train.direction !== 'none') {
      train.direction = 'none';
      // motor auto-stops
      return broadcast({
        train: train.uuid,
        direction: 'none'
      });
    }
  });
  let color = null;
  let colorTimer = 0;
  train.on('color', function(port, newColor) {
    clearTimeout(colorTimer);
    colorTimer = setTimeout(async function() {
      if (train.direction !== 'none' && !train.commanded && train.actionBrick) {
        if (color === $colors.RED) {
          train.direction = 'none';
          setMotor(train);
          return broadcast({
            train: train.uuid,
            direction: 'none'
          });
        } else if (color === $colors.YELLOW) {
          let speaker = await train.waitForDeviceByType(PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_SPEAKER);
          speaker.playSound($sounds.HORN);
        }
      }
    }, 200);
    return color = newColor;
  });
  return train.on('disconnect', function() {
    broadcast({
      train: train.uuid,
      disconnect: true
    });
    return delete $trains[train.uuid];
  });
});

let scanning = false;
let timer = 0;

const TEN_SECONDS = 10000;

const requestScan = function() {
  if (!scanning) {
    scanning = true;
    pup.scan();
  }
  // reset 
  clearTimeout(timer);
  // scan for 10 seconds
  timer = setTimeout(function() {
    pup.stop();
    scanning = false;
  }, TEN_SECONDS);
};

requestScan();

app.get('/', function(req, res) {
  requestScan();
  let colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
  let title = 'Trains';
  return res.render('index', {colors, title});
});

const broadcastTrains = function(ws) {
  return broadcast(Object.values($trains).map(function(train) {
    return {
      uuid: train.uuid,
      battery: train.batteryLevel,
      name: train.name,
      color: $colors[train.color]?.toLowerCase(),
      speed: train.speed,
      direction: train.direction
    };
  }), ws);
};

const broadcast = function(data, ws) {
  let payload = JSON.stringify(data);
  return expressWs.getWss().clients.forEach(function(client) {
    if (client.readyState === 1) {
      if (ws != null) {
        if (client === ws) {
          return client.send(payload);
        }
      } else {
        return client.send(payload);
      }
    }
  });
};

// train
const setName = function(train, name) {
  return train.setName(name);
};

const setMotor = async function(train) {
  let factor = (function() {
    switch (train.direction) {
      case 'reverse':
        return -1;
      case 'none':
        return 0;
      default:
        return 1;
    }
  })();
  let motor = await train.waitForDeviceByType(PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_MOTOR);
  // console.log(train.speed * factor)
  motor.setPower(train.speed * factor)
  // train.setMotorSpeed('MOTOR', train.speed * factor);
};

const refill = async function(train) {
  let motor = await train.waitForDeviceByType(PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_MOTOR);
  await motor.setPower(0)
  let speaker = await train.waitForDeviceByType(PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_SPEAKER);
  speaker.playSound($sounds.WATER_REFILL);
  await train.sleep(4000);
  return setMotor(train);
};

// web sockets
const noop = function() {};

const heartbeat = function() {
  return this.isAlive = true;
};

app.ws('/', function(ws, req) {
  ws.isAlive = true;
  broadcastTrains(ws);
  ws.on('pong', heartbeat);
  return ws.on('message', async function(msg) {
    let request = JSON.parse(msg);
    let train = $trains[request.train];
    if (train != null) {
      if (request.direction != null) {
        let pause = (train.direction !== 'none') && (train.direction !== request.direction);
        train.direction = request.direction;
        // stop first
        if (pause) {
          let motor = await train.waitForDeviceByType(PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_MOTOR);
          await motor.setPower(0);
          await train.sleep(500);
        }
        setMotor(train);
      }
      if (request.actionBrick != null) {
        train.actionBrick = request.actionBrick;
      }
      if (request.name != null) {
        setName(train, request.name);
      }
      if (request.speed != null) {
        train.speed = Number(request.speed);
        setMotor(train);
      }
      if (request.color != null) {
        let color = $colors[request.color.toUpperCase()];
        train.color = color;
        let led = await train.waitForDeviceByType(PoweredUP.Consts.DeviceType.HUB_LED);
        led.setColor(color)
      }
      if (request.refill != null) {
        refill(train);
      }
      if (request.sound != null) {
        let sound = $sounds[request.sound.toUpperCase()];
        let speaker = await train.waitForDeviceByType(PoweredUP.Consts.DeviceType.DUPLO_TRAIN_BASE_SPEAKER);
        speaker.playSound(sound);
      }
      // broadcast to other clients
      return expressWs.getWss().clients.forEach(function(client) {
        if ((client !== ws) && (client.readyState === 1)) {
          return client.send(msg);
        }
      });
    }
  });
});

setInterval(function() {
  return expressWs.getWss().clients.forEach(function(ws) {
    if (ws.isAlive === false) {
      return ws.terminate();
    }
    ws.isAlive = false;
    return ws.ping(noop);
  });
}, 30000);

app.listen(port, '0.0.0.0');
