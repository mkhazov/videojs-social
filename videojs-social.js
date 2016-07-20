/*!
 videojs-social - v1.5.2 - 2015-09-15
 * Copyright (c) 2015 Brightcove; Licensed https://accounts.brightcove.com/en/terms-and-conditions
 */

/*! videojs-endscreen - v0.0.0 - 2014-10-13
 * Copyright (c) 2014 Brightcove
 * Modified by Hany alsamman for support videojs-5
 */
(function (window, videojs) {
    'use strict';

    /**
     * Initialize the plugin.
     * @param options (optional) {object} configuration for the plugin
     */
    var endscreen = function (options) {
        var player = this,
            hasAds = !!(player.ads),
            videoFinished = false,
            adStarted = false,
            adFinished = false;

        /**
         * videojs-ima3 appears to be firing an `adend` event at the start of the actual video when the ad
         * is a postroll. We can account for it by checking if start was called and then if end was called.
         * If a postroll is being run, it will bind displaying the Overlay to `adend` instead of `ended`.
         */
        if (hasAds) {
            player.on('adstart', function () {
                adStarted = true;
                adFinished = false;
            });

            player.on('adend', function () {
                if (adStarted) {
                    adFinished = true;
                }
            });
        }

        player.on('ended', function () {
            if (!videoFinished && (!hasAds || (adStarted && adFinished) || (!adStarted && !adFinished))) {
                videoFinished = true;
            }

            if (videoFinished && hasAds && !adFinished) {
                player.on('adend', function () {
                    player.trigger('endscreen');
                });
            } else if (videoFinished) {
                player.trigger('endscreen');
            }
        });
    };

    // register the plugin
    videojs.plugin('endscreen', endscreen);
})(window, window.videojs);

/*! videojs-social - v0.0.0 - 2014-5-1
 * Copyright (c) 2014 Brightcove */
