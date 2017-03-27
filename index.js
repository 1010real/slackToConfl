// config slack
let token = process.env.SLACK_TOKEN;
// let channelName = 'rss_test';
let channelNames = process.argv.slice(3); // コマンドライン第2引数以降
// config confluence
// let spacekey = "~okamoto-masao";
let spacekey = process.argv[2]; // コマンドライン第1引数 注:~を含むスペースを指定するときは前にバックスラッシュをつけること
let username = process.env.CONFL_USERNAME;
let password = process.env.CONFL_PASSWORD;

// require module and define global variables
const http = require('http');
const https = require('https');
const querystring = require('querystring');

let channelIds, pinnedItemResults;

// apiを叩くためのclass
class Postreq {
    constructor(protocol = 'http', hostname = '', path= '/', method='POST', headers={ 'Content-Type': 'application/json' }, encoding='utf8') {
        // console.log('postreq constructor', arguments);
        if (typeof protocol === 'object') {
            let setting = protocol;
            this.protocol = setting.protocol;
            this.hostname = setting.hostname || hostname;
            this.path = setting.path || path;
            this.method = setting.method || method;
            this.headers = setting.headers || headers;
            this.encoding = setting.encoding || encoding;
        } else {
            this.protocol = protocol;
            this.hostname = hostname;
            this.path = path;
            this.method = method;
            this.headers = headers;
            this.encoding = encoding;
        }

        this.httpObj = null;
        if (this.protocol === 'http') {
            this.httpObj = http;
        } else if (this.protocol === 'https') {
            this.httpObj = https;
        }
        // console.log('postreq initialized', this);
    }
    post(postDataString = '') {
        let options = {
            hostname: this.hostname,
            path: this.path,
            method: this.method,
            headers: this.headers,
        };

        return new Promise((_resolve, _reject) => {
            let req = this.httpObj.request(options, (_res) => {
                _res.setEncoding(this.encoding);
                let _body = Buffer.from('');
                _res.on('data', (_chunk) => {
                    // console.log(`BODY: ${_chunk}`);
                    // _body = Buffer.concat([_body, _chunk], _body.length + _chunk.length)
                    _body = _body + _chunk;
                });
                _res.on('end', () => {
                    _resolve( { response:_res, body:JSON.parse(_body) } );
                });
            });

            req.on('error', (_error) => {
                console.log(`problem with request: ${_error.message}`);
                _reject( { msg:'an error occured.', error:_error } );
            });

            req.write(postDataString);
            req.end();
        });
    }
}

// slackApiを叩くためのクラス
class PostreqSlack extends Postreq {
    constructor(protocol = 'https', hostname = 'slack.com', path= '/', method='POST', headers={ 'Content-Type': 'application/x-www-form-urlencoded' }, encoding='utf8') {
        console.log('PostreqSlack constructor', arguments);
        if (typeof protocol === 'object') {
            let setting = protocol;
            protocol = setting.protocol || 'https';
            hostname = setting.hostname || hostname;
            path = setting.path || path;
            method = setting.method || method;
            headers = setting.headers || headers;
            encoding = setting.encoding || encoding;
        }
        super(protocol, hostname, path, method, headers, encoding);
    }
    post(postData = {}){
        let postDataString = querystring.stringify(postData);
        this.headers['Content-Length'] = postDataString.length;
        return super.post(postDataString);
    }
}

// conflApiを叩くためのクラス
class PostreqConfl extends Postreq {
    constructor(protocol = 'https', hostname = 'confl.arms.dmm.com', path= '/', method='POST', headers={ 'Content-Type':'application/json' }, encoding='utf8') {
        console.log('PostreqConfl constructor', arguments);
        if (typeof protocol === 'object') {
            let setting = protocol;
            protocol = setting.protocol || 'https';
            hostname = setting.hostname || hostname;
            path = setting.path || path;
            method = setting.method || method;
            headers = setting.headers || headers;
            encoding = setting.encoding || encoding;
        }
        super(protocol, hostname, path, method, headers, encoding);
    }
    setBasicAuthHeader(username, password){
        let auth = new Buffer(username + ":" + password).toString('base64');
        this.headers['Authorization'] = 'Basic ' + auth;
    }
    post(postData = {}){
        let postDataString = JSON.stringify(postData);
        return super.post(postDataString);
    }
}

