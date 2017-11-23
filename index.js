var RtmClient = require('@slack/client').RtmClient
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
var RTM_EVENTS = require('@slack/client').RTM_EVENTS

var keys = require('./key.json')
var token = keys.SLACK_BOT_TOKEN
var groupName = keys.GROUP_NAME
var CATEGORYLIST = require('./category-list.json')

var rtm = new RtmClient(token)

var subcommand = require('subcommand')
var levelup = require('levelup')
var leveldown = require('leveldown')

var db = levelup(leveldown('./mydb'))
var channel
var channelMembers = []

var commands = [
  {
    name: 'new',
    options: [
      {
        name: 'pun'
      }
    ],
    command: handleNew
  },
  {
    name: 'score',
    command: scorePoints
  },
  {
    name: 'get',
    command: getScore
  }
]
var match = subcommand(commands)
// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload if you want to cache it
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  // for (let c of rtmStartData.groups) {
  //   if (c.name.toLowerCase() === groupName.toLowerCase()) {
  //     channel = c.id
  //     channelMembers = c.members.map(m => m.toLowerCase())
  //   }
  // }
  for (let c of rtmStartData.users) {
    if (c.name === 'jared.fowler') {
      channel = c.id
      channelMembers.push(c.id.toLowerCase())
    }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name} on channel ${channel}`)
})

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  // rtm.sendMessage('HEYYY', channel)
})

rtm.on(RTM_EVENTS.MESSAGE, function onMessage (msg) {
  if (isToPunbot(msg.text)) {
    let msgArray = msg.text.split(' ').map(xs => xs.toLowerCase())
    // check commands
    if (msgArray[1] === 'new') {
      // roll another pun
      let pun = { noun: getRandomCategory(CATEGORYLIST.white), verb: getRandomCategory(CATEGORYLIST.green) }
      rtm.sendMessage(`:zap: *Punderdome on Slack* :zap: \r\r\t ${pun.noun} :: ${pun.verb}`, msg.channel)
    } else if (msgArray[1] === 'score') {
      match(msgArray.slice(1))
    } else if (msgArray[1] === 'get') {
      match(msgArray.slice(1))
    }
  }
})
// TEMP FOR TESTING
let DMChannelId = 'D83R2HSFJ'

// write message from standard in to a (for now) hardcoded channel!?
process.stdin.on('data', function (d) {
  var data = d.toString().trim()
  rtm.sendMessage(`:star: ${data} :star:`, DMChannelId)
})

rtm.start()

function isToPunbot (msgText) {
  return /U85AZNDSS/.test(msgText)
}

function getRandomCategory (list) {
  var len = list.length
  var randIdx = Math.floor(Math.random() * len)
  return list[randIdx]
}

function stripBrackets (userId) {
  // <@ABC123> => ABC123
  return userId.replace(/[<@>]+/g, '')
}

function handleNew (args) {
  console.log('args : ', args)
}

function scorePoints (args) {
  var [points, ...rest] = args._
  var _pointVal = pointValue(points)

  if (!points || !rest.length) {
    return rtm.sendMessage(`hey uh @jared.fowler? I got an error saving these points...wanna take a :eyes:?`, DMChannelId)
  }

  db.get(rest[0], function (err, val) {
    if (err) {
      console.error(new Error(err))
      rtm.sendMessage(`hey uh @jared.fowler? I got an error saving these points: ${err}`, DMChannelId)
    }

    var newVal = val ? parseInt(val, 10) + _pointVal : _pointVal
    db.put(rest[0], newVal, handlePutError)
  })
  return rtm.sendMessage(`Adding ${pointMessage(_pointVal)} for ${rest[0].toUpperCase()} :fire:`, DMChannelId)
}

function pointValue (points, args) {
  var _points = parseInt(points, 10)
  if (isNaN(_points)) {
    // filter through the args for any number like thing and return 1st one
    return args.filter(a => typeof parseInt(a, 10) === 'number')[0] || 0
  }
  return _points
}

function pointMessage (pt) {
  // return a value adn  the string point / points depending on the value
  return Math.abs(pt) === 1 ? `${pt} point` : `${pt} points`
}

function getScore (args) {
  var [user, ...rest] = args._
  let userId = stripBrackets(user)
  if (channelMembers.indexOf(userId) < 0) {
    console.log('user: ', userId)
    return rtm.sendMessage(`hey uh @jared.fowler? I got an error getting these points for ${user}...wanna take a :eyes:?`, DMChannelId)
  }
  var getUserScore = scoreFor(user)
  db.get(user, getUserScore)
}

function scoreFor (userId) {
  return function getUserScore (err, val) {
    if (err) {
      console.error(new Error(err))
      return rtm.sendMessage(`hey uh @jared.fowler? I got an error (${err}) getting these points...wanna take a :eyes:?`, DMChannelId)
    }
    return rtm.sendMessage(`Score for ${userId.toUpperCase()} is ${val}`, DMChannelId)
  }
}

function handlePutError (err) {
  if (err) {
    console.error(new Error(err))
    return rtm.sendMessage(`hey uh @jared.fowler? I got an error saving these points: ${err}`, DMChannelId)
  }
}
