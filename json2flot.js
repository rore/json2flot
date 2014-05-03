/*******************************************************************************
 * json2flot
 * 
 * Copyright 2014 Rotem Hermon
 * 
 * A library for collecting and plotting real-time metrics from JSON data,
 * using flot (http://www.flotcharts.org).
 * 
 ******************************************************************************/

(function(json2flot, $, undefined) {

	/**
	 * Set the list of URLs to pull the metrics from
	 * 
	 * @param urls
	 *            An array of URLs which return the metrics JSON
	 */
	json2flot.setMetricURLs = function(urls) {
		if (urls instanceof Array || !urls) {
			metricUrls = urls;
		} else {
			metricUrls = [];
			metricUrls.push(urls);
		}
	}

	/**
	 * Set the update interval
	 * 
	 * @param interval
	 *            Update interval (in milliseconds)
	 */
	json2flot.setUpdateInterval = function(interval) {
		if (interval && !isNaN(+interval)) {
			updateInterval = +interval;
			if (updateInterval < 10) {
				updateInterval = 10;
			}
		}
	}

	/**
	 * Get the update interval (in milliseconds)
	 */
	json2flot.getUpdateInterval = function() {
		return updateInterval;
	}

	/**
	 * Sets the data type for the JSON requests
	 * 
	 * @param type
	 *            Can be either jsonp (default) or json.
	 */
	json2flot.setDataType = function(type) {
		if (type != "jsonp" && type != "json")
			throw ("data type can be either jsonp or json")
		dataType = type;
	}

	/**
	 * Gets the data type used for the requests
	 */
	json2flot.getDataType = function() {
		return dataType;
	}

	/**
	 * Start updating the graphs. This will start fetching the metrics from the
	 * URLs and process them
	 */
	json2flot.startUpdate = function() {
		if (!doUpdate){
			doUpdate = true;
			update();
		}
	}

	/**
	 * Stop updating the graphs. This will stop fetching the metrics.
	 */
	json2flot.stopUpdate = function() {
		doUpdate = false;
	}

	/**
	 * Allow customization of the ajax request options
	 * @param map the default request options.
	 */
	json2flot.setRequestOptions = function(map) {
		requestOptions = map;
	}

	/**
	 * Add a graph to plot some metrics.
	 * 
	 * @param placeholder
	 *            The div name to plot the graph in
	 * @param options
	 *            The flot options object for the graph
	 * @param metrics
	 *            A list of metrics to plot on the graph. This is an extended
	 *            flot data object
	 * @param totalPoints
	 *            The total number of points to keep for each metric. Defaults
	 *            to 100
	 */
	json2flot.addGraph = function(placeholder, options, metrics, totalPoints) {
		var graph = new MetricsGraph(placeholder, options, metrics, totalPoints);
		graphs.push(graph);
		return graph;
	}

	function update() {
		// check for the flag in case update was stopped
		if (doUpdate) {
			getAllMetrics();
			setTimeout(update, updateInterval);
		}
	}

	function getTicks() {
		return new Date().getTime();
	}

	/**
	 * A graph object
	 * 
	 * @param placeholder
	 *            The div name to plot the graph in
	 * @param options
	 *            The flot options object for the graph
	 * @param metrics
	 *            A list of metrics to plot on the graph. This is an extended
	 *            flot data object
	 * @param totalPoints
	 *            The total number of points to keep for each metric. Defaults
	 *            to 100
	 */
	function MetricsGraph(placeholder, options, metrics, totalPoints) {

		if (typeof (totalPoints) === 'undefined')
			totalPoints = 100;

		this.placeholder = placeholder;
		this.options = options;
		this.metricData = prepareMetrics(metrics);
		this.totalPoints = totalPoints;
		this.plot = $.plot(this.placeholder, getPlotInitMetrics(this.metricData), this.options);

		function prepareMetrics(metrics) {
			if (!metrics || !(metrics instanceof Array) || metrics.length <= 0)
				throw ("Error initializing graph. metrics should be an array of metric definitions");

			var data = [];
			for ( var i = 0; i < metrics.length; i++) {
				var metric = metrics[i];
				prepareMetric(metric);
				data.push(metric);
			}
			return data;
		}
		
		function getPlotInitMetrics(metrics)
		{
			// for initializing the plot, filter out regex metrics
			var data = [];
			for ( var i = 0; i < metrics.length; i++) {
				var metric = metrics[i];
				if (!metric.keyRegex)
					data.push(metric);
			}
			return data;
		}

		function prepareMetric(metric) {
			if (!('path' in metric) || !('metric' in metric))
				throw ("Error initializing graph. metrics should be an array of metric definitions, i.e: [{ path: ['path'], metric: 'metric', label: 'label'}]");
			if (typeof metric.path === "string")
				metric.path = [metric.path];
			metric.data = [];
			if (typeof (metric.operation) === 'undefined') {
				metric.operation = "sum";
			} else if (metric.operation != "sum" && metric.operation != "avg")
				throw ("Invalid metric operation: " + metric.operation);
			// is this a regex metric?
			if (metric.keyRegex) {
				// create the regex object
				metric.regexObj = new RegExp(metric.keyRegex);
				// for a regex metric we keep an array of the actual metrics we
				// collect for it
				metric.childMetrics = {};
				metric.regexLabel = metric.label;
				metric.label = null;
			}
		}

		this.initMetric = prepareMetric;
	}

	/**
	 * An array of graph object
	 */
	var graphs = [];
	/**
	 * An array of URLs to fetch the metrics JSON from
	 */
	var metricUrls = [];
	/**
	 * Update interval in milliseconds
	 */
	var updateInterval = 1000;
	/**
	 * Flags if the update should be running
	 */
	var doUpdate = false;
	/**
	 * The data type to get in the request. Options are jsonp and json
	 */
	var dataType = "jsonp";
	/**
	 * The ajax request options
	 */
	var requestOptions = { };

	/**
	 * Returns a metric node
	 * 
	 * @param path
	 *            An array of the node path to get (i.e. ["level1", "level2"])
	 * @param jsonRoot
	 *            The root metrics object
	 */
	function getMetricNode(path, jsonRoot) {
		if (!path) return null;
		if (path.length < 1) return null;
		var head = path[0];
		var node = jsonRoot[head];
		if (!node)
			return null;
		if (path.length > 1){
			var rest = path.slice(1);
			return getMetricNode(rest, node);
		}
		return node;
	}

	/**
	 * Returns a specific metric
	 * 
	 * @param path
	 *            An array of the node path to get (i.e. ["level1", "level2"])
	 * @param metricName
	 *            The name of the metric to return
	 * @param jsonRoot
	 *            The root metrics object
	 */
	function getMetric(path, metricName, jsonRoot) {
		var node = getMetricNode(path, jsonRoot);
		if (!node)
			return null;
		return node[metricName];
	}
	

	/**
	 * Gets the metrics JSON from a URL
	 */
	function getMetrics(url) {
		return $.ajax($.type(url) === 'string'
			? $.extend({}, requestOptions, {url: url, dataType: dataType})
			: $.extend({}, requestOptions, {dataType: dataType}, url));
	}

	/**
	 * A result object used when getting all the metrics responses
	 */
	function UpdateResults(time) {
		this.time = time;
		this.results = [];
		this.deferred = [];
		this.urls = [];
	}

	/**
	 * Fetches the metrics responses from the list of URLs
	 */
	function getAllMetrics() {
		// create an array of deferred request objects
		var deferred = [];
		if (metricUrls && metricUrls.length > 0) {
			for (index = 0; index < metricUrls.length; ++index) {
				var host = metricUrls[index];
				if (host) {
					deferred.push(getMetrics(host));
				}
			}
			if (deferred.length > 0) {
				// generate a result object to keep all the context needed
				var results = new UpdateResults(new Date());
				results.deferred = deferred;
				results.urls = metricUrls;
				// send the requests to all URLs.
				// we use the custom whenAll method that activates all the
				// deferred objects
				// and does not fail fast if one fails
				$.whenAll.apply($, deferred).then(
				// success function
				function() {
					if (arguments.length == 3 && arguments[1] == "success") {
						results.results.push(arguments[0]);
					} else {
						var res = null;
						for ( var i = 0; i < arguments.length; i++) {
							var arg = arguments[i];
							processCallResult(i, arg, results);
						}
					}
					if (results.results.length > 0) {
						processMetrics(results);
					}
				},
				// fail function. we can have successful requests also
				// if some failed
				function() {
					for ( var i = 0; i < arguments.length; i++) {
						var arg = arguments[i];
						processCallResult(i, arg, results);
					}
					if (results.results.length > 0) {
						processMetrics(results);
					}
				})
			}
		}
	}

	/**
	 * Handle a result object from the request
	 * 
	 * @param pos
	 *            the position of the request
	 * @param result
	 *            the result object
	 * @param updater
	 *            our update result object with all the context
	 */
	function processCallResult(pos, result, updater) {
		if (result && result.length == 3 && result[1] == "success")
			updater.results.push(result[0]);
		else if (result && result.length == 3 && result[1] == "error")
			console.warn("error getting metrics from URL: " + updater.urls[pos]);
		else if (result && result.length == 3 && result[1] == "parsererror")
			console.warn("error getting metrics from URL: " + updater.urls[pos], result[2]);
		else if (result && result.statusText && (result.statusText == "error" || result.statusText == "parsererror"))
			console.warn("error getting metrics from URL: " + updater.urls[pos]);
		else if (result && result.status != 200 && result.statusText)
			console.warn("error getting metrics from URL: " + result.statusText);
		else
			updater.results.push(result);
	}

	/**
	 * Process the results of the metrics fetch, update the graphs
	 * 
	 * @param metricResults
	 *            our updater object with all the metrics responses
	 */
	function processMetrics(metricResults) {
		if (!doUpdate) return;
		// go over all the registered graphs
		for ( var i = 0; i < graphs.length; i++) {
			var graph = graphs[i];
			var data = [];
			// look for metrics that we should add to this graph
			for ( var m = 0; m < graph.metricData.length; m++) {
				var metric = graph.metricData[m];
				if (metric.keyRegex) {
					// create all the child metrics from keys that match the
					// regex
					createChildMetrics(metric, metricResults, graph);
					// now collect the metrics
					var sortedMetrics = null;
					if ((metric.showTop && metric.showTop > 0) || (metric.showBottom && metric.showBottom > 0))
						sortedMetrics = [];
					for ( var key in metric.childMetrics) {
						if (metric.childMetrics.hasOwnProperty(key)) {
							var child = metric.childMetrics[key];
							var metricValid = isMetricValid(child, metricResults);
							var v = collectMetric(child, metricResults);
							if (metricValid && (null != v || child.data.length > 0) && null != sortedMetrics){
								sortedMetrics.push({val:v, metric:child});
							}
							else if (metricValid && metric.data.length > 0)
								data.push(child);
						}
					}
					if (null != sortedMetrics){
						sortedMetrics = sortedMetrics.sort(function (a, b) {
						    return b.val - a.val;
						});
						var stop = Math.min(sortedMetrics.length, Math.max(0, metric.showTop));
						for ( var n = 0; n < stop; n++) {
							data.push(sortedMetrics[n].metric);
						}
						var start = Math.max(stop, sortedMetrics.length - Math.min(0, metric.showBottom));
						for ( var n = start; n < sortedMetrics.length; n++) {
							data.push(sortedMetrics[n].metric);
						}
					}
				} else {
					var metricValid = isMetricValid(metric, metricResults);
					var v = collectMetric(metric, metricResults);
					if (metricValid && metric.data.length > 0)
						data.push(metric);
				}

			}

			// update the graph with the new data and redraw it
			graph.plot.setData(data);
			graph.plot.setupGrid();
			graph.plot.draw();
		}

		function isMetricValid(metric, metricResults){
			// if we have a custom filter function we need to collect all the 
			// metric nodes and pass it to the filter
			if (metric.filter){
				var nodes = [];
				for ( var n = 0; n < metricResults.results.length; n++) {
					var metRes = metricResults.results[n];
					var node = getMetricNode(metric.path, metRes);
					if (node)
						nodes.push(node);
				}
				return metric.filter(nodes);
			}
			return true;
		}
		
		/**
		 * collects a specific metric from the results
		 * returns the collected value if found, or null if it was filtered out.
		 */
		function collectMetric(metric, metricResults) {
			var val = null;
			var metricCount = 0;
			// go over all the metric results we got now
			for ( var n = 0; n < metricResults.results.length; n++) {
				var metRes = metricResults.results[n];
				// look for the value of the metric we need
				var metval = getMetric(metric.path, metric.metric, metRes);
				if (null != metval) {
					metricCount += 1;
					if (null == val)
						val = metval;
					else if (metric.operation == "sum" || metric.operation == "avg") {
						val += metval;
					}
				}
			}
			// if we exceeded the requested number of points remove one
			if (metric.data.length > graph.totalPoints) {
				metric.data = metric.data.slice(1);
			}
			if (metric.ignoreZeros && 0 == val)
				val = null;
			if (null != val) {
				// avg means we need an average of the metric across all queries
				// URLs
				if (metric.operation == "avg") {
					val = val / metricCount;
				}
				// create the current data
				var series = [ metricResults.time.getTime(), val ];
				metric.data.push(series);
				metric.data = metric.data.sort(function (a, b) {
				    return a[0] - b[0];
				});
				// sort the data by time in case we got a late response
				if (metricValid)
					return val;
			}
			return null;
		}

		function createChildMetrics(metric, metricData, graph) {
			// go over all the results and collect all the keys that pass the
			// regex
			for ( var n = 0; n < metricResults.results.length; n++) {
				var metRes = metricResults.results[n];
				// get the parent node
				var metType = getMetricNode(metric.path, metRes);
				if (metType) {
					for ( var k in metType) {
						// use hasOwnProperty to filter out keys from the
						// Object.prototype
						if (metType.hasOwnProperty(k)) {
							var regRes = metric.regexObj.exec(k);
							if (null != regRes) {
								// we got a match. look for the child metric.
								var childName = k + "." + metric.metric;
								var child = null;
								if (metric.childMetrics.hasOwnProperty(childName))
									child = metric.childMetrics[childName];
								else {
									// first encounter, need to create it
									child = copyMetric(metric, k, regRes);
									graph.initMetric(child);
									// format the label. look for regex matches
									// and replace
									// in the label if found
									for ( var m in regRes) {
										if (regRes.hasOwnProperty(m)) {
											var matchNum = TryParseInt(m);
											if (null != matchNum && matchNum > 0) {
												child.label = metric.regexLabel.replace(
																"$" + matchNum,
																regRes[m]);
											}
										}
									}
									// keep as a child metric
									metric.childMetrics[childName] = child;
								}
							}
						}
					}
				}
			}
		}

		function copyMetric(parent, key) {
			var child = {};
			for ( var k in parent) {
				if (parent.hasOwnProperty(k) && !(k == "keyRegex")
						&& !(k == "regexObj") && !(k == "childMetrics")
						&& !(k == "data") && !(k == "path")) {
					child[k] = parent[k];
				}
			}
			child.path = parent.path.slice();
			child.path.push(key);
			return child;
		}

		function TryParseInt(str) {
			var retValue = null;
			if (str != null) {
				if (str.length > 0) {
					if (!isNaN(str)) {
						retValue = parseInt(str);
					}
				}
			}
			return retValue;
		}

	}

	/*
	 * A method of getting all deferred results even if one of them fails. Taken
	 * from this stackoverflow answer:
	 * http://stackoverflow.com/a/7881733/2633566
	 * 
	 */
	$.whenAll = function(firstParam) {
		var args = arguments, sliceDeferred = [].slice, i = 0, length = args.length, count = length, rejected, deferred = length <= 1
				&& firstParam && jQuery.isFunction(firstParam.promise) ? firstParam
				: jQuery.Deferred();

		function resolveFunc(i, reject) {
			return function(value) {
				rejected |= reject;
				args[i] = arguments.length > 1 ? sliceDeferred.call(arguments,
						0) : value;
				if (!(--count)) {
					// Strange bug in FF4:
					// Values changed onto the arguments object sometimes end up
					// as undefined values
					// outside the $.when method. Cloning the object into a
					// fresh array solves the issue
					var fn = rejected ? deferred.rejectWith
							: deferred.resolveWith;
					fn.call(deferred, deferred, sliceDeferred.call(args, 0));
				}
			};
		}

		if (length > 1) {
			for (; i < length; i++) {
				if (args[i] && jQuery.isFunction(args[i].promise)) {
					args[i].promise()
							.then(resolveFunc(i), resolveFunc(i, true));
				} else {
					--count;
				}
			}
			if (!count) {
				deferred.resolveWith(deferred, args);
			}
		} else if (deferred !== firstParam) {
			deferred.resolveWith(deferred, length ? [ firstParam ] : []);
		}
		return deferred.promise();
	};

}(window.json2flot = window.json2flot || {}, jQuery));
