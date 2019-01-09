var $socket = null

const onmessage = function(event) {
  let response = JSON.parse(event.data)
  if (Array.isArray(response)) {
    response.forEach(initTrain)
  } else {
    let uuid = response.train
    let section = document.querySelector(`.train[data-uuid='${uuid}']`)
    if (response.hasOwnProperty('color')) {
      let input = queryAll(section, `input[name='color-${uuid}']`).find(function(i) {
        return i.value == response.color
      })
      if (input) {
        input.checked = true
      }
    }
    if (response.hasOwnProperty('speed')) {
      let input = section.querySelector('.throttle')
      if (input) {
        input.value = Number(response.speed)
      }
    }
    if (response.hasOwnProperty('direction')) {
      let input = queryAll(section, `input[name='direction-${uuid}']`).find(function(i) {
        return i.value == response.direction
      })
      if (input) {
        input.checked = true
      }
    }
    if (response.hasOwnProperty('disconnect')) {
      disconnected(uuid)
    }
  }
}

const initWebSocket = function() {
  $socket = new WebSocket(`ws://${location.host}/`)
  $socket.onmessage = onmessage
  $socket.onclose = function() {
    queryAll(document.body, '.train.freeze[data-uuid]').forEach(function(section) {
      let uuid = section.getAttribute('data-uuid')
      initTrain({uuid})
    })
  }
  $socket.onclose = function() {
    queryAll(document.body, '.train:not(.freeze)[data-uuid]').forEach(function(section) {
      let uuid = section.getAttribute('data-uuid')
      disconnected(uuid)
    })
  }
}

initWebSocket()
var $template = null

const speak = function(text) {
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

const queryAll = function(parent, selector) {
  return Array.prototype.slice.call(parent.querySelectorAll(selector))
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
    newTrain.querySelector('.name').textContent = train.name
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
  // initTrain({uuid: 'adsf', name: 'Wilson', color: 'blue', speed: 35, direction: 'none', battery: 40})
  // setTimeout(disconnected, 3000)
  // initTrain({uuid: 'afd', name: 'Brewster', color: 'orange', speed: 65, direction: 'forward', battery: 20})
})
