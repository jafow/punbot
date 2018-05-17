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
var concat = require('concat-stream')
var levelup = require('levelup')
var leveldown = require('leveldown')
var shuffle = require('array-shuffle')

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
    name: 'SUBTRACT',
    command: subtractPoints
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
    name: 'SHUFFLE',
    command: newDeck
  },
  {
    name: 'DEAL',
    command: dealCard
  },
  {
    name: 'HELP',
    command: function (args) {
      var [cat, msg] = args._
      rtm.sendMessage(`\r Punbot knows these commands:
           \`new pun:\`\t rolls a new category\r\r
          ------
           \`add <number> <@slack username>\`:\tadds <number> points to <@slack user>\r\r
           for example: \`@punbot add 10 @jared.fowler\`\r\r
          -------
           \`subtract <number> <@slack username>\`:\tsubtracts <number> points from <@slack user>\r
           for example: \`@punbot subtract 10 @jared.fowler\`\r\r
          ------
           \`points <@slack username>\`: \tgets <@slack username's> total score\r
           for example: \`@punbot points @jared.fowler\` \r\r
          ------
           \`shuffle \`: \tcreates a deck of cards and shuffles them\r
           for example: \`@punbot shuffle\` \r\r
          ------
           \`deal\`: \tdeals a card from the deck\r
           for example: \`@punbot deal\` \r\r
          ------
          `, msg.channel)
    }
  }
]
var match = subcommand(commands)
var concatStream = concat(sortScores)
var BOT_ID = ''

// card dealing
var DECK = []

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  if (PROD) {
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
  if (msg.type === 'error') {
    return rtm.sendMessage('sorry there was an error: ', msg.error.msg, msg.channel)
  }
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

// start it up
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
  if (arr.toUpperCase() === 'PUN') {
    // TODO: add check for new 'GAME' to reset game
    return rtm.sendMessage(`\r:zap: *It's time for a pun!* :zap: \r\r\t ${category.noun} :: ${category.verb}`, msg.channel)
  } else if (arr.toUpperCase() === 'GAME') {
    rtm.sendMessage(`\r:zap: *Ohh buddy it's PUN time!* :zap: \r\r`, msg.channel)
    return setupNewGame(msg)
  } else {
    return rtm.sendMessage(`\r:zap: *It's time for a pun!* :zap: \r\r\t ${category.noun} :: ${category.verb}`, msg.channel)
  }
}

function addPoints (args) {
  var [points, userId, ...rest] = args._
  var msg = !rest.length ? userId : rest[1]
  var pointVal = parseInt(points, 10)

  if (isNaN(pointVal) || typeof userId === 'object') {
    // didn't provide a user to add points to
    rtm.sendMessage('hey uh @jared.fowler? I got an error adding these points...wanna take a :eyes:?: ' + JSON.stringify(args._), DMChannelId)
    return rtm.sendMessage('I had an error so here\'s a joke instead: \r Did you know I was named after Abraham Lincoln? \r yup, he was born like a long time ago and his parents called him Abe or whatever and I was just made like a few days ago. Get it? After? \r:fire: :peace_symbol::door:', msg.channel)
  }

  updatePointsFor(userId, pointVal, addPointsFn)
  return rtm.sendMessage(`Adding ${pointMessage(pointVal)} for ${userId.toUpperCase()} :fire:`, msg.channel)
}

function subtractPoints (args) {
  var [points, userId, ...rest] = args._
  var msg = !rest.length ? userId : rest[1]
  var pointVal = parseInt(points, 10)

  if (isNaN(pointVal) || typeof userId === 'object') {
    // didn't provide a user to add points to
    rtm.sendMessage('hey uh @jared.fowler? I got an error subtracting these points...wanna take a :eyes:?: ' + JSON.stringify(args._), DMChannelId)
    return rtm.sendMessage('I had an error so here\'s a joke instead: \r Q: what is a punbot\'s favorite music? \r....\rA: punkrock. :peace_symbol:', msg.channel)
  }

  updatePointsFor(userId, pointVal, subtractPointsFn)

  return rtm.sendMessage(`:frowning: Subtracting ${pointMessage(pointVal)} for ${userId.toUpperCase()} :frowning::`, msg.channel)
}

/** updatePointsFor
 * @param {string} userId user id to update points for
 * @param {number} newPoints the value of new points to update by
 * @param {function} pointsFn callback for operating on the points to be put
 */