// 認証テスト
let checkAuth = (_token) => {
    let postData = { token:_token };
    let postReqCheckAuth = new PostreqSlack({
        path: '/api/auth.test',
    });
    return new Promise((_resolve, _reject) => {
        console.log('check authorization start.');
        postReqCheckAuth.post(postData).then(
            ( _res ) => {
                if (_res.body.ok) {
                    _resolve( _res );
                } else {
                    _reject( { msg:'check authorization : failed response. error message -> ', error:_res.body.error } );
                }
            },
            ( _res ) => {
                _reject( _res );
            }
        );
    })
};

// チャンネルリストを取得
let getChannelsList = (_token) => {
    console.log('get channels list start.');
    let postData = { token:_token };
    let postReqGetChannelsList = new PostreqSlack({
        path: '/api/channels.list',
    });
    return new Promise((_resolve, _reject) => {
        postReqGetChannelsList.post(postData).then(
            ( _res ) => {
                // console.log('-------------');
                // console.log(JSON.parse(_res.body).channels);
                if (_res.body.ok) {
                    let _channelsMap = {};
                    _res.body.channels.forEach((_element) => {
                        _channelsMap[_element.name] = _element.id;
                    });
                    _resolve( { response:_res.response, body:_res.body, value:_channelsMap } );
                } else {
                    _reject( { msg:'get channels list : failed response. error message -> ', error:_res.body.error } );
                }

            },
            ( _res ) => {
                _reject( _res );
            }
        );
    })
};

// 指定チャンネルのpinされたアイテムを取得
let getPinnedItem = (_token, _channel) => {
    console.log('get pinned item start.', 'channnel -> ' + _channel);
    let postData = { token:_token, channel:_channel };
    let postReqGetPinnedItem = new PostreqSlack({
        path: '/api/pins.list',
    });
    return new Promise((_resolve, _reject) => {
        postReqGetPinnedItem.post(postData).then(
            ( _res ) => {
                let _pinnedItem = {};
                if (_res.body.ok) {
                    _resolve( { response:_res.response, body:_res.body, value:_pinnedItem } );
                } else {
                    _reject( { msg:'get pinned item : failed response. error message -> ', error:_res.body.error } );
                }
            },
            ( _res ) => {
                _reject( _res );
            }
        );
    })
};

// ページを作成
let createPage = (_username, _password, _space_key, _title, _doc) => {
    console.log('create page start.');
    // console.log(_doc);
    let postData = {
        "type": "page",
        "title": _title,
        "space": {
            "key": _space_key
        },
        "body": {
            "storage": {
                "value": _doc,
                "representation": "storage"
            }
        }
    };

    let postReqCreatePage = new PostreqConfl({
        path: '/rest/api/content/',
    });
    postReqCreatePage.setBasicAuthHeader(_username, _password);
    return new Promise((_resolve, _reject) => {
        postReqCreatePage.post(postData).then(
            ( _res ) => {
                if (_res.response.statusCode === 200) {
                    _resolve( _res );
                } else {
                    _reject( { msg:'create page : failed response. error message -> ', error:_res.body.message } );
                }
            },
            ( _res ) => {
                _reject( _res );
            }
        );
    })
};

