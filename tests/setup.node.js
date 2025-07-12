/**
 * Jest setup file for Node.js environment
 * Provides mocks for browser APIs that don't exist in Node.js
 */

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

global.localStorage = localStorageMock;

// Mock IndexedDB with a simple in-memory implementation
class MockIndexedDB {
  constructor() {
    this.databases = new Map();
  }

  open(name, version = 1) {
    const request = new MockIDBRequest();
    
    // Create or get database
    if (!this.databases.has(name)) {
      this.databases.set(name, new MockIDBDatabase(name, version));
    }
    
    const db = this.databases.get(name);
    
    // If version is higher, trigger upgrade
    if (version > db.version) {
      const upgradeEvent = {
        target: { result: db },
        oldVersion: db.version,
        newVersion: version
      };
      db.version = version;
      request.triggerUpgradeNeeded(upgradeEvent);
    }
    
    // Trigger success
    setTimeout(() => request.triggerSuccess(db), 0);
    
    return request;
  }

  deleteDatabase(name) {
    const request = new MockIDBRequest();
    this.databases.delete(name);
    setTimeout(() => request.triggerSuccess(), 0);
    return request;
  }
}

class MockIDBRequest {
  constructor() {
    this.result = null;
    this.error = null;
    this.readyState = 'pending';
    this.onsuccess = null;
    this.onerror = null;
    this.onupgradeneeded = null;
  }

  triggerSuccess(result) {
    this.result = result;
    this.readyState = 'done';
    if (this.onsuccess) {
      this.onsuccess({ target: this });
    }
  }

  triggerError(error) {
    this.error = error;
    this.readyState = 'done';
    if (this.onerror) {
      this.onerror({ target: this });
    }
  }

  triggerUpgradeNeeded(event) {
    if (this.onupgradeneeded) {
      this.onupgradeneeded(event);
    }
  }
}

class MockIDBDatabase {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.objectStoreNames = [];
    this.objectStores = new Map();
    this.closed = false;
  }

  createObjectStore(name, options = {}) {
    const store = new MockIDBObjectStore(name, options);
    this.objectStores.set(name, store);
    this.objectStoreNames.push(name);
    return store;
  }

  transaction(storeNames, mode = 'readonly') {
    if (this.closed) {
      throw new Error('Database is closed');
    }
    return new MockIDBTransaction(storeNames, mode, this);
  }

  close() {
    this.closed = true;
  }
}

class MockIDBObjectStore {
  constructor(name, options = {}) {
    this.name = name;
    this.keyPath = options.keyPath;
    this.indexNames = [];
    this.indexes = new Map();
    this.data = new Map();
  }

  createIndex(name, keyPath, options = {}) {
    const index = { name, keyPath, options };
    this.indexes.set(name, index);
    this.indexNames.push(name);
    return index;
  }

  index(name) {
    return this.indexes.get(name);
  }

  add(value) {
    const key = this.keyPath ? value[this.keyPath] : undefined;
    if (key !== undefined) {
      this.data.set(key, value);
    }
    return this.createRequest(key);
  }

  put(value) {
    const key = this.keyPath ? value[this.keyPath] : undefined;
    if (key !== undefined) {
      this.data.set(key, value);
    }
    return this.createRequest(key);
  }

  get(key) {
    const value = this.data.get(key);
    return this.createRequest(value);
  }

  delete(key) {
    this.data.delete(key);
    return this.createRequest();
  }

  clear() {
    this.data.clear();
    return this.createRequest();
  }

  createRequest(result = null) {
    const request = new MockIDBRequest();
    setTimeout(() => request.triggerSuccess(result), 0);
    return request;
  }
}

class MockIDBTransaction {
  constructor(storeNames, mode, db) {
    this.mode = mode;
    this.db = db;
    this.objectStoreNames = storeNames;
    this.error = null;
    this.oncomplete = null;
    this.onerror = null;
    this.onabort = null;
  }

  objectStore(name) {
    return this.db.objectStores.get(name);
  }

  complete() {
    if (this.oncomplete) {
      this.oncomplete();
    }
  }

  abort() {
    if (this.onabort) {
      this.onabort();
    }
  }
}

// Set up global IndexedDB
global.indexedDB = new MockIndexedDB();

// Mock navigator.storage
global.navigator = {
  ...global.navigator,
  storage: {
    estimate: jest.fn().mockResolvedValue({
      usage: 1024 * 1024, // 1MB
      quota: 50 * 1024 * 1024 // 50MB
    })
  }
};

// Mock fetch
global.fetch = jest.fn();

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock window object
global.window = {
  ...global.window,
  indexedDB: global.indexedDB,
  localStorage: global.localStorage,
  navigator: global.navigator,
  fetch: global.fetch
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
  
  // Reset IndexedDB state
  global.indexedDB = new MockIndexedDB();
  global.window.indexedDB = global.indexedDB;
}); 