
chrome.runtime.onInstalled.addListener(function() {
    chrome.action.disable();
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [new chrome.declarativeContent.PageStateMatcher({
                pageUrl: {hostEquals: 'mp.weixin.qq.com'},
            })
            ],
                actions: [new chrome.declarativeContent.ShowAction()]
        }]);
    });
});
