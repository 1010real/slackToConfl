# slackToConfl
slackでpinをつけたコメント内のサイト情報を抜き出し、confluence内にリンク集ページを作成

## Config
- slackにアクセスするためのtokenを発行し、環境変数$SLACK_TOKENに設定
- conflのユーザ名、パスワードをそれぞれ環境変数$CONFL_USERNAME, $CONFL_PASSWORDに設定

## How to use
    node index.js [Confluenceスペース名] [slackチャンネル名1] .. [slackチャンネル名N]
