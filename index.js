var RtmClient = require('@slack/client').RtmClient
var CLIENT_EVENTS = require('@slack/client').CLIENT_EVENTS
var RTM_EVENTS = require('@slack/client').RTM_EVENTS
var keys = require('./key.json').SLACK_BOT_TOKEN
var bot_token = keys.SLACK_BOT_TOKEN
var CATEGORYLIST = require('./category-list.json')
var groupName = keys.GROUP_NAME
var rtm = new RtmClient(bot_token)

var channel
var channelMembers = []
// The client will emit an RTM.AUTHENTICATED event on successful connection, with the `rtm.start` payload if you want to cache it
rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, function (rtmStartData) {
  for (let c of rtmStartData.groups) {
    if (c.name = groupName) {
      channel = c.id
      channelMembers = c.members.map(m => m.toLowerCase())
    }
  }
  console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name} on channel ${channel}`);
});

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, function () {
  // rtm.sendMessage('HEYYY', channel)
})

rtm.on(RTM_EVENTS.MESSAGE, function onMessage(msg) {
  if (isToPunbot(msg.text)) {
    let msgArray = msg.text.split(' ').map(xs => xs.toLowerCase())
    // check commands
    if (msgArray[1] === 'new') {
      // roll another pun
      let whitePun = getRandomCategory(CATEGORYLIST.white)
      let greenPun = getRandomCategory(CATEGORYLIST.green)
      rtm.sendMessage(':zap: *Punderdome on Slack* :zap: \n\n ' + whitePun + '::' + greenPun, msg.channel)
    } else if (msgArray[1] == '++' ) {
      // points for someone... check they are in the group
      if (channelMembers.indexOf(stripBrackets(msgArray[2])) < 0) {
        // they aren't in the group
        rtm.sendMessage('Hi <@' + msg.user + '>! I tried to add points to ' + msgArray[2] + ' but couldnt find them in our channel :-( \n Try again!', msg.channel)
      } else {
        rtm.sendMessage('Adding one point for ' + msgArray[2] + ' :fire:')
      }
    }
  }
})

rtm.start();

function isToPunbot (msgText) {
  return /U85AZNDSS/.test(msgText);
}

function getRandomCategory(list) {
  var len = list.length
  var randIdx = Math.floor(Math.random() * len)
  return list[randIdx]
}

function stripBrackets (userId) {
  // <@ABC123> => ABC123
  return userId.replace('<@', '').replace('>', '')
}
