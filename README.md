# punbot
A slack :robot: that instigates a pun game and keeps score for you.

## Usage
[Set up a bot with slack.](https://api.slack.com/bot-users)

Then make a `key.json` file that looks like this:
```json
{
    "SLACK_BOT_TOKEN": <your slack token>,
    "GROUP_NAME": <name of your slack group>
}
```

Install dependencies:
```sh
npm install
```

Start the bot:
```sh
npm run live
```

## LICENSE
MIT
