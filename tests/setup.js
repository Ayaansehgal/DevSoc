// Jest setup file - Mock Chrome APIs

// Mock chrome.storage
global.chrome = {
    storage: {
        local: {
            get: jest.fn((keys, callback) => {
                if (callback) callback({});
                return Promise.resolve({});
            }),
            set: jest.fn((items, callback) => {
                if (callback) callback();
                return Promise.resolve();
            }),
            remove: jest.fn((keys, callback) => {
                if (callback) callback();
                return Promise.resolve();
            })
        }
    },
    runtime: {
        getURL: jest.fn((path) => `chrome-extension://mock-id/${path}`),
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        }
    },
    tabs: {
        sendMessage: jest.fn()
    }
};

// Mock fetch for tracker_kb.json loading
global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({
            'google-analytics.com': { category: 'Analytics', company: 'Google' },
            'facebook.com': { category: 'Social', company: 'Meta' },
            'doubleclick.net': { category: 'Advertising', company: 'Google' }
        })
    })
);

// Mock console for cleaner test output
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};
