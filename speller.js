/* powered by CodeDim, 2018 */

(function () {
    'use strict';

    var 
        // speller options:
        IGNORE_DIGITS = 2, 
        IGNORE_URLS = 4, 
        FIND_REPEAT_WORDS = 8,
        IGNORE_CAPITALIZATION = 512,
        // speller languages: "[en],[ru],[ua]"
        // speller formats:   "plain | html"
    
        // see the spellservice documentation
        SERVICE = 'https://speller.yandex.net/services/spellservice.json/checkText?',
        MAX_REQUEST_LEN = 10000, 
    
        /* the YaSpeller class */
        YaSpeller = function (lang, options, format, lazyMode=true, debugLevel=0) {
            this.lang = lang || 'ru,en';
            this.opts = options || IGNORE_DIGITS + IGNORE_URLS + FIND_REPEAT_WORDS;
            this.format = format || 'plain';
            this.lazy = lazyMode;
            this.dbgLvl = debugLevel; // 0 = no debag messages to the console
            
            // list of HTML block-elements that can consist text
            var textTagNames = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
                                'p', 'pre', 'li', 'th', 'td', 'blockquote'];
                                // consider as well the following tags:
                                //  <address>, <article>, <aside>, <dt>, <dd>, 
                                //  <figcaption>, <footer>, <header>, <main>, 
                                //  <nav>, <noscript>, <section>, <tfoot>
            
            // array of objects of tag collections and thier necessary attributes
            this.textTags = [];   // each object looks like the following:
            // { tagName               // just a tag name from textTagNames;
            //   collection.length,    // amount of elements in collection;
            //   [innerHTML.lengths],  // lengths of innerHTMLs (after highlighting);
            //   [collection] }        // as returned by getElementsByTagName.
        

            // builds the textTags array for the first time, checks for browser 
            // storage and starts spell checking at onload event if needed 
            this.initInstance = function () {
                // fill out the array of the text tags by collections
                for (var i = 0; i < textTagNames.length; ++i) {
                    this.textTags.push({ 
                        name: textTagNames[i], items: 0, textLengths: [], 
                        collection: document.getElementsByTagName(textTagNames[i])
                    });
                }
                
                // process the document for the first time
                var textCounter = 0;
                for (var i = 0; i < this.textTags.length; ++i) {
                    this.textTags[i].items = this.textTags[i].collection.length;
                    for (var j = 0; j < this.textTags[i].items; ++j) {
                        var len = this.textTags[i].collection[j].innerHTML.length;
                        this.textTags[i].textLengths.push(len);
                        textCounter += len;
                    }
                }
                
                // check out if the document needs to be spell-checked
                var cookieValue = this.getCookie(); // the past textCounter value
                if (cookieValue && cookieValue == textCounter && this.lazy) {
                    // there is nothing to do here
                    return;
                }
                // else, set or update cookieValue
                this.setCookie(textCounter);
                // and forced check the document for spells
                this.checkDocument(true);
            };
            
            // returns current cookie value or undefined
            this.getCookie = function () {
                var name = encodeURIComponent(window.location.href);
                var matches = document.cookie.match(new RegExp(
                    "(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + 
                    "=([^;]*)"
                ));
                return matches ? decodeURIComponent(matches[1]) : undefined;
            };
            
            // sets cookie value with the specific name
            this.setCookie = function (value) {
                var name = encodeURIComponent(window.location.href);
                document.cookie = name + '=' + value;
            };

            // makes and sends a GET request to the spell-cheker service,
            // returns amount of sent bytes or zero if max-length exceeded
            this.sendRequest = function (text, tagIndx, tagNmbr) {
                var xhr = new XMLHttpRequest(), 
                    params = SERVICE + 'text=' + encodeURIComponent(text);
                
                params += '&lang=' + this.lang + '&options=' + this.opts + 
                    '&format=' + this.format;
                if (params.length > MAX_REQUEST_LEN) 
                    return 0; // the text is too big!
                
                xhr.open('GET', params, true);
                var requestCb = function (self, tagIndx, tagNmbr) {
                    if (self.dbgLvl > 1) {
                        console.log('speller:< %s[%d]: %s (%d)', 
                            self.textTags[tagIndx].name, tagNmbr, 
                            xhr.statusText, xhr.status);
                    }
                    
                    if (xhr.status == 200) {
                        var result = JSON.parse(xhr.responseText);
                        
                        if (self.dbgLvl > 0) {
                            var format = (result.length == 1) ? 'spell' : 'spells';
                            if (result.length == 0)
                                console.info('speller:= %s[%d]: %d %s found.', 
                                    self.textTags[tagIndx].name, tagNmbr, 
                                    result.length, format);
                            else 
                                console.warn('speller:= %s[%d]: %d %s found:', 
                                    self.textTags[tagIndx].name, tagNmbr, 
                                    result.length, format);
                        }
                        
                        if (result.length > 0)
                            self.highlightSpells(result, tagIndx, tagNmbr);
                    }
                };
                xhr.onload = requestCb.bind(null, this, tagIndx, tagNmbr);
                xhr.send();
                
                return params.length;
            };
            
            // highlights spells in browser
            this.highlightSpells = function (result, tagIndx, tagNmbr) {
                if (this.dbgLvl > 0) {
                    var spells = '';
                    for (var i = 0; i < result.length; ++i)
                        spells += ((i == 0) ? '' : ', ') + result[i].word;
                    console.log(spells);
                }
                
            }
            
            // spell-checks all the document with textTags array 
            this.checkDocument = function(forced) {
                for (var i = 0; i < this.textTags.length; ++i) {
                    if (this.textTags[i].collection.length == 0)
                        continue;
                    
                    for (var j = 0; j < this.textTags[i].collection.length; ++j) {
                        if (forced  || 
                            this.textTags[i].collection.length != 
                                this.textTags[i].items  ||
                            this.textTags[i].collection[j].innerHTML.length != 
                                this.textTags[i].textLengths[j]
                           ) 
                        {
                            this.checkTag(i, j);
                        }
                    }
                }
            };
            
            // spell-checks one tag from textTags array 
            this.checkTag = function (tagIndx, tagNmbr) {
                var text = this.textTags[tagIndx].collection[tagNmbr].innerHTML, 
                    sent = this.sendRequest(text, tagIndx, tagNmbr);
                
                if (this.dbgLvl > 1) {
                    console.log('speller:> %s[%d]: %d(%d) bytes to send', 
                        this.textTags[tagIndx].name, tagNmbr, text.length, sent);
                }
            }

        }; /* end of YaSpeller class */
    
    
    // start the speller job at onload event
    window.addEventListener('load', function () {
        var speller = new YaSpeller(
            'ru,en', 14, 'plain', false, 1
        );
        speller.initInstance();
    });

}());
