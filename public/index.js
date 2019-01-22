var $socket = null
var $announce = true

const onmessage = function(event) {
  let request = JSON.parse(event.data)
  if (Array.isArray(request)) {
    request.forEach(initTrain)
  } else {
    let uuid = request.train
    let section = document.querySelector(`.train[data-uuid='${uuid}']`)
    if (request.hasOwnProperty('batteryLevel')) {
      let meter = section.querySelector('meter.battery')
      if (meter) {
        meter.value = Number(request.batteryLevel)
      }
    }
    if (request.hasOwnProperty('actionBrick')) {
      let checkbox = section.querySelector('input[name=action]')
      if (checkbox) {
        checkbox.checked = request.actionBrick
      }
    }
    if (request.hasOwnProperty('color')) {
      let input = queryAll(section, `input[name='color-${uuid}']`).find(function(i) {
        return i.value == request.color
      })
      if (input) {
        input.checked = true
      }
    }
    if (request.hasOwnProperty('name')) {
      let input = section.querySelector('input[name=name]')
      if (input) {
        input.value = request.name
      }
    }
    if (request.hasOwnProperty('speed')) {
      let input = section.querySelector('.throttle')
      if (input) {
        input.value = Number(request.speed)
      }
    }
    if (request.hasOwnProperty('direction')) {
      let input = queryAll(section, `input[name='direction-${uuid}']`).find(function(i) {
        return i.value == request.direction
      })
      if (input) {
        input.checked = true
      }
    }
    if (request.hasOwnProperty('disconnect')) {
      disconnected(uuid)
    }
  }
}

const initWebSocket = function() {
  $socket = new WebSocket(`ws://${location.host}/`)
  $socket.onmessage = onmessage
  // $socket.onclose = function() {
  //   queryAll(document.body, '.train.freeze[data-uuid]').forEach(function(section) {
  //     let uuid = section.getAttribute('data-uuid')
  //     initTrain({uuid})
  //   })
  // }
  $socket.onclose = function() {
    queryAll(document.body, '.train:not(.freeze)[data-uuid]').forEach(function(section) {
      let uuid = section.getAttribute('data-uuid')
      disconnected(uuid)
    })
  }
}

var $template = null

const speak = function(text) {
  if ($announce) {
    let msg = new SpeechSynthesisUtterance()
    msg.text = text
    // # msg.voice = window.speechSynthesis.getVoices().find((voice) ->
    // #   voice.voiceURI == 'com.apple.speech.synthesis.voice.karen.premium'
    // # )
    msg.voice = window.speechSynthesis.getVoices().find(function(voice) {
      voice.name == 'Karen'
    })
    window.speechSynthesis.speak(msg)
  }
}

const queryAll = function(parent, selector) {
  return Array.prototype.slice.call(parent.querySelectorAll(selector))
}

const setActionBrick = function(value, uuid) {
  payload = JSON.stringify({train: uuid, actionBrick: value})
  $socket.send(payload)
}
const setAnnouncer = function(e) {
  $announce = this.checked
  // this is a global setting
  queryAll(document, 'input[name=mute]').forEach(function(input) {
    if (input != this) {
      input.checked = this.checked
    }
  }, this)
}
const setName = function(value, uuid) {
  payload = JSON.stringify({train: uuid, name: value})
  $socket.send(payload)
}
const setColor = function(value, uuid) {
  speak(value)
  payload = JSON.stringify({train: uuid, color: value})
  $socket.send(payload)
}

const playSound = function(value, uuid) {
  payload = JSON.stringify({train: uuid, sound: value})
  $socket.send(payload)
}

const setDirection = function(value, uuid) {
  payload = JSON.stringify({train: uuid, direction: value})
  $socket.send(payload)
}
const setThrottle = function(value, uuid) {
  payload = JSON.stringify({train: uuid, speed: value})
  $socket.send(payload)
}

