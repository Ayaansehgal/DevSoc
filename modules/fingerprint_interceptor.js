// Fingerprint Interceptor - Injected into pages to detect fingerprinting
// This script monitors browser APIs commonly used for fingerprinting

(function () {
    'use strict';

    // Prevent multiple injections
    if (window.__HIMT_FINGERPRINT_INTERCEPTOR__) return;
    window.__HIMT_FINGERPRINT_INTERCEPTOR__ = true;

    const events = [];
    let flushTimeout = null;

    /**
     * Send detected events to content script
     */
    function sendEvents() {
        if (events.length === 0) return;

        window.postMessage({
            type: 'HIMT_FINGERPRINT_EVENTS',
            events: events.splice(0, events.length)
        }, '*');
    }

    /**
     * Queue an event for sending
     */
    function queueEvent(type, data) {
        events.push({
            type,
            data,
            timestamp: Date.now(),
            url: window.location.href
        });

        // Debounce sending
        if (flushTimeout) clearTimeout(flushTimeout);
        flushTimeout = setTimeout(sendEvents, 100);
    }

    /**
     * Wrap a method to intercept calls
     */
    function wrapMethod(obj, methodName, interceptor) {
        const original = obj[methodName];
        if (!original) return;

        obj[methodName] = function (...args) {
            interceptor.call(this, args);
            return original.apply(this, args);
        };
    }

    /**
     * Wrap a getter to intercept access
     */
    function wrapGetter(obj, propName, interceptor) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, propName);
        if (!descriptor || !descriptor.get) return;

        Object.defineProperty(obj, propName, {
            ...descriptor,
            get: function () {
                interceptor.call(this);
                return descriptor.get.call(this);
            }
        });
    }

    // =====================
    // Canvas Fingerprinting
    // =====================

    try {
        const CanvasRenderingContext2D_prototype = CanvasRenderingContext2D.prototype;

        // Monitor toDataURL
        wrapMethod(HTMLCanvasElement.prototype, 'toDataURL', function (args) {
            queueEvent('canvas_read', {
                method: 'toDataURL',
                isDataUrl: true,
                width: this.width,
                height: this.height
            });
        });

        // Monitor toBlob
        wrapMethod(HTMLCanvasElement.prototype, 'toBlob', function (args) {
            queueEvent('canvas_read', {
                method: 'toBlob',
                isDataUrl: true,
                width: this.width,
                height: this.height
            });
        });

        // Monitor getImageData
        wrapMethod(CanvasRenderingContext2D_prototype, 'getImageData', function (args) {
            queueEvent('canvas_read', {
                method: 'getImageData',
                isImageData: true,
                dimensions: args
            });
        });
    } catch (e) {
        console.debug('[HIMT Interceptor] Canvas interception failed:', e);
    }

    // ==================
    // WebGL Fingerprinting
    // ==================

    try {
        const webglMethods = ['getParameter', 'getSupportedExtensions', 'getExtension'];
        const webglInfoParams = [
            37445, // UNMASKED_VENDOR_WEBGL
            37446, // UNMASKED_RENDERER_WEBGL
            7936,  // VENDOR
            7937,  // RENDERER
            7938   // VERSION
        ];

        for (const contextType of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
            if (!window[contextType]) continue;

            const prototype = window[contextType].prototype;

            wrapMethod(prototype, 'getParameter', function (args) {
                if (webglInfoParams.includes(args[0])) {
                    queueEvent('webgl_info', {
                        method: 'getParameter',
                        param: args[0],
                        renderer: args[0] === 37446,
                        vendor: args[0] === 37445
                    });
                }
            });

            wrapMethod(prototype, 'getSupportedExtensions', function (args) {
                queueEvent('webgl_info', {
                    method: 'getSupportedExtensions'
                });
            });
        }
    } catch (e) {
        console.debug('[HIMT Interceptor] WebGL interception failed:', e);
    }

    // ===================
    // Audio Fingerprinting
    // ===================

    try {
        if (window.AudioContext || window.webkitAudioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            const originalAudioContext = AudioContextClass;

            // Monitor AudioContext creation
            window.AudioContext = window.webkitAudioContext = function (...args) {
                queueEvent('audio_fingerprint', {
                    method: 'createAudioContext'
                });
                return new originalAudioContext(...args);
            };
            window.AudioContext.prototype = originalAudioContext.prototype;

            // Monitor createAnalyser
            wrapMethod(originalAudioContext.prototype, 'createAnalyser', function (args) {
                queueEvent('audio_fingerprint', {
                    method: 'createAnalyser'
                });
            });

            // Monitor createOscillator
            wrapMethod(originalAudioContext.prototype, 'createOscillator', function (args) {
                queueEvent('audio_fingerprint', {
                    method: 'createOscillator'
                });
            });

            // Monitor createDynamicsCompressor
            wrapMethod(originalAudioContext.prototype, 'createDynamicsCompressor', function (args) {
                queueEvent('audio_fingerprint', {
                    method: 'createDynamicsCompressor'
                });
            });
        }
    } catch (e) {
        console.debug('[HIMT Interceptor] Audio interception failed:', e);
    }

    // =====================
    // Navigator Fingerprinting
    // =====================

    try {
        const navigatorProps = [
            'userAgent', 'platform', 'language', 'languages',
            'hardwareConcurrency', 'deviceMemory', 'maxTouchPoints',
            'vendor', 'vendorSub', 'productSub', 'cookieEnabled',
            'doNotTrack', 'plugins', 'mimeTypes'
        ];

        let navigatorAccessCount = 0;
        const navigatorAccessThreshold = 10;

        for (const prop of navigatorProps) {
            try {
                const descriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
                if (descriptor && descriptor.get) {
                    Object.defineProperty(Navigator.prototype, prop, {
                        ...descriptor,
                        get: function () {
                            navigatorAccessCount++;
                            if (navigatorAccessCount === navigatorAccessThreshold) {
                                queueEvent('navigator_probe', {
                                    accessCount: navigatorAccessCount,
                                    properties: navigatorProps
                                });
                            }
                            return descriptor.get.call(this);
                        }
                    });
                }
            } catch (e) {
                // Some properties may not be writable
            }
        }
    } catch (e) {
        console.debug('[HIMT Interceptor] Navigator interception failed:', e);
    }

    // ================
    // Screen Fingerprinting
    // ================

    try {
        const screenProps = [
            'width', 'height', 'colorDepth', 'pixelDepth',
            'availWidth', 'availHeight', 'availTop', 'availLeft'
        ];

        let screenAccessCount = 0;
        const screenAccessThreshold = 5;

        for (const prop of screenProps) {
            try {
                const descriptor = Object.getOwnPropertyDescriptor(Screen.prototype, prop);
                if (descriptor && descriptor.get) {
                    Object.defineProperty(Screen.prototype, prop, {
                        ...descriptor,
                        get: function () {
                            screenAccessCount++;
                            if (screenAccessCount === screenAccessThreshold) {
                                queueEvent('screen_probe', {
                                    accessCount: screenAccessCount,
                                    properties: screenProps
                                });
                            }
                            return descriptor.get.call(this);
                        }
                    });
                }
            } catch (e) {
                // Some properties may not be writable
            }
        }
    } catch (e) {
        console.debug('[HIMT Interceptor] Screen interception failed:', e);
    }

    // ====================
    // WebRTC Fingerprinting
    // ====================

    try {
        if (window.RTCPeerConnection) {
            const originalRTCPeerConnection = window.RTCPeerConnection;

            window.RTCPeerConnection = function (...args) {
                queueEvent('webrtc_probe', {
                    method: 'createRTCPeerConnection'
                });
                return new originalRTCPeerConnection(...args);
            };
            window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
        }
    } catch (e) {
        console.debug('[HIMT Interceptor] WebRTC interception failed:', e);
    }

    // ===================
    // Battery Fingerprinting
    // ===================

    try {
        if (navigator.getBattery) {
            const originalGetBattery = navigator.getBattery.bind(navigator);

            navigator.getBattery = function () {
                queueEvent('battery_probe', {
                    method: 'getBattery'
                });
                return originalGetBattery();
            };
        }
    } catch (e) {
        console.debug('[HIMT Interceptor] Battery interception failed:', e);
    }

    // ===================
    // Font Fingerprinting
    // ===================

    try {
        // Monitor font measurement techniques
        const measurementElements = new WeakSet();

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Element node
                        const style = node.style;
                        if (style && style.fontFamily) {
                            // Check for font probing patterns
                            const fonts = style.fontFamily.split(',').map(f => f.trim());
                            if (fonts.length > 3) {
                                measurementElements.add(node);
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Monitor offsetWidth/offsetHeight access on font probe elements
        const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
        const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');

        let fontProbeCount = 0;
        const fontProbeThreshold = 15;

        if (originalOffsetWidth && originalOffsetWidth.get) {
            Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
                ...originalOffsetWidth,
                get: function () {
                    if (measurementElements.has(this)) {
                        fontProbeCount++;
                        if (fontProbeCount === fontProbeThreshold) {
                            queueEvent('font_probe', {
                                count: fontProbeCount
                            });
                        }
                    }
                    return originalOffsetWidth.get.call(this);
                }
            });
        }
    } catch (e) {
        console.debug('[HIMT Interceptor] Font interception failed:', e);
    }

    console.debug('[HIMT Interceptor] Fingerprint interceptor active');
})();
