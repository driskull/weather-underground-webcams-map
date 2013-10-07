define([
    "dojo/_base/declare",
    "dojo/_base/connect",
    "dojo/_base/array",
    "dojo/_base/lang",
    "esri", // We're not directly using anything defined in esri.js but geometry, locator and utils are not AMD. So, the only way to get reference to esri object is through esri module (ie. esri/main)
    "esri/geometry",
    "esri/utils"
],
function (declare, connect, arr, lang, esri) {
    var Widget = declare("modules.wu_webcam", null, {
        constructor: function (options) {
            var _self = this;
            this.options = {
                key: '',
                id: 'wu_webcam'
            };
            declare.safeMixin(this.options, options);
            if (this.options.map === null) {
                throw 'Reference to esri.Map object required';
            }
            this.featureCollection = {
                layerDefinition: {
                    "geometryType": "esriGeometryPoint",
                    "fields": [{
                        "name": "OBJECTID",
                        "type": "esriFieldTypeOID"
                    }, {
                        "name": "smType",
                        "type": "esriFieldTypeString",
                        "alias": "smType",
                        "length": 100
                    }, {
                        "name": "handle",
                        "type": "esriFieldTypeString",
                        "alias": "handle",
                        "length": 100
                    }, {
                        "name": "camid",
                        "type": "esriFieldTypeString",
                        "alias": "camid",
                        "length": 100
                    }, {
                        "name": "camindex",
                        "type": "esriFieldTypeString",
                        "alias": "camindex",
                        "length": 100
                    }, {
                        "name": "assoc_station_id",
                        "type": "esriFieldTypeString",
                        "alias": "assoc_station_id",
                        "length": 100
                    }, {
                        "name": "link",
                        "type": "esriFieldTypeString",
                        "alias": "link",
                        "length": 100
                    }, {
                        "name": "linktext",
                        "type": "esriFieldTypeString",
                        "alias": "linktext",
                        "length": 100
                    }, {
                        "name": "cameratype",
                        "type": "esriFieldTypeString",
                        "alias": "cameratype",
                        "length": 100
                    }, {
                        "name": "organization",
                        "type": "esriFieldTypeString",
                        "alias": "organization",
                        "length": 100
                    }, {
                        "name": "neighborhood",
                        "type": "esriFieldTypeString",
                        "alias": "neighborhood",
                        "length": 100
                    }, {
                        "name": "zip",
                        "type": "esriFieldTypeString",
                        "alias": "zip",
                        "length": 100
                    }, {
                        "name": "city",
                        "type": "esriFieldTypeString",
                        "alias": "city",
                        "length": 100
                    }, {
                        "name": "state",
                        "type": "esriFieldTypeString",
                        "alias": "state",
                        "length": 100
                    }, {
                        "name": "country",
                        "type": "esriFieldTypeString",
                        "alias": "country",
                        "length": 100
                    }, {
                        "name": "tzname",
                        "type": "esriFieldTypeString",
                        "alias": "tzname",
                        "length": 100
                    }, {
                        "name": "lat",
                        "type": "esriFieldTypeString",
                        "alias": "lat",
                        "length": 100
                    }, {
                        "name": "lon",
                        "type": "esriFieldTypeString",
                        "alias": "lon",
                        "length": 100
                    }, {
                        "name": "updated",
                        "type": "esriFieldTypeString",
                        "alias": "updated",
                        "length": 100
                    }, {
                        "name": "downloaded",
                        "type": "esriFieldTypeString",
                        "alias": "downloaded",
                        "length": 100
                    }, {
                        "name": "isrecent",
                        "type": "esriFieldTypeString",
                        "alias": "isrecent",
                        "length": 100
                    }, {
                        "name": "CURRENTIMAGEURL",
                        "type": "esriFieldTypeString",
                        "alias": "CURRENTIMAGEURL",
                        "length": 100
                    }, {
                        "name": "WIDGETCURRENTIMAGEURL",
                        "type": "esriFieldTypeString",
                        "alias": "WIDGETCURRENTIMAGEURL",
                        "length": 100
                    }, {
                        "name": "CAMURL",
                        "type": "esriFieldTypeString",
                        "alias": "CAMURL",
                        "length": 100
                    }],
                    "globalIdField": "camid",
                    "displayField": "handle"
                },
                featureSet: {
                    "features": [],
                    "geometryType": "esriGeometryPoint"
                }
            };
            var html = '';
            html += '<p>${city} ${state}, ${zip} ${country}</p>';
            html += '<p><a title="${linktext}" href="${CAMURL}" target="_blank"><img style="width:100%; max-width:100%;" alt="${linktext}" src="${CURRENTIMAGEURL}" /></a></p>';
            html += '<p>Updated: ${updated}</p>';
            this.infoTemplate = new esri.InfoTemplate("Webcam: ${handle}", html);
            this.featureLayer = new esri.layers.FeatureLayer(this.featureCollection, {
                id: this.options.id,
                outFields: ["*"],
                infoTemplate: this.infoTemplate,
                visible: true
            });
            this.options.map.addLayer(this.featureLayer);
            this.stats = {
                geoPoints: 0,
                geoNames: 0,
                noGeo: 0
            };
            this.dataPoints = [];
            this.deferreds = [];
            this.geocoded_ids = {};
            this.loaded = true;
        },
        getCenterPoint: function () {
            var center = this.options.map.extent.getCenter();
            var geoCenter = esri.geometry.webMercatorToGeographic(center);
            return geoCenter;
        },
        update: function (options) {
            declare.safeMixin(this.options, options);
            this.constructQuery();
        },
        pointToExtent: function (map, point, toleranceInPixel) {
            var pixelWidth = map.extent.getWidth() / map.width;
            var toleraceInMapCoords = toleranceInPixel * pixelWidth;
            return new esri.geometry.Extent(point.x - toleraceInMapCoords, point.y - toleraceInMapCoords, point.x + toleraceInMapCoords, point.y + toleraceInMapCoords, map.spatialReference);
        },
        clear: function () {
            // cancel any outstanding requests
            this.query = null;
            arr.forEach(this.deferreds, function (def) {
                def.cancel();
            });
            if (this.deferreds) {
                this.deferreds.length = 0;
            }
            // remove existing Photos
            if (this.options.map.infoWindow.isShowing) {
                this.options.map.infoWindow.hide();
            }
            if (this.featureLayer.graphics.length > 0) {
                this.featureLayer.applyEdits(null, null, this.featureLayer.graphics);
            }
            // clear data
            this.stats = {
                geoPoints: 0,
                noGeo: 0,
                geoNames: 0
            };
            this.dataPoints = [];
            this.geocoded_ids = {};
            this.onClear();
        },
        getStats: function () {
            var x = this.stats;
            x.total = this.stats.geoPoints + this.stats.noGeo + this.stats.geoNames;
            return x;
        },
        // Parse Links
        parseURL: function (text) {
            return text.replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, function (url) {
                return '<a target="_blank" href="' + url + '">' + url + '</a>';
            });
        },
        getPoints: function () {
            return this.dataPoints;
        },
        show: function () {
            this.featureLayer.setVisibility(true);
        },
        hide: function () {
            this.featureLayer.setVisibility(false);
        },
        setVisibility: function (val) {
            if (val) {
                this.show();
            } else {
                this.hide();
            }
        },
        constructQuery: function () {
            var centerPoint = this.getCenterPoint();
            if (location.protocol === "https:") {
                this.baseurl = "https://api.wunderground.com/api/" + this.options.key + "/webcams/q/" + centerPoint.y + "," + centerPoint.x + ".json";
            } else {
                this.baseurl = "http://api.wunderground.com/api/" + this.options.key + "/webcams/q/" + centerPoint.y + "," + centerPoint.x + ".json";
            }
            this.sendRequest(this.baseurl);
        },
        sendRequest: function (url) {
            // get the results for each page
            var deferred = esri.request({
                url: url,
                handleAs: "json",
                timeout: 10000,
                callbackParamName: "callback",
                load: lang.hitch(this, function (data) {
                    if (data.response) {
                        this.mapResults(data);
                        this.onUpdateEnd();
                    } else {
                        // No results found, try another search term
                        this.onUpdateEnd();
                    }
                }),
                error: lang.hitch(this, function (e) {
                    if (deferred.canceled) {
                        console.log('Search Cancelled');
                    } else {
                        console.log('Search error' + ": " + e.message.toString());
                    }
                    this.onError(e);
                })
            });
            this.deferreds.push(deferred);
        },
        unbindDef: function (dfd) {
            // if deferred has already finished, remove from deferreds array
            var index = arr.indexOf(this.deferreds, dfd);
            if (index === -1) {
                return; // did not find
            }
            this.deferreds.splice(index, 1);
            if (!this.deferreds.length) {
                return 2; // indicates we received results from all expected deferreds
            }
            return 1; // found and removed
        },
        mapResults: function (j) {
            var _self = this;
            if (j.error) {
                console.log("mapResults error: " + j.error);
                this.onError(j.error);
                return;
            }
            var b = [];
            var k = j.webcams;
            arr.forEach(k, lang.hitch(this, function (result) {
                result.smType = this.options.id;
                // eliminate geo photos which we already have on the map
                if (this.geocoded_ids[result.camid]) {
                    return;
                }
                this.geocoded_ids[result.camid] = true;
                var geoPoint = null;
                if (result.lat) {
                    var g = [result.lat, result.lon];
                    geoPoint = new esri.geometry.Point(parseFloat(g[1]), parseFloat(g[0]));
                }
                if (geoPoint) {
                    if (isNaN(geoPoint.x) || isNaN(geoPoint.y)) {
                        this.stats.noGeo++;
                    } else {
                        var symbol = esri.symbol.PictureMarkerSymbol(result.WIDGETCURRENTIMAGEURL, 32, 24);
                        // convert the Point to WebMercator projection
                        var a = new esri.geometry.geographicToWebMercator(geoPoint);
                        var graphic = new esri.Graphic(a, symbol, result, _self.infoTemplate);
                        b.push(graphic);
                        this.dataPoints.push({
                            geometry: {
                                x: a.x,
                                y: a.y
                            },
                            symbol: symbol,
                            attributes: result
                        });
                        this.stats.geoPoints++;
                    }
                } else {
                    this.stats.noGeo++;
                }
            }));
            this.featureLayer.applyEdits(b, null, null);
            this.onUpdate();
        },
        onClear: function () {},
        onError: function (info) {
            this.onUpdateEnd();
        },
        onUpdate: function () {},
        onUpdateEnd: function () {}
    });
    return Widget;
});