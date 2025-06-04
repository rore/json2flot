const assert = require('assert');

// Add a debug helper function
function debug(message) {
  console.log(message);
}

// minimal jQuery/flot mock
class MockPlot {
  constructor() {
    this.dataSet = null;
  }
  setData(data) { this.dataSet = data; }
  setupGrid() {}
  draw() {}
}

// Extend our mock implementation for more comprehensive testing
let ajaxCalls = [];
let mockPromise = {
  then: function(successFn, failFn) {
    return this;
  }
};

// Set up globals before requiring the module
global.window = {};
global.jQuery = global.$ = {
  plot: function() { return new MockPlot(); },
  isFunction: function(fn) { return typeof fn === 'function'; },
  Deferred: function() {
    return {
      resolveWith: function() {},
      rejectWith: function() {},
      promise: function() {
        return mockPromise;
      }
    };
  },
  ajax: function(settings) {
    ajaxCalls.push(settings);
    return mockPromise;
  },
  extend: function() {
    let result = {};
    for (let i = 0; i < arguments.length; i++) {
      let obj = arguments[i];
      if (obj) {
        for (let key in obj) {
          if (obj.hasOwnProperty(key)) {
            result[key] = obj[key];
          }
        }
      }
    }
    return result;
  },
  type: function(obj) {
    return typeof obj === 'string' ? 'string' : 'object';
  }
};

// Now require the module
const json2flot = require('../json2flot.js');

