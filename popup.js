var Popup = function() {
    this.initialize();
};

Popup.prototype = {
    bg: null,
    history: null,
    initialize: function() {
        this.bg = chrome.extension.getBackgroundPage();
    },
    start: function() {
        this.assignEventHandlers();
        this.loadHistory();
        this.setCurrentLongUrl();
    },
    assignEventHandlers: function() {
        $("login_link").onclick = this.bg.gl.getOAuthWindow().createOpenerOnClick();
        $("input_long_url").onclick = this.selectInputLongUrl.bind(this);
        $("shorten").onclick = this.onClickShorten.bind(this);
        $("input_short_url").onclick = this.onClickShortUrl.bind(this);
        $("clear_timer").onclick = this.onClickClearTimer.bind(this);
    },
    isInvalidCredential: function(req) {
        if (req.status == 401) {
            this.setDisplayMode(true);
            return true;
        }
        return false;
    },
    setDisplayMode: function(needLogin) {
        this.setVisible($("login_pane"), needLogin);
        this.setVisible($("history_table"), !needLogin);
    },
    loadHistory: function() {
        this.setLoadHistoryProgressVisible(true);
        var result = this.bg.gl.lookupUserHistory({
            onSuccess: function(req) {
                this.history = req.responseJSON.items;
                this.setPaginator();
                this.showHistory(0);
            }.bind(this),
            onFailure: function(req) {
                this.isInvalidCredential(req);
            }.bind(this),
            onComplete: function(req) {
                this.setLoadHistoryProgressVisible(false);
            }.bind(this)
        });
        if (!result) {
            this.setLoadHistoryProgressVisible(false);
            this.setDisplayMode(true);
        }
    },
    setLoadHistoryProgressVisible: function(visible) {
        this.setVisible($("history_table_progress"), visible);
        this.setVisible($("history_table"), !visible);
    },
    onClickShortUrlLink: function(url) {
        this.setShortUrl(url);
    },
    showHistory: function(startIndex) {
        var tmpl = "<tr><td><div class='long_url'><a href='${longUrl}' target='_blank'>${longUrl}</a></div></td><td><div class='short_url'><a href='${shortUrl1}' onclick='popup.onClickShortUrlLink(\"${shortUrl1}\")' title='Start watching'>${shortUrl2}</a></div></td><td><div class='click_count'>${clickCount}</div></td></tr>";
        var table = $("history_table_table");
        table.innerHTML = "";
        var items = this.history;
        var count = Math.min(startIndex + 10, items.length);
        for (var i = startIndex; i < count; i++) {
            var item = items[i];
            table.innerHTML += tmpl.replace(/\$\{longUrl\}/g, item.longUrl)
                .replace(/\$\{shortUrl1\}/g, item.id)
                .replace("${shortUrl2}", item.id.substring(7))
                .replace("${clickCount}", item.analytics.allTime.shortUrlClicks);
        }
    },
    setPaginator: function() {
        $("paginator").innerHTML = "";
        var len = this.history.length;
        var cnt = 1;
        for (var i = 0; i < len; i += 10) {
            if (cnt == 1) {
                $("paginator").innerHTML = "Page: ";
            }
            var link = document.createElement("a");
            link.href = "#";
            link.onclick = (function(n) {
                return function() {
                    this.showHistory(n);
                }.bind(this);
            }.bind(this))(i);
            link.innerHTML = cnt++;
            $("paginator").appendChild(link);
        }
    },
    setCurrentLongUrl: function() {
        chrome.tabs.getSelected(null, function(tab) {
            $("input_long_url").value = tab.url;
        }.bind(this));
    },
    selectInputLongUrl: function() {
        $("input_long_url").focus();
        $("input_long_url").select();
    },
    clearShortenResult: function() {
        $("input_short_url").value = "";
        this.setMessage("", false);
        this.setTwitter("");
        this.setUrlDetail("");
    },
    onClickShorten: function() {
        var url = $("input_long_url").value;
        if (url) {
            this.setVisibleForm($("shorten"), false);
            this.setVisibleForm($("shorten_progress"), true);
            this.clearShortenResult();
            this.bg.gl.shortenLongUrl(url, {
                onSuccess: function(req) {
                    this.setShortUrl(req.responseJSON.id);
                    if (this.bg.gl.coudlGetHistory()) {
                        this.loadHistory();
                    }
                }.bind(this),
                onFailure: function(req) {
                    $("input_short_url").value = "http://goo.gl/...";
                    if (!this.isInvalidCredential(req)) {
                        this.setMessage(req.status + "(" + req.statusText + ") "
                                        + req.responseJSON.error.message,
                                        true);
                    }
                }.bind(this),
                onComplete: function(req) {
                    this.setVisibleForm($("shorten"), true);
                    this.setVisibleForm($("shorten_progress"), false);
                }.bind(this)
            });
        }
    },
    setShortUrl: function(shortUrl) {
        $("input_short_url").value = shortUrl;
        this.setMessage("Copied shorten URL to clipboard. Watching started.", false);
        this.setTwitter(shortUrl);
        this.setUrlDetail(shortUrl);
        this.onClickShortUrl();
        document.execCommand("copy");
        this.bg.gl.startWatchCount(shortUrl);
    },
    setVisible: function(elem, visible) {
        Element.setStyle(elem, {
            display: visible ? "block" : "none"
        });
    },
    setVisibleForm: function(elem, visible) {
        Element.setStyle(elem, {
            display: visible ? "inline-block" : "none"
        });
    },
    setMessage: function(message, error) {
        Element.setStyle($("message"), {
            color: error ? "red" : "green"
        });
        $("message").innerHTML = message;
        setTimeout(function() {
            this.setMessage("", false);
        }.bind(this), 5000);
    },
    setTwitter: function(url) {
        $("twitter").innerHTML = "";
        if (url) {
            var a = document.createElement("a");
            a.setAttribute("href", "https://twitter.com/share");
            a.setAttribute("class", "twitter-share-button");
            a.setAttribute("data-count", "none");
            a.setAttribute("data-url", url);
            a.innerHTML = "Tweet";
            var script = document.createElement("script");
            script.setAttribute("type", "text/javascript");
            script.setAttribute("src", "http://platform.twitter.com/widgets.js");
            a.appendChild(script);
            $("twitter").appendChild(a);
            this.setVisible($("twitter"), true);
        } else {
            this.setVisible($("twitter"), false);
        }
    },
    setUrlDetail: function(url) {
        $("url_detail").innerHTML = "";
        if (url) {
            var array = url.split("/");
            $("url_detail").innerHTML =
                "<a href='http://goo.gl/info/"
                + array[array.length - 1]
                + "' target='_blank'>Detail</a>";
            this.setVisible($("url_detail"), true);
        } else {
            this.setVisible($("url_detail"), false);
        }
    },
    onClickShortUrl: function() {
        $("input_short_url").focus();
        $("input_short_url").select();
    },
    onClickClearTimer: function() {
        this.bg.gl.startWatchCount(null);
    }
};

var popup = new Popup();
