var RtmClient = require('@slack/client').RtmClient
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var keys = require('./key.json').SLACK_BOT_TOKEN
var token = keys.SLACK_BOT_TOKEN
var CATEGORYLIST = require('./category-list.json')
var groupName = keys.GROUP_NAME
var rtm = new RtmClient(token)

var channel
var channelMembers = []
// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload if you want to cache it
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  for (let c of rtmStartData.groups) {
    if (c.name.toLowerCase() === groupName.toLowerCase()) {
      channel = c.id
      channelMembers = c.members.map(m => m.toLowerCase())
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
      let whitePun = getRandomCategory(CATEGORYLIST.white)
      let greenPun = getRandomCategory(CATEGORYLIST.green)
      rtm.sendMessage(':zap: *Punderdome on Slack* :zap: \n\n ' + whitePun + '::' + greenPun, msg.channel)
    } else if (msgArray[1] === 'score') {
      // points for someone... check they are in the group
      if (channelMembers.indexOf(stripBrackets(msgArray[3])) < 0) {
        // they aren't in the group
        rtm.sendMessage('Hi <@' + msg.user + '>! I tried to add points to ' + msgArray[3] + ' but couldnt find them in our channel :-( \n Try again!', msg.channel)
      } else {
        rtm.sendMessage(`Adding one point for ${msgArray[3].toUpperCase()} :fire:`, msg.channel)
      }
    }
  }
})
// TEMP FOR TESTING
let DMChannelId = 'D83R2HSFJ'

// write message from standard in to a (for now) hardcoded channel!?
process.stdin.on('data', function (d) {
  let data = d.toString().trim()
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
  return userId.replace('<@', '').replace('>', '')
}