const initTrain = function(train) {
  // does it aleady exist?
  let uuid = train.uuid
  let section = document.querySelector(`.train[data-uuid='${uuid}']`)
  if (section) {
    section.classList.remove('freeze')
    queryAll(section, 'input').forEach(function(input) {
      input.disabled = false
    })
  } else {
    let f = document.importNode($template.content, true)
    let newTrain = f.querySelector('.train')
    // document.body.appendChild(f)
    newTrain.setAttribute('data-uuid', uuid)
    // name
    nameInput = newTrain.querySelector('input[name=name]')
    nameInput.value = train.name
    nameInput.addEventListener('change', function() {
      if (this.checkValidity()) {
        let name = this.value.trim()
        if (name.length > 0) {
          setName(name, uuid)
        }
      } else {
        // revert to old name
        this.value = train.name
      }
    })
    // mute
    muteInput = newTrain.querySelector('input[name=mute]')
    if (muteInput) {
      let id = `${uuid}-mute`
      muteInput.id = id
      queryAll(newTrain, 'input[name=mute] ~ label').forEach(function(label) {
        label.setAttribute('for', id)
      })
      muteInput.addEventListener('click', setAnnouncer)
    }
    // action bricks
    abInput = newTrain.querySelector('input[name=action]')
    if (abInput) {
      let id = `${uuid}-action`
      abInput.id = id
      queryAll(newTrain, 'input[name=action] ~ label').forEach(function(label) {
        label.setAttribute('for', id)
      })
      abInput.addEventListener('click', function() {
        setActionBrick(this.checked, uuid)
      })
    }
    // battery
    newTrain.querySelector('meter.battery').value = train.battery
    // lights
    queryAll(newTrain, 'input[name=color]').forEach(function(button, i) {
      let id = `${uuid}-light-${i}`
      button.id = id
      button.name = `color-${uuid}`
      button.checked = train.color == button.value
      button.addEventListener('click', function() {
        setColor(this.value, uuid)
      })
      let label = button.nextElementSibling
      label.setAttribute('for', id)
    })
    // speed
    let throttle = newTrain.querySelector('.throttle')
    if (train.speed != null) {
      throttle.value = Number(train.speed)
    }
    throttle.addEventListener('input', function() {
      setThrottle(this.value, uuid)
    })
    // direction
    let _stop = newTrain.querySelector('.stop')
    _stop.checked = (train.direction == 'none')
    let stopId = `${uuid}-stop`
    _stop.name = `direction-${uuid}`
    _stop.id = stopId
    _stop.nextElementSibling.setAttribute('for', stopId)
    _stop.addEventListener('click', function() {
      setDirection(this.value, uuid)
    })
    let forward = newTrain.querySelector('.forward')
    forward.checked = (train.direction == 'forward')
    let forwardId = `${uuid}-forward`
    forward.name = `direction-${uuid}`
    forward.id = forwardId
    forward.nextElementSibling.setAttribute('for', forwardId)
    forward.addEventListener('click', function() {
      setDirection(this.value, uuid)
    })
    let reverse = newTrain.querySelector('.reverse')
    reverse.checked = (train.direction == 'reverse')
    let reverseId = `${uuid}-reverse`
    reverse.name = `direction-${uuid}`
    reverse.id = reverseId
    reverse.nextElementSibling.setAttribute('for', reverseId)
    reverse.addEventListener('click', function() {
      setDirection(this.value, uuid)
    })
    // state-less actions
    let horn = newTrain.querySelector('.reverse')
    queryAll(newTrain, 'button.sound').forEach(function(button, i) {
      button.addEventListener('click', function() {
        playSound(this.value, uuid)
      })
    })
    let note = document.querySelector('body > p')
    if (note) {
      document.body.removeChild(note)
    }
    document.body.appendChild(f)
  }
}

const disconnected = function(uuid) {
  let section = document.querySelector(`.train[data-uuid='${uuid}']`)
  section.classList.add('freeze')
  queryAll(section, 'input').forEach(function(input) {
    input.disabled = true
  })
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    $socket.close()
  } else {
    initWebSocket()
  }
})
document.addEventListener('DOMContentLoaded', function() {
  $template = document.getElementById('train')
  initWebSocket()
})
