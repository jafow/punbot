var RtmClient = require('@slack/client').RtmClient
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
var RTM_EVENTS = require('@slack/client').RTM_EVENTS

var keys = require('./key.json')
var token = keys.SLACK_BOT_TOKEN
var groupName = keys.GROUP_NAME
var CATEGORYLIST = require('./category-list.json')
var PROD = process.env.NODE_ENV === 'PROD'

var rtm = new RtmClient(token)

var subcommand = require('subcommand')
var levelup = require('levelup')
var leveldown = require('leveldown')

var db = levelup(leveldown('./mydb'))
var channel
var channelMembers = []

var commands = [
  {
    name: 'NEW',
    command: handleNew
  },
  {
    name: 'ADD',
    command: addPoints
  },
  {
    name: 'POINTS',
    command: getScore
  },
  {
    name: 'LEADERBOARD',
    command: getTotalScore
  },
  {
    name: 'HELP',
    command: function (args) {
      var [a, cat, msg] = args._
      rtm.sendMessage(`\r Punbot knows these 3 commands: 
           \`new pun: rolls a new category\`
           score <number> <@slack username>: adds <number> points to <@slack user>
              for example: @punbot score 10 @jared.fowler
           get <@slack username>: gets <@slack username's> total score
          `, msg.channel)
    }
  }
]
var match = subcommand(commands)
var BOT_ID = ''
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  if (!PROD) {
    for (let c of rtmStartData.groups) {
      if (c.name.toUpperCase() === groupName.toUpperCase()) {
        channel = c.id
        channelMembers = c.members.map(m => m.toUpperCase())
      }
    }
  }
  for (let c of rtmStartData.users) {
    if (!PROD && c.name === 'jared.fowler') {
      channel = c.id
      channelMembers.push(c.id.toUpperCase())
    }
    if (c.name === 'punbot') {
      BOT_ID = c.id
    }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name} on channel ${channel}`)
})

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  // rtm.sendMessage('HEYYY', channel)
})
rtm.on(RTM_EVENTS.MESSAGE, function onMessage (msg) {
  if (isToPunbot(msg.text)) {
    let msgArray = msg.text.split(' ').map(xs => xs.toUpperCase())
    let punbotIndex = msgArray.indexOf(`<@${BOT_ID}>`)
    let category = {
      noun: getRandomCategory(CATEGORYLIST.white),
      verb: getRandomCategory(CATEGORYLIST.green)
    }

    var matched = match(msgArray.slice(punbotIndex + 1).concat(category, msg))
    if (!matched) {
      return rtm.sendMessage('... whuh? sorry didn\'t get that last part', msg.channel)
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
  var re = new RegExp(BOT_ID)
  return re.test(msgText)
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
  var [arr, category, msg] = args._
  if (arr[0].toUpperCase() === 'PUN') {
    // TODO: add check for new 'GAME' to reset game
    return rtm.sendMessage(`\r:zap: *It's time for a pun!* :zap: \r\r\t ${category.noun} :: ${category.verb}`, msg.channel)
  }
  return rtm.sendMessage(`\r:zap: *It's time for a pun!* :zap: \r\r\t ${category.noun} :: ${category.verb}`, msg.channel)
}

function addPoints (args) {
  var [points, userId, ...rest] = args._
  var msg = !rest.length ? userId : rest[1]
  var _pointVal = parseInt(points, 10)

  if (isNaN(_pointVal) || typeof userId === 'object') {
    // didn't provide a user to add points to
    rtm.sendMessage('hey uh @jared.fowler? I got an error saving these points...wanna take a :eyes:?: ' + JSON.stringify(args._), DMChannelId)
    return rtm.sendMessage('I had an error so here\'s a joke instead: \r Q: what is a punbot\'s favorite music? \r....\rA: punkrock. :peace_symbol:', msg.channel)
  }

  db.get(userId, function (err, val) {
    if (err) {
      console.error(new Error(err))
      rtm.sendMessage(` :-( I got an error saving these points: ${JSON.stringify(err)}`, DMChannelId)
    }

    var newVal = val ? parseInt(val, 10) + _pointVal : _pointVal
    db.put(userId, newVal, handlePutError)
  })
  return rtm.sendMessage(`Adding ${pointMessage(_pointVal)} for ${userId.toUpperCase()} :fire:`, msg.channel)
}

function pointMessage (pt) {
  // return a value adn  the string point / points depending on the value
  return Math.abs(pt) === 1 ? `${pt} point` : `${pt} points`
}

function getScore (args) {
  var [user, ...rest] = args._
  var msg = rest.pop()

  if (!user) {
    return rtm.sendMessage(`hey uh @jared.fowler? I got an error saving these points: no userid provided to getScore`, DMChannelId)
  }
  let userId = stripBrackets(user)
  if (channelMembers.indexOf(userId) < 0) {
    rtm.sendMessage(`hey uh @jared.fowler? I got an error getting these points for ${user}...wanna take a :eyes:?`, DMChannelId)
    return rtm.sendMessage('I had an error so here\'s a classic: \r Q: what is brown and sticky? \r....\rA: A stick! \r', msg.channel)
  }
  var getUserScore = scoreFor(user)
  db.get(user, getUserScore)
}

function getTotalScore (args) {
  var [category, msg] = args._
  var allUsers = channelMembers.map(m => `<@${m}>`)

  db.get(allUsers, function (err, vals) {
    if (err) {
      console.error(err)
    }
    // TODO: print these out nicely
  })
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
