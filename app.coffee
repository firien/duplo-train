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
$sounds = PoweredUP.Consts.DuploTrainBaseSound
$colors = PoweredUP.Consts.Color
$trains = {}

pup.on('discover', (train) ->
  await train.connect()
  train.commanded = false
  train.speed = 50
  train.actionBrick = true
  $trains[train.uuid] = train
  broadcastTrains()
  _direction = 'none'
  hysteresis = 0
  Object.defineProperty(train, 'direction'
    get: -> _direction
    set: (val) ->
      if val != _direction
        this.commanded = true
        _direction = val
        clearTimeout(hysteresis)
        hysteresis = setTimeout( =>
          this.commanded = false
        , 1500)
  )
  # broadcast 
  setInterval( ->
    broadcast(train: train.uuid, batteryLevel: train.batteryLevel)
  , 1000 * 15)
  train.on('speed', (port, speed) ->
    if !train.commanded
      # push-and-go (start motor)
      if speed > 0 && train.direction == 'none'
        train.direction = 'forward'
        setMotor(train)
        broadcast(train: train.uuid, direction: 'forward')
      else if speed < 0 && train.direction == 'none'
        train.direction = 'reverse'
        setMotor(train)
        broadcast(train: train.uuid, direction: 'reverse')
    # the train will stop automatically if the
    # front wheels stop moving (thats where the speedometer is)
    if speed == 0 && train.direction != 'none'
      train.direction = 'none'
      # motor auto-stops
      broadcast(train: train.uuid, direction: 'none')
  )
  color = null
  colorTimer = 0
  train.on('color', (port, newColor) ->
    clearTimeout(colorTimer)
    colorTimer = setTimeout( ->
      if train.direction != 'none' && !train.commanded && train.actionBrick
        if color == $colors.RED
          train.direction = 'none'
          setMotor(train)
          broadcast(train: train.uuid, direction: 'none')
        else if color == $colors.YELLOW
          train.playSound($sounds.HORN)
    , 200)
    color = newColor
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
  await train.playSound($sounds.WATER_REFILL)
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
    request = JSON.parse(msg)
    train = $trains[request.train]
    if train?
      if request.direction?
        pause = (train.direction != 'none') && (train.direction != request.direction)
        train.direction = request.direction
        # stop first
        if pause
          await train.setMotorSpeed('MOTOR', 0)
          await train.sleep(500)
        setMotor(train)
      if request.actionBrick?
        train.actionBrick = request.actionBrick
      if request.name?
        setName(train, request.name)
      if request.speed?
        train.speed = Number(request.speed)
        setMotor(train)
      if request.color?
        color = $colors[request.color.toUpperCase()]
        train.color = color
        train.setLEDColor(color)
      if request.refill?
        refill(train)
      if request.sound?
        sound = $sounds[request.sound.toUpperCase()]
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
