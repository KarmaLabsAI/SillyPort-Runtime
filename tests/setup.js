/**
 * Jest setup file for SillyTavern Browser Runtime tests
 */

// Mock localStorage for tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

global.localStorage = localStorageMock;

// Mock IndexedDB for tests - Fully synchronous implementation
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
};

// Mock IDBRequest - Synchronous implementation
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
    if (this.onsuccess) this.onsuccess({ target: this });
  }

  triggerError(error) {
    this.error = error;
    this.readyState = 'done';
    if (this.onerror) this.onerror({ target: this });
  }

  triggerUpgradeNeeded(event) {
    if (this.onupgradeneeded) this.onupgradeneeded(event);
  }
}

// Mock IDBDatabase
class MockIDBDatabase {
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.objectStoreNames = [];
    this.objectStores = new Map();
  }

  createObjectStore(name, options = {}) {
    const store = new MockIDBObjectStore(name, options);
    this.objectStores.set(name, store);
    this.objectStoreNames.push(name);
    return store;
  }

  transaction(storeNames, mode = 'readonly') {
    return new MockIDBTransaction(storeNames, mode, this);
  }

  close() {
    // Mock close method
  }
}

// Mock IDBObjectStore
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

  // Mock CRUD operations
  add(value) {
    const key = value[this.keyPath];
    this.data.set(key, value);
    return this.createRequest(key);
  }

  put(value) {
    const key = value[this.keyPath];
    this.data.set(key, value);
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
    // Immediately trigger success
    request.triggerSuccess(result);
    return request;
  }
}

// Mock IDBTransaction
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
    if (this.oncomplete) this.oncomplete();
  }

  abort() {
    if (this.onabort) this.onabort();
  }
}

// Setup IndexedDB mocks - Synchronous implementation
mockIndexedDB.open.mockImplementation((name, version) => {
  const request = new MockIDBRequest();
  const db = new MockIDBDatabase(name, version);
  
  // Check if this is a new database or version upgrade
  const isNewDatabase = version > 1;
  
  if (isNewDatabase) {
    // Trigger upgrade needed event first
    const upgradeEvent = {
      target: { result: db },
      oldVersion: 0,
      newVersion: version
    };
    request.triggerUpgradeNeeded(upgradeEvent);
  }
  
  // Then trigger success
  request.triggerSuccess(db);
  
  return request;
});

mockIndexedDB.deleteDatabase.mockImplementation((name) => {
  const request = new MockIDBRequest();
  
  // Immediately trigger success
  request.triggerSuccess();
  
  return request;
});

global.indexedDB = mockIndexedDB;

// Mock navigator.storage for quota estimation
global.navigator = {
  ...global.navigator,
  storage: {
    estimate: jest.fn().mockResolvedValue({
      usage: 1024 * 1024, // 1MB
      quota: 50 * 1024 * 1024 // 50MB
    })
  }
};

// Mock fetch for file loading tests
global.fetch = jest.fn();

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.clear();
}); 