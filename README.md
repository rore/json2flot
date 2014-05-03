json2flot - graphing metrics using flot
=========
json2flot is a small Javascript library for collecting, aggregating and plotting real-time metrics using the [flot] (http://www.flotcharts.org/) plotting library.

The purpose of this library is building quick-and-dirty client-side-only dashboards, for graphing real-time metrics that are provided via a JSON API.   
Initially this library targeted the output of the codahale [metrics] (http://metrics.codahale.com/) library, but in principle it can be used with any JSON formatted data.

An example use case is monitoring a cluster of servers exposing statistics and counters via an API. json2flot makes it easy to build a dashboard to show the real-time state of the cluster with no additional server-side requirements. It can collect the metrics from all the servers, aggregate and plot them on the client side.     

![](https://github.com/rore/json2flot/blob/master/examples/examplesnip.JPG?raw=true)
##Usage 
(For a full usage example see the example.html file under the examples folder)
###Basic usage
Include the json2flot.js file in your HTML, along with the needed flot JS files.   
Add a placeholder div for the flot graph (make sure you give it a size): 
```html
<div id="placeholder1"></div>
```
Set the URL for your metric JSON data:
```javascript 
json2flot.setMetricURLs(["metrics.json"]);
```
Initialize the graph:
```javascript 
// flot options object to set up the axes
var options = {
	lines : {
		show : true
	},
	xaxes : [ {
		mode : "time",
		timeformat : "%H:%M:%S",
		minTickSize : [ 1, "second" ]
	} ]
};
// initialize the graph
json2flot.addGraph("#placeholder1", options, [ {
	// a simple metric to get from a single node
	// the node path
	path : [ "timers", "API.get" ],
	// the metric field to get
	metric : "m1_rate",
	// the label in the graph
	label : "Total Get calls"
}]);
```
Start updating: 
```javascript 
json2flot.startUpdate();
```
###json2flot Methods
####setDataType
Sets the default data type for the JSON fetch request.   
Use "json" for a local file, "jsonp" for an AJAX cross-domain call.

Example:
```javascript 
json2flot.setDataType('jsonp');
```

####setMetricURLs
Sets an array of URLs to fetch the metrics JSON from.    
The response metrics JSON is assumed to be of the same type. json2flot will fetch the response from each of the provided URLs, and will aggregate the requested metric values across all the responses. 
   
Example:
```javascript 
json2flot.setMetricURLs(["http://server01/stats.json","http://server02/stats.json"]);
```
You can also pass a JQuery ajax settings object in the URLs array to override the default fetch behavior.    
So for example, fetch URLs by default as jsonp via GET, but configure some specific ones as json via POST: 
```javascript
json2flot.setMetricURLs([
  "http://some.host.com/some/url",
  { dataType: "json", type:"POST", url:"http://other.host.net/other/url"}
]);
```
####setUpdateInterval
Sets the interval (in milliseconds) for fetching the metrics and updating the graphs.

Example:
```javascript 
json2flot.setUpdateInterval(2000);
```
####setRequestOptions
Sets the default ajax request settings object.

Example:
```javascript 
json2flot.setRequestOptions({ dataType: "json", type:"GET" });
```
####startUpdate
Starts the updater timer. json2flot will fetch the metrics from the provided URLs at the configured update interval, aggregate the results and update the graphs.

####stopUpdate
Stops the updater timer. 

####addGraph
Configures a flot graph with a set of metrics.

#####Parameters:
*placeholder* - The div name where the plot will be rendered.   
*options* - The flot options object for this graph (see the [flot documentation] (https://github.com/flot/flot/blob/master/API.md#plot-options) for a full description).   
*metrics* - An array of [metric objects] (#configuring-metrics) to collect and show on this graph. See [ahead] (#configuring-metrics) for more information.  
*totalPoints* - The total data points to keep for each metric in this graph. Defaults to 100. The number of data points means the maximum time window the graph shows.    

Example:
```javascript 
var options = {
    series: {
        lines: { show: true },
        points: { show: true }
    }
};
json2flot.addGraph("#placeholder1", options, [ {
	// a simple metric to get from a single node
	// the node path
	path : [ "timers", "API.get" ],
	// the metric field to get
	metric : "m1_rate",
	// the label in the graph
	label : "Total Get calls"
}], 500);
```
####Configuring metrics
The metric object is an extension of the flot [data format object] (https://github.com/flot/flot/blob/master/API.md#data-format), so it can include all the available flot fields for flot customization.

The metric object must include two additional fields:   
**path** - An array indicating the path in the JSON object to the node containing the metric to collect.   
**metric** - The name of the field that contains the metric value (should be a number). 

 Example:
 ```javascript
 // This gets the metric from a JSON like: 
 // { "timers" : {  "API.get" : { "count" : 48, "m1_rate" : 1  } } }
{
	// the node path
	path : [ "timers", "API.get" ],
	// the metric field to get
	metric : "m1_rate"
}
```
By default, when the value of the metric is 0 it is treated as a valid metric. There are times where you might want to handle 0 values as missing metrics (for instance, if you graph a lot of metrics on a single graph but want it to present only the non-zero ones). To do that, set the **ignoreZeros** field to true: 
```javascript
ignoreZeros : true
```
#####Aggregation operation
As mentioned, when several URLs are configured, the library will fetch the JSON from each URL, and will aggregated the requested metric from all the responses. It's possible to define the aggregation operation for the metric by using the **operation** field. The default value is *"sum"*, which means the values are summed up. Another option is *"avg"* which will calculate the average of the values across all the URL responses.   
Example:
```javascript
{
	path : [ "timers", "API.get" ],
	metric : "mean",
	label : "Avg Get latency",
	// calculate an avarage of the metric values from the separate results 
	operation : "avg"
}
```
#####Regular expression metrics
A metric object can be configured as a *regular expression metric* by using the **keyRegex** field. This field sets a regular expression to check against all the child nodes of the node that is configured in the **path**. Nodes that match the expression will be collected and treated as separate metrics.    
For example, if we have a metrics JSON that holds counters for several API calls like this:
 ```javascript
{
 "counters" : {
  "API.get" : {
   "count" : 48
  },
  "API.put" : {
   "count" : 23
  },
  "API.delete" : {
   "count" : 50
  }
 }
}
 ```
We can define a "parent" metric that collect the metrics for all the API calls (each one will appear as a separate metric in the graph):
```javascript
{
	path : ["counters"],
	// the regex to match child nodes with
	keyRegex : "API\\.(.*)",
	// the metric field
	metric : "count"
}
```
When using a *regular expression metric* the metric **label** can be set to use a capture group from the regular expression.    
For example:
```javascript
label : "API $1 calls"
``` 
You can set the metric to show only the top N child metrics with the **showTop** field. The child metrics are sorted by the value of the last data point.    
For example, showing only the top 2 API calls:
```javascript
{
	path : ["counters"],
	// the regex to match child nodes with
	keyRegex : "API\\.(.*)",
	// the metric field
	metric : "count",
	// the label in the graph. you can use a match group from the key regex
	label : "API $1 calls",
	// show only the top 2 (according to the last metric value)
	showTop : 2
}
```
You can set the metric to show only the bottom N child metrics with the **showBottom** field. The child metrics are sorted by the value of the last data point.    
For example, showing only the bottom 2 API calls:
```javascript
{
    path : ["counters"],
    // the regex to match child nodes with
    keyRegex : "API\\.(.*)",
    // the metric field
    metric : "count",
    // the label in the graph. you can use a match group from the key regex
    label : "API $1 calls",
    // show only the bottom 2 (according to the last metric value)
    showBottom : 2
}
```
The **showTop** and **showBottom** fields can be combined if you want to show both sets of outliers.
#####Filtering child metrics
You can filter child metrics according to other fields in the selected node. To do that, pass a filter function in the **filter** field of the metric object. This function will receive an array of nodes (one from each URL). You can then process the nodes and return *true* to include the metric or *false* to exclude it from the collection.   
For example, if our JSON contains timer objects for our API calls, each one with *m1_rate* field indicating the rate in the last minute and a *mean* field indicating the mean latency:
```javascript
{
 "timers" : {
 "API.get" : {
   "mean" : 0.03882859237548639,
   "m1_rate" : 1.684852311096391
  }
 }
}
```
We can show the top 5 latencies of API calls that had over 2 requests in the last minutes like this:
```javascript
{
	path : [ "timers" ],
	keyRegex : "API\\.(.*)",
	metric : "mean",
	label : "API $1 latency",
	// calculate an avarage of the metric values from the separate results 
	operation : "avg",
	// show only the top 5 (according to the last metric value)
	showTop : 5,
	// show only nodes that pass this filter. gets an array of metric nodes. 
	// we can look up another value in the node that we want to filter by.
	// in this example we show the latency only for metrics that have 
	// a request rate > 2 in the last minute
	filter : function(nodes) {
		var val = 0.0;
		for ( var n = 0; n < nodes.length; n++) {
			var node = nodes[n];
			if (node && node["m1_rate"])
				val += node["m1_rate"];
		}
		if (val > 2)
			return true;
		return false;
	}
}
```
 