// Remove a pinned item
let removePinnedItem = (_token, _pinnedItem) => {
    console.log('remove pinned item start.', 'pinnedItem created at ->' + _pinnedItem.created);
    console.log(_token, _pinnedItem.channel, _pinnedItem.message.ts);
    let postData = { token:_token, channel:_pinnedItem.channel, timestamp:_pinnedItem.message.ts };
    let postReqRemovePinnedItem = new PostreqSlack({
        path: '/api/pins.remove',
    });
    return new Promise((_resolve, _reject) => {
        postReqRemovePinnedItem.post(postData).then(
            ( _res ) => {
                // console.log('remove pins item response. start ----- ');
                // console.log(_res);
                // console.log('remove pins item response. end ----- ');
                if (_res.body.ok) {
                    _resolve( { response:_res.response, body:_res.body } );
                } else {
                    _reject( { msg:'remove pinned item : failed response. error message -> ', error:_res.body.error } );
                }
            },
            ( _res ) => {
                _reject( _res );
            }
        );
    })
};

// メイン処理
checkAuth(token)
.then(
    ( _res ) => {
        console.log('auth ok.');
        console.log("========================================");
        return getChannelsList(token);
    }
)
.then(
    ( _res ) => {
        console.log('get channels list ok.');
        console.log("========================================");
        channelIds = _res.value;
        return Promise.all(channelNames.map((channelName) => {
            return getPinnedItem(token, channelIds[channelName]);
        }));
    }
)
.then(
    ( _res ) => {
        console.log('get pinned item ok.');
        console.log("========================================");
        pinnedItemResults = _res; // 各チャンネルからの取得結果が配列で入ってくる

        function escapeXhtmlEntities(text) {
            let result = text;
            result = result.replace(/\&/g, "&amp;");
            result = result.replace(/\</g, "&lt;");
            result = result.replace(/\>/g, "&gt;");
            result = result.replace(/\\/g, "&quot;");
            result = result.replace(/\'/g, "&apos;");
            return result;
        }

        let htmlText, titleText;
        let d = new Date();
        // titleText = "今週の気になった記事" + d.toLocaleDateString();
        titleText = "テスト" + d.toLocaleString();
        htmlText = "";
        pinnedItemResults.forEach((pinnedItemResult, index) => {
            let pinnedItems = pinnedItemResult.body.items;
            let tmp = "<h2>" + channelNames[index] + "</h2>";
            if (pinnedItems.length > 0) {
                tmp += "<table border=\"0\">";
                pinnedItems.forEach((_element) => {
                    tmp += "<tr><td style=\"border-left:none;border-right:none;\">"
                        + "<img src=\"" + escapeXhtmlEntities(_element.message.attachments[0].service_icon) + "\" style=\"vertical-align:bottom; height:20px;\" />"
                        + "<span style=\"color:gray;\">" + escapeXhtmlEntities(_element.message.attachments[0].service_name) + "</span><br />"
                        + "<a href=\"" + escapeXhtmlEntities(_element.message.attachments[0].title_link) + "\">"
                        + escapeXhtmlEntities(_element.message.attachments[0].title)
                        + "</a><br />"
                        + escapeXhtmlEntities(_element.message.attachments[0].text)
                        + "</td></tr>";
                });
                tmp += "</table>";
            }
            htmlText += tmp;
        })

        // console.log(titleText, htmlText)

        return createPage(username, password, spacekey, titleText, htmlText);
    }
)
.then(
    ( _res ) => {
        // console.log("========================================+");
        // console.log(_res);
        // console.log("========================================+");
        console.log('create page ok.');
        // console.log(_res);
        console.log("========================================");
        // console.log(pinnedItemResults[0]);
        // console.log("========================================+");
        // console.log(JSON.stringify(pinnedItemResults[0].body.items));
        return Promise.all(pinnedItemResults.map((pinnedItemResult) => {
            return Promise.all(pinnedItemResult.body.items.map((pinnedItem) => {
                return removePinnedItem(token, pinnedItem);
            }));
        }));
    }
)
.then(
    ( _res ) => {
        console.log('remove pinned item ok.');
        console.log("========================================");
    }
)
.catch(function(obj) {
    console.log('catch!');
    console.log(obj);
    console.log("========================================");
});