function updatePointsFor (userId, newPoints, pointsFn) {
  db.get(userId, function (err, val) {
    if (err) {
      console.error(new Error(err))
      rtm.sendMessage(` :-( I got an error saving these points: ${JSON.stringify(err)}`, DMChannelId)
    }

    var newVal = pointsFn(val, newPoints)
    db.put(userId, newVal, handlePutError)
  })
}
/** addPointsFn
 * @param {string} currentVal current user points value (if any) that's returned from db.get
 * @param {number} newVal new value to update score by
 * @return {number} the sum of current (if exists) and new value to be PUT to db
 */
function addPointsFn (currentVal, newVal) {
  if (!currentVal) {
    return newVal
  }
  return parseInt(currentVal, 10) + newVal
}
/** subtractPointsFn
 * @param {string} currentVal current user points value (if any) that's returned from db.get
 * @param {number} newVal new value to update score by
 * @return {number} the difference of current (if exists) and new value to be PUT to db
 */
function subtractPointsFn (currentVal, newVal) {
  if (!currentVal) {
    return newVal
  }
  return parseInt(currentVal, 10) + -newVal
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
  var getUserScore = scoreFor(user, msg)
  db.get(user, getUserScore)
}

function getTotalScore (args) {
  var [category, msg] = args._

  rtm.sendMessage(`:star: Score Board :star:\r`, msg.channel || DMChannelId)

  db.createReadStream()
    .on('error', handleReadError)
    .pipe(concatStream)
}

function scoreFor (userId, msg) {
  return function getUserScore (err, val) {
    if (err) {
      console.error(new Error(err))
      return rtm.sendMessage(`hey uh @jared.fowler? I got an error (${err}) getting these points...wanna take a :eyes:?`, DMChannelId)
    }
    return rtm.sendMessage(`Score for ${userId.toUpperCase()} is ${val}`, msg.channel || DMChannelId)
  }
}

function handlePutError (err) {
  if (err) {
    console.error(new Error(err))
    return rtm.sendMessage(`hey uh @jared.fowler? I got an error saving these points: ${err}`, DMChannelId)
  }
}

function handleReadError (err) {
  if (err) {
    console.error(new Error(err))
    return rtm.sendMessage(`hey uh @jared.fowler? I got an error reading all user points: ${err}`, DMChannelId)
  }
}

function setupNewGame (msg) {
  var opts = channelMembers.map(member => ({'type': 'put', 'key': `<@member>`, value: 0}))
  db.batch(opts, function (err) {
    if (err) {
      console.error(new Error(err))
      return rtm.sendMessage(`hey uh @jared.fowler? I got an error (${err}) making a new game...wanna take a :eyes:? ${JSON.stringify(err)}`, DMChannelId)
    }
    return rtm.sendMessage(`.... creating ... new .... game \`beep boop\``, msg.channel || DMChannelId)
  })
}

function sortScores (data) {
  var list = data.map((rec) => {
    let {key, value} = rec
    return { key: key.toString(), value: parseInt(value, 10) }
  })

  var sorted = list.sort((a, b) => a.value < b.value)

  var scoreBoard = sorted.reduce((curr, next, idx) => {
    curr += `--------\r${idx + 1}: ${next.key}\t\t${next.value}\r`
    return curr
  }, ``)

  rtm.sendMessage(scoreBoard, channel || DMChannelId)
}

function newDeck (args) {
  var [_, msg] = args._

  var suits = '♡♢♠♣'
  var counts = '23456789TJQKA'

  DECK = []

  for (let i = 0; i < counts.length; i++) {
    for (let j = 0; j < suits.length; j++) {
      DECK.push(counts[i] + suits[j])
    }
  }

  DECK = shuffle(DECK)

  rtm.sendMessage('New Deck Created...beep boop\n', msg.channel || DMChannelId)
}

function dealCard (args) {
  var [_, msg] = args._
  var channel = msg.channel

  if (DECK.length < 1 || !DECK) {
    rtm.sendMessage(`hey uh @jared.fowler? I got an error getting a new card from the DECK... take a :eyes:?`, DMChannelId)
    return rtm.sendMessage('I had an error drawing a card; the game maybe is over? Try running the @punbot SHUFFLE command. \r Anyway, here\'s a joke for your time: \r Q: something something meme...\r....\rA: A millenial! \r', channel)
  }
  var card = DECK.shift() || 'JOKER!!!'

  rtm.sendMessage(`You draw a ${card}\n`, channel)
}