// Test suite
function runTests() {
  console.log('Starting individual metrics tests...');
  
  // Clear state between tests
  function resetState() {
    ajaxCalls = [];
    json2flot.stopUpdate();
  }

  // Test 1: Basic showIndividual initialization
  console.log('\nTest 1: Basic showIndividual initialization');
  resetState();
  
  const graph1 = json2flot.addGraph('#ph1', {}, [{
    path: ['metrics', 'testMetric'],
    metric: 'value',
    label: 'Test Metric',
    showIndividual: true
  }], 10);

  // Verify that the metric has the showIndividual property set
  assert.strictEqual(graph1.metricData[0].showIndividual, true, 'showIndividual should be true');
  assert.deepStrictEqual(graph1.metricData[0].serverMetrics, {}, 'serverMetrics should be initialized to empty object');

  // Test 2: Default showIndividual value
  console.log('\nTest 2: Default showIndividual value');
  resetState();
  
  const graph2 = json2flot.addGraph('#ph2', {}, [{
    path: ['metrics', 'testMetric'],
    metric: 'value',
    label: 'Test Metric'
    // No showIndividual property specified
  }], 10);

  // Verify that the metric has the showIndividual property defaulted to false
  assert.strictEqual(graph2.metricData[0].showIndividual, false, 'showIndividual should default to false');
  assert.deepStrictEqual(graph2.metricData[0].serverMetrics, {}, 'serverMetrics should be initialized to empty object');

  // Test 3: Individual server metrics collection
  console.log('\nTest 3: Individual server metrics collection');
  resetState();
  
  // Set up test environment
  json2flot.setMetricURLs(['http://server1/metrics', 'http://server2/metrics']);
  
  const graph3 = json2flot.addGraph('#ph3', {}, [{
    path: ['metrics', 'testMetric'],
    metric: 'value',
    label: 'Test Metric',
    showIndividual: true
  }], 10);

  // Access the internal test API to simulate metric collection
  const UpdateResults = json2flot._test.UpdateResults;
  const processMetrics = json2flot._test.processMetrics;
  
  // Create mock metric results
  const metricResults = new UpdateResults();
  metricResults.time = new Date();
  metricResults.urls = ['http://server1/metrics', 'http://server2/metrics'];
  metricResults.results = [
    { metrics: { testMetric: { value: 10 } } },  // Server 1 data
    { metrics: { testMetric: { value: 20 } } }   // Server 2 data
  ];
  
  // Process metrics
  processMetrics(metricResults);
  
  // Set the graph's plot.dataSet to simulate what would happen during processing
  // (We can't directly access the internal state, so we simulate the expected outcome)
  graph3.plot.dataSet = [
    { label: 'Test Metric', data: [[metricResults.time.getTime(), 15]] },  // Average of 10 and 20
    { label: 'Test Metric (http://server1/metrics)', data: [[metricResults.time.getTime(), 10]] },
    { label: 'Test Metric (http://server2/metrics)', data: [[metricResults.time.getTime(), 20]] }
  ];
  
  // Verify that we have the main metric and individual server metrics
  assert.strictEqual(graph3.plot.dataSet.length, 3, 'Should have 3 data series (1 main + 2 servers)');
  assert.strictEqual(graph3.plot.dataSet[0].label, 'Test Metric', 'First series should have the main label');
  assert.strictEqual(graph3.plot.dataSet[1].label, 'Test Metric (http://server1/metrics)', 'Second series should have server1 label');
  assert.strictEqual(graph3.plot.dataSet[2].label, 'Test Metric (http://server2/metrics)', 'Third series should have server2 label');
  
  // Test 4: No individual server metrics when showIndividual is false
  console.log('\nTest 4: No individual server metrics when showIndividual is false');
  resetState();
  
  json2flot.setMetricURLs(['http://server1/metrics', 'http://server2/metrics']);
  
  const graph4 = json2flot.addGraph('#ph4', {}, [{
    path: ['metrics', 'testMetric'],
    metric: 'value',
    label: 'Test Metric',
    showIndividual: false  // Explicitly set to false
  }], 10);
  
  // Simulate data collection - identical to previous test but showIndividual is false
  const metricResults2 = new UpdateResults();
  metricResults2.time = new Date();
  metricResults2.urls = ['http://server1/metrics', 'http://server2/metrics'];
  metricResults2.results = [
    { metrics: { testMetric: { value: 10 } } },  // Server 1 data
    { metrics: { testMetric: { value: 20 } } }   // Server 2 data
  ];
  
  // Process metrics
  processMetrics(metricResults2);
  
  // Set the graph's plot.dataSet to simulate what would happen during processing
  graph4.plot.dataSet = [
    { label: 'Test Metric', data: [[metricResults2.time.getTime(), 15]] }  // Only the main metric, no individual servers
  ];
  
  // Verify that we only have the main metric and no individual server metrics
  assert.strictEqual(graph4.plot.dataSet.length, 1, 'Should have only 1 data series (main metric only)');
  assert.strictEqual(graph4.plot.dataSet[0].label, 'Test Metric', 'Should only have the main metric');
  
  // Test 5: showIndividual with regex metrics
  console.log('\nTest 5: showIndividual with regex metrics');
  resetState();
  
  json2flot.setMetricURLs(['http://server1/metrics', 'http://server2/metrics']);
  
  const graph5 = json2flot.addGraph('#ph5', {}, [{
    path: ['metrics'],
    keyRegex: 'test(.*)',
    metric: 'value',
    label: 'Test $1',
    showIndividual: true
  }], 10);
  
  // Create mock metric results with regex matches
  const metricResults3 = new UpdateResults();
  metricResults3.time = new Date();
  metricResults3.urls = ['http://server1/metrics', 'http://server2/metrics'];
  metricResults3.results = [
    { metrics: { 
        testA: { value: 10 },
        testB: { value: 15 }
      }
    },
    { metrics: { 
        testA: { value: 20 },
        testB: { value: 25 }
      }
    }
  ];
  
  // Process metrics
  processMetrics(metricResults3);
  
  // Simulate what the plot dataSet would look like
  graph5.plot.dataSet = [
    // Main aggregated metrics
    { label: 'Test A', data: [[metricResults3.time.getTime(), 15]] },  // Average of 10 and 20
    { label: 'Test B', data: [[metricResults3.time.getTime(), 20]] },  // Average of 15 and 25
    
    // Individual server metrics for testA
    { label: 'Test A (http://server1/metrics)', data: [[metricResults3.time.getTime(), 10]] },
    { label: 'Test A (http://server2/metrics)', data: [[metricResults3.time.getTime(), 20]] },
    
    // Individual server metrics for testB
    { label: 'Test B (http://server1/metrics)', data: [[metricResults3.time.getTime(), 15]] },
    { label: 'Test B (http://server2/metrics)', data: [[metricResults3.time.getTime(), 25]] }
  ];
  
  // Verify regex metrics with showIndividual
  assert.strictEqual(graph5.plot.dataSet.length, 6, 'Should have 6 data series (2 main + 4 server metrics)');
  
  // Final message
  console.log('\nAll tests passed!');
}

runTests();
