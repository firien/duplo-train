express = require('express')
bodyParser = require('body-parser')
app = express()
expressWs = require('express-ws')(app)

port = 3000
app.set('view engine', 'pug')
app.use(express.static('public'))
app.use(bodyParser.json())

PoweredUP = require('node-poweredup')
pup = new PoweredUP.PoweredUP()
sounds = PoweredUP.Consts.DuploTrainBaseSound
$colors = PoweredUP.Consts.Color
$trains = {}

pup.on('discover', (train) ->
  await train.connect()
  train.direction = 'none'
  train.speed = 50
  $trains[train.uuid] = train
  broadcastTrains()
  train.on('speed', (port, speed) ->
    # the train will stop automatically if the:
    # * front wheels stop moving (thats where the speedometer is)
    # * distance sensor detects the train is off the ground
    if train.direction != 'none' && speed == 0
      train.direction = 'none'
      broadcast(train: train.uuid, direction: 'none')
  )
  train.on('disconnect', ->
    broadcast(train: train.uuid, disconnect: true)
    delete $trains[train.uuid]
  )
)

scanning = false
timer = 0
TEN_SECONDS = 10000
requestScan = ->
  if not scanning
    scanning = true
    pup.scan()
  # reset 
  clearTimeout(timer)
  # scan for 10 seconds
  timer = setTimeout( ->
    pup.stop()
    scanning = false
  , TEN_SECONDS)
requestScan()

app.get('/', (req, res) ->
  requestScan()
  colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink']
  title = 'Trains'
  res.render('index', {colors, title})
)

broadcastTrains = (ws) ->
  broadcast(Object.values($trains).map((train) ->
    {
      uuid: train.uuid
      battery: train.batteryLevel
      name: train.name
      color: $colors[train.color]?.toLowerCase()
      speed: train.speed
      direction: train.direction
    }
  ), ws)

broadcast = (data, ws) ->
  payload = JSON.stringify(data)
  expressWs.getWss().clients.forEach((client) ->
    if (client.readyState == 1)
      if ws?
        if (client == ws)
          client.send(payload)
      else
        client.send(payload)
  )

# train
setName = (train, name) ->
  train.setName(name)

setMotor = (train) ->
  factor = switch train.direction
    when 'reverse' then -1
    when 'none' then 0
    else 1
  train.setMotorSpeed('MOTOR', train.speed * factor)

refill = (train) ->
  await train.setMotorSpeed('MOTOR', 0)
  await train.playSound(sounds.WATER_REFILL)
  await train.sleep(4000)
  setMotor(train)

# web sockets
noop = ->
heartbeat = ->
  this.isAlive = true

app.ws('/', (ws, req) ->
  ws.isAlive = true
  broadcastTrains(ws)
  ws.on('pong', heartbeat)
  ws.on('message', (msg) ->
    response = JSON.parse(msg)
    train = $trains[response.train]
    if train?
      if response.direction?
        pause = (train.direction != 'none') && (train.direction != response.direction)
        train.direction = response.direction
        # stop first
        if pause
          await train.setMotorSpeed('MOTOR', 0)
          await train.sleep(500)
        setMotor(train)
      if response.name?
        setName(train, response.name)
      if response.speed?
        train.speed = Number(response.speed)
        setMotor(train)
      if response.color?
        color = $colors[response.color.toUpperCase()]
        train.color = color
        train.setLEDColor(color)
      if response.refill?
        refill(train)
      if response.sound?
        sound = sounds[response.sound.toUpperCase()]
        train.playSound(sound)
      # broadcast to other clients
      expressWs.getWss().clients.forEach((client) ->
        if (client != ws) && (client.readyState == 1)
          client.send(msg)
      )
  )
)

setInterval( ->
  expressWs.getWss().clients.forEach((ws) ->
    if ws.isAlive == false
      return ws.terminate()
    ws.isAlive = false
    ws.ping(noop)
  )
, 30000)

app.listen(port, '0.0.0.0')