(function (window, videojs) {
    'use strict';

    videojs.addLanguage('ru', {
      'Share Video': 'Поделиться',
      'Direct Link': 'Прямая ссылка',
      'Embed Code': 'Код для встраивания плеера'
    });

    // Allocate all variables to be used
    var defaults = {
            title: '',
            description: '',
            url: '',
            deeplinking: false,
            displayAfterVideo: false,
            offset: '00:00:00',
            services: {
                facebook: true,
                google: true,
                twitter: true,
                tumblr: true,
                pinterest: true,
                linkedin: true
            }
        },
        addEvent = function (el, type, callback) {
            if (el.addEventListener) {
                return el.addEventListener(type, callback, false);
            }

            // IE8 is onclick, not click
            if (!el.addEventListener && type === 'click') {
                type = 'onclick';
            }
            return el.attachEvent(type, callback);
        },

        removeEvent = function (el, type, callback) {
            if (el.removeEventListener) {
                return el.removeEventListener(type, callback, false);
            }
            if (!el.removeEventListener && type === 'click') {
                type = 'onclick';
            }
            return el.detachEvent(type, callback);
        },

        social,
        SocialButton,
        SocialOverlay;

    var handleEvent = function (e) {
        e.preventDefault();
        window.open(
            this.href,
            '_blank',
            'width=600, height=400, top=100, left=100, titlebar=yes, modal=yes, resizable=yes, toolbar=no, status=1, location=no, menubar=no, centerscreen=yes'
        );
    };

    /**
     * Initialize the plugin.
     * @param options (optional) {object} configuration for the plugin
     */
    social = function (options) {

        var settings,
            player = this;

        // Merge options with the buttons defaults
        settings = videojs.mergeOptions(defaults, options);

        // If we are being re-initialized then remove the old stuff
        if (player.controlBar.socialButton) {
            player.controlBar.removeChild(player.controlBar.socialButton);
            delete player.controlBar.socialButton;

            if (player.socialOverlay) {
                player.removeChild(player.socialOverlay);
                delete player.socialOverlay;
            }
        }

        // Add social button to player
        player.controlBar.socialButton = player.controlBar.addChild('socialButton', settings);
        player.socialOverlay = player.addChild('socialOverlay', settings);

        // Add tabindex
        player.controlBar.socialButton.el().setAttribute('tabindex', '0');

        if (settings.displayAfterVideo) {
            player.endscreen();
            player.on('endscreen', function () {
                player.socialOverlay.enableRestartButton();
                player.socialOverlay.show();
            });
        }
    };

    /*
     * The "Share" control bar button
     */
    SocialButton = videojs.extend(videojs.getComponent('Button'), {
        constructor: function (player, options) {
            videojs.getComponent('Button').call(this, player, options);

            // Bind touchstart for mobile browsers and prevent default
            this.on('touchstart', function (e) {
                player.socialOverlay.update();
                player.socialOverlay.disableRestartButton();
                player.socialOverlay.show();
                e.preventDefault();
            });

            // Bind click event for desktop browsers
            this.on('click', function () {
                player.socialOverlay.update();
                player.socialOverlay.disableRestartButton();
                player.socialOverlay.show();
            });

        }
    });

    SocialButton.prototype.createEl = function () {
        return videojs.getComponent('ClickableComponent').prototype.createEl.call(this, 'div', {
            className: 'vjs-share-control vjs-control',
            innerHTML: '<div class="vjs-control-content"><span class="vjs-control-text">Share</span></div>'
        }, {
            role: 'button',
            'aria-live': 'polite',
        });
    };

    videojs.registerComponent('SocialButton', SocialButton);

    /*
     * The overlay panel that is toggled when the SocialButton is clicked
     */
    SocialOverlay = videojs.extend(videojs.getComponent('Component'), {
        constructor: function (player, options) {

            var embedCode,
                start,
                directLinkTextBox,
                embedCodeTextBox,
                offsetTextBox,
                servicesHtml,
                service,
                restartButton;

            // If we are being recreated, then remove our old self
            if (player.socialOverlay) {
                player.removeChild(player.socialOverlay);
            }

            videojs.getComponent('Component').call(this, player, options);

            // set the direct link and embed code
            this.el().querySelector('.vjs-social-embed-container input').setAttribute('value', this.getEmbedCode());
            this.el().querySelector('.vjs-social-direct-link-container input').setAttribute('value', this._getUrlWithTime());

            // Setup the Restart Button
            restartButton = this.el().querySelector('.vjs-restart');
            addEvent(restartButton, 'click', videojs.bind(this, this._restartPlayer));
            addEvent(restartButton, 'activate', videojs.bind(this, this._restartPlayer));

            // Hide offset if deeplinking is disabled
            if (!options.deeplinking) {
                start = this.el().querySelector('.vjs-social-start');
                start.className += ' vjs-hidden ';
            }

            // Hide Embed code if disabled
            if (options.removeEmbed && options.removeEmbed === true) {
                this.el().querySelector('.vjs-social-embed-container').className += ' vjs-hidden ';
            }

            // Hide Direct Link
            if (options.removeDirect && options.removeDirect === true) {
                this.el().querySelector('.vjs-social-direct-link-container').className += ' vjs-hidden ';
            }

            // Add event to select the direct link when clicked
            directLinkTextBox = this.el().querySelector('.direct-link-textbox');
            addEvent(directLinkTextBox, 'click', function () {
                this.select();
            });

            // Add event to select the embed code when clicked
            embedCodeTextBox = this.el().querySelector('.embed-code-textbox');
            addEvent(embedCodeTextBox, 'click', function () {
                this.select();
            });

            this.offsetTextBox = this.el().querySelector('.start-offset-textbox');

            // Bind changed event to the start offset
            //  which will update the direct and embed links on changes and show it's current state
            addEvent(this.offsetTextBox, 'change', videojs.bind(this, this.update));

            // Bind the click event of the close button to hide the social overlay
            this.closeButton = this.el().querySelector('.vjs-social-cancel');

            // Catch escape key and hide dialog when pressed
            addEvent(this.el(), 'keydown', function (event) {
                if (player.socialOverlay.el().display !== 'none' && event.keyCode === 27) {
                    // Hide the overlay, return focus to social button
                    player.socialOverlay.hide();
                }
            }, true);


            this.on('click', function (event) {
                // if we clicked in the close button, we should close the overlay,
                // this is specifically added to enable the closeButton in IE8
                if (event.target === this.closeButton) {
                    player.socialOverlay.hide();
                }
            });
        },

        update: function () {
            var embedCodeTextBox = this.el().querySelector('.embed-code-textbox'),
                directLinkTextBox;
            var options = this.options_;

            if (/^\s*(0*[1-5]*\d|0*[1-5]*\d:[0-5]\d|\d+:[0-5]\d:[0-5]\d)\s*$/.test(this.offsetTextBox.value)) {

                directLinkTextBox = this.el().querySelector('.direct-link-textbox');

                // update the validation state
                this.offsetTextBox.className = this.offsetTextBox.className.replace(/(^|\s)vjs-invalid/, '');

                // Compute the new direct link
                directLinkTextBox.value = this._getUrlWithTime();
            } else {
                this.offsetTextBox.className += ' vjs-invalid';
            }

            // Compute the new embed code
            embedCodeTextBox.setAttribute('value', this.getEmbedCode());
        },

        enableRestartButton: function () {
            var restartButton = this.el().querySelector('.vjs-restart');
            restartButton.className = restartButton.className.replace(/\bvjs\-hidden\b/, '');
        },

        disableRestartButton: function () {
            var restartButton = this.el().querySelector('.vjs-restart');
            if (!/\bvjs-hidden\b/.test(restartButton.className)) {
                restartButton.className += ' vjs-hidden';
            }
        },

        hide: function () {
            videojs.getComponent('Component').prototype.hide.call(this);
            if (this.previouslyPlaying) {
                this.player().play();
            }
            // Set focus back to the social button for accessibility
            this.player().controlBar.socialButton.el().focus();
        },

        show: function () {
            videojs.getComponent('Component').prototype.show.call(this);
            if (!this.player().paused()) {
                this.previouslyPlaying = true;
                this.player().pause();
            }
        }
    });

    SocialOverlay.prototype.createEl = function () {
        var player = this.player(),
            options = this.options_;

        return videojs.getComponent('Component').prototype.createEl.call(this, 'div', {
            className: 'vjs-social-overlay vjs-hidden',
            'tabindex': -1,
            innerHTML: '<div class="vjs-social-cancel" role="button">' +
            '<div class="vjs-control-text" aria-label="' + player.localize('Close button') + '">' + player.localize('Close') + '</div>' +
            '</div>' +
            '<form>' +
            '<legend>' + player.localize('Share Video') + ' ' + this._getTitle() + '</legend>' +
            '<div class="vjs-social-link-options">' +
            '<label class="vjs-social-start" aria-label="' + player.localize('Start From') + '">' + player.localize('Start From') + ': <input class="start-offset-textbox" type="text" tabindex="9" title="The offset must be specified using the following pattern: hh:mm:ss" placeholder="hh:mm:ss" maxlength="10" value="' + options.offset + '" /></label>' +
            '<div class="vjs-social-direct-link-container">' +
            '<label class="vjs-social-link" aria-label="Read Only: Direct Link To Content">' + player.localize('Direct Link') + ': <input class="direct-link-textbox" type="text" tabindex="8" readonly="true" /></label>' +
            '</div>' +
            '</div>' +
            '<div class="vjs-social-embed-container">' +
            '<label arial-label="Read Only: Embed Code">' + player.localize('Embed Code') + ': <input class="embed-code-textbox" type="text" tabindex="10" readonly="true" /></label>' +
            '</div>' +
            '</form>' +
            '<button tabindex="0" class="vjs-restart vjs-hidden">' +
            '<div class="vjs-control-content"><span class="vjs-control-text">' + player.localize('Restart') + '</span></div>' +
            '</button>'
        }, {
            'aria-role': 'dialog',
            'aria-label': player.localize('Sharing Dialog'),
        });
    };

    /*
     * Computes the new embed code
     */
    SocialOverlay.prototype.getEmbedCode = function () {
        // Declare variables
        var offset, offsetTextBox, playerOptions, embedCode, urlTemplate, player, options;

        player = this.player();
        options = this.options_;

        // Assign converted initial options offset value
        offset = options.deeplinking ? this._convertOffset(options.offset) : null;
        // If we can't find the offset control we should use the options value
        offsetTextBox = player.el().querySelector('.start-offset-textbox');
        if (offsetTextBox && options.deeplinking) {
            offset = this._convertOffset(offsetTextBox.value);
        }
        // Get the player options so we can retrieve the account_id, player_id, and embed_id
        playerOptions = player.options_;

        // encode the URL for security
        if (playerOptions['data-embed-url']) {
            playerOptions['data-embed-url'] = encodeURI(playerOptions['data-embed-url']);
        }

        // Fallback Url Template
        urlTemplate = '//players.brightcove.net/{{account_id}}/{{player_id}}_{{embed_id}}/index.html{{video_id}}';

        // If in iframe use its URL
        // jshint -W116
        if (window.parent != window) {
            urlTemplate = window.location.href;
        }
        // jshint +W116

        // Embed code
        if (options.embedCode) {
            embedCode = options.embedCode;
        } else {
            embedCode = '<iframe src=\'' + urlTemplate + '{{offset}}\' allowfullscreen frameborder=0></iframe>';
        }

        // Construct the embed code snippet. Replace values with known template params.
        return embedCode
            .replace('{{account_id}}', playerOptions['data-account'])
            .replace('{{player_id}}', playerOptions['data-player'])
            .replace('{{embed_id}}', playerOptions['data-embed'])
            .replace('{{video_id}}', (player.mediainfo && player.mediainfo.id) ? '?videoId=' + player.mediainfo.id : '')
            .replace('{{offset}}', offset ? '#t=' + offset : '');
    };

    /*
     * Determines the URL to be dispayed in the share dialog
     */
    SocialOverlay.prototype._getUrl = function () {
        var url,
            options = this.options_;

        // Determine the custom base url
        // In IE8, window.parent doesn't === window, but it does == equal it.
        // jshint -W116
        if (options.url) {
            url = options.url;
        } else if (window.parent != window) {
            url = document.referrer;
        } else {
            url = window.location.href;
        }
        // jshint +W116

        return url;
    };

    SocialOverlay.prototype._getUrlWithTime = function () {
        var options = this.options_,
            url = this._getUrl(),
            offset;

        // Get the start offset textbox (Only include offset if deeplinking is enabled)
        if (options.deeplinking) {
            offset = this._convertOffset(this.el().querySelector('.start-offset-textbox').value);
        }

        // Append the offset if available
        if (offset) {
            url = url + '#t=' + offset;
        }

        return url;
    };

    /*
     * Updates the title based on the media date or the custom options setting
     */
    SocialOverlay.prototype._getTitle = function () {
        var playerOptions,
            options = this.options_,
            player = this.player(),
            title = options.title;

        // If there's no title try and find one in the options
        if (!title) {

            // Get player options
            playerOptions = player.options_;

            // Search the player options data media for a title
            if (playerOptions['data-media'] && playerOptions['data-media'].title) {
                title = playerOptions['data-media'].title;
            }
        }

        return title || '';
    };
    /*
     * Converts an offset from hh:mm:ss to the YouTube format of 1h27m14s
     */
    SocialOverlay.prototype._convertOffset = function (offset) {

        var segments,
            seconds = 0,
            multiples = [1, 60, 3600],
            ret = '',
            i,
            s;

        if (offset) {
            segments = offset.split(':');
            if (segments.length >= 1 && segments.length <= 3) {
                // Parse each segment into an integer to remove leading zeros and other dentritis
                for (i = 0; i < segments.length; ++i) {
                    s = parseInt(segments[i], 10) * multiples[segments.length - 1 - i];
                    if (isNaN(s)) {
                        return '';
                    }
                    seconds += s;
                }
                ret = '';
                if (seconds >= 3600 && Math.floor(seconds / 3600) !== 0) {
                    ret = Math.floor(seconds / 3600) + 'h';
                    seconds = seconds % 3600;
                }

                if (seconds >= 60 && Math.floor(seconds / 60) !== 0) {
                    ret += Math.floor(seconds / 60) + 'm';
                    seconds = seconds % 60;
                }

                if (seconds > 0) {
                    ret += seconds + 's';
                }

                return ret;

            }
        }

        return '';
    };

    SocialOverlay.prototype._restartPlayer = function () {
        var player = this.player();
        player.socialOverlay.hide();
        player.currentTime(0);
        player.play();
    };

    videojs.registerComponent('SocialOverlay', SocialOverlay);

    // register the plugin
    videojs.plugin('social', social);

    // End the closure
})(window, window.videojs);
