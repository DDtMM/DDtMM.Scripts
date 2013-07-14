/***
By: Daniel Gimenez
License: Freeware
Description:
Adds functions to array
***/
(function () {

    var filters = {
        // always true
        defaultFilter: function () {
            return true;
        },
        // filters null or undefined
        notNull: function (value) {
            return (value != null);
        },
        // filters null or undefined
        isNull: function (value) {
            return (value == null);
        },
        // filters null or undefined
        inArray: function (value, key, array) {
            return (array.indexOf(value) > -1);
        },
        // filters null or undefined
        notInArray: function (value, key, array) {
            return (array.indexOf(value) == -1);
        },
        // creates a negated filter
        negateFilter: function (filter) {
            return function (value, key, param) {
                return !filter(value, key, param);
            }
        },
        defaultIfNull: function(filter) {
            return filter || filters.defaultFilter;
        }
    }

    var transforms = {
        defaultKeyTransform: function (value, key) {
            return key;
        },
        defaultValueTransform: function (value, key) {
            return value;
        },
        defaultValueIfNull: function(transform) {
            return transform || transforms.defaultValueTransform;
        },
        defaultKeyIfNull: function (transform) {
            return transform || transforms.defaultKeyTransform;
        }
    }

    var aggregateFunctions = aggFuncs = {
        count: function (currentCount) {
            return currentCount + 1;
        },

        sum: function (currentSum, value) {
            return currentSum + value;
        },

        product: function (currentProd, value) {
            return currentProd * value;
        },

        min: function (currentMin, value) {
            return Math.min(currentMin, value);
        },

        max: function (currentMax, value) {
            return Math.max(currentMax, value);
        },

        sumOfDifferenceSquared: function (currentSum, value, differenceFrom) {
            return currentSum + Math.pow(value - differenceFrom, 2);
        }
    }


    function isFunction(object) {
        return typeof (object) == 'function';
    }

    // replacement for add item.
    function _objectAddItem(item, key) {
        this.array.push(item);
        this.keys.push(key);
        return this;
    }

    // replacement for add item.
    function _objectRemoveItem(key) {
        this.array.splice(this.keys.indexOf(key), 1);
        return this;
    }

    function _objectGetKey(index) { return this.keys[index]; }

    var dgQry = function (source) {
        if (source.constructor == dgQry) {
            this.array = source.array;
            this.keys = source.keys;
            this.addItem = source.addItem;
            this.removeItem = source.removeItem;
            this.getKey = source.getKey;
        }
        else if (Array.isArray(source)) this.array = source;
        else if (source) {
            this.array = [];
            // treat as associative array
            this.keys = [];
            for (var i in source) {
                this.keys.push(i);
                this.array.push(source[i]);
            }
            this.addItem = _objectAddItem;
            this.removeItem = _objectRemoveItem;
            this.getKey = _objectGetKey;
        }
    };

    (function () {
        this.array = null;
        this.keys = null;
        this.savedQueries = {};

        /*****
        Filters
        ******/
        // return the first item that causes filter to return true
        this.findFirst = function (filter, filterParam) {

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (filter(this.array[i], this.getKey(i), filterParam)) return this.array[i];
            }
            return null;
        }

        // return the last item that causes filter to return true
        this.findLast = function (filter) {

            for (var i = this.array.length - 1; i >= 0; i--) {
                if (filter(this.array[i], this.getKey(i), filterParam)) return this.array[i];
            }
            return null;
        }

        // returns an array of all found matches
        this.find = function (filter, filterParam) {
            var result = this.createNewOfSameType(),
                value, key;

            for (var i = 0, il = this.array.length; i < il; i++) {
                
                if (filter(value = this.array[i], key = this.getKey(i), filterParam)) {

                    result.addItem(value, key);
                }
                
            }

            return result;
        }

        // negation of findAll
        this.exclude = function (filter, filterParam) {
            var result = this.createNewOfSameType(),
                value, key;

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (!filter(value = this.array[i], key = this.getKey(i), filterParam)) result.addItem(value, key);
            }
            return result;
        }

        /*****
        Transform
        ******/
        // transforms collection to new collection
        this.transform = function (keyTrans, valueTrans) {
            var result,
                value, key;

            valueTrans = transforms.defaultValueIfNull(valueTrans);

            if (keyTrans) {
                result = new dgQry({});
                for (var i = 0, il = this.array.length; i < il; i++) {
                    result.addItem(valueTrans(value = this.array[i], key = this.getKey(i)), keyTrans(value, key));
                }
            } else {
                result = new dgQry([]);
                for (var i = 0, il = this.array.length; i < il; i++) {
                    result.addItem(valueTrans(this.array[i], this.getKey(i)));
                }
            }

            return new dgQry(result);
        }

        this.toObject = function (keyTrans, valueTrans) {
            var valueTrans = transforms.defaultValueIfNull(valueTrans),
                keyTrans = transforms.defaultKeyIfNull(keyTrans),
                obj = {},
                value, key;

            for (var i = 0, il = this.array.length; i < il; i++) {
                obj[keyTrans(value = this.array[i], key = this.getKey(i))] = valueTrans(value, key);
            }

            return obj;
        }

        /*****
        Joins
        ******/
        this.crossJoin = function(obj, myValueTrans, objValueTrans, resultTrans) {
            var myValueTrans = transforms.defaultValueIfNull(myValueTrans),
                objValueTrans = transforms.defaultValueIfNull(objValueTrans),
                resultTrans = transforms.defaultValueIfNull(objValueTrans),
                result = new dgQry([]),
                myVal, objVal, myKey, objKey;

            obj = new dgQry(obj);

            for (var i = 0, il = this.array.length; i < il; i++) {
                myVal = myValueTrans(this.array[i], myKey = this.getKey[i]);
                for (var j = 0, jl = obj.array.length; j < jl; j++) {
                    objVal = myValueTrans(obj.array[j], objVal = obj.getKey[j]);

                    if (myVal == objVal) {
                        result.addItem(resultTrans({ a: myVal, b: objVal }, i), i);
                    }
                }
            }

            return result;
        }
        /********
        boolean
        **********/
        this.all = function (filter, filterParam) {
            return (!this.findFirst(filters.negateFilter(filter), filterParam) || false);
        }

        this.any = function (filter, filterParam) {
            return (this.findFirst(filter, filterParam) && true);
        }

        this.contains = function (item) {
            return !filters.inArray(item, 0, result);
        }

        /*********
        set functions
        **********/
        this.set = function (filter, obj) {
            var result = this.createNewOfSameType(),
                ary = new dgQry(obj).array,
                value, key;
            
            
            filter = filters.defaultIfNull(filter);

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (!filters.inArray(value = this.array[i], key = this.getKey(i), result.array) &&
                    filter(value, key, ary)) result.addItem(value, key);
            }
            return result;
        }

        this.distinct = function () {
            var result = this.createNewOfSameType(),
                value, key;

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (!filters.inArray(value = this.array[i], key = this.getKey(i), result.array))
                    result.addItem(value, key);
            }

            return result;
        }

        this.union = function (obj) {
            return new dgQry(this.array.concat(new dgQry(obj).array)).distinct();
        }
        this.intersect = function (obj) {
            return this.set(filters.inArray, obj);
        }

        this.except = function (obj) {
            return this.set(filters.notInArray, obj);
        }


        /**********
        Aggregate functions
        ***********/
        // executes an aggregate function on an array.
        // init: function(filter) or value
        // func: aggregate function
        // funcParam: object or value.
        this.aggregate = function (init, func, filter, funcParam) {
            var value,
                result = null;

            if (this.array.length) {
                filter = filters.defaultIfNull(filter);

                result = (isFunction(init)) ? init(filter) : init;

                for (var i = 0, il = this.array.length; i < il; i++) {
                    if (filter(value = this.array[i])) result = func(result, value, funcParam);
                }
            }
            return result;
        }

        // process of multiple aggregates at once.
        // agregatesInfo: { init: function(filter) or initial value, func: aggregate function, 
        //   params: value of object with function params}
        // filter: matches on each item
        // includeFilteredArray: adds filtered array to results
        this.aggregates = function (aggregatesInfo, filter, includeFilteredArray) {
            var value, aggInfo,
                aggregateCount = aggregatesInfo.length,
                results = new Array(aggregateCount),
                filteredArray = [],
                pushValueFunc,
                i, il, j;

            if (this.array.length) {
                filter = filters.defaultIfNull(filter);

                // set all the initial values
                for (i = 0; i < aggregateCount; i++) {
                    results[i] = (isFunction(value = aggregatesInfo[i].init)) ? value(filter) : value;
                }

                // instead of calling if each time on includeFilteredArray
                if (includeFilteredArray) pushValueFunc = filteredArray.push;
                else pushValueFunc = function () { };

                for (var i = 0, il = this.array.length; i < il; i++) {
                    if (filter(value = this.array[i])) {

                        pushValueFunc(value);
                        for (j = 0; j < aggregateCount; j++) {
                            aggInfo = aggregatesInfo[j];
                            results[j] = aggInfo.func(results[j], value, aggInfo.params);
                        }
                    }
                }
            }

            if (includeFilteredArray) results.push(filteredArray);

            return results;
        }

        // returns the count of all the values that match evalutor
        this.count = function (filter) {
            return this.aggregate(0, aggFuncs.count, filter);
        }

        // sums all values
        this.sum = function (filter) {
            return this.aggregate(0, aggFuncs.sum, filter);
        }

        // product of all values
        this.product = function (filter) {
            return this.aggregate(1, aggFuncs.product, filter);
        }

        // get smallest value
        this.min = function (filter) {
            return this.aggregate(this.findFirst, aggFuncs.min, filter);
        }

        // get smallest value
        this.max = function (filter) {
            return this.aggregate(this.findFirst, aggFuncs.max, filter);
        }

        // average of values
        this.avg = function (filter) {
            var results = this.aggregates([
                { init: 0, func: aggFuncs.sum },
                { init: 0, func: aggFuncs.count },
            ], filter);
     
            return (results[1]) ? results[0] / results[1] : 0;
        }
        this.var = function (filter) {
            var results = this.aggregates([
                { init: 0, func: aggFuncs.sum },
                { init: 0, func: aggFuncs.count },
            ], filter, true);

            if (results[1]) {
                var avg = (results[1]) ? results[0] / results[1] : 0;
                return dgQry(results[2]).aggregate(0, aggFuncs.sumOfDifferenceSquared, null, null, avg);
            }

            return 0;
        }

        this.stddev = function (filter) {
            return Math.sqrt(this.var(filter));
        }
        /**********
        Reusable queries
        **********/
        // saves a query for reuse
        // savedName is the name for later
        // query: the function name or function
        // filter: the filter to call
        this.saveQuery = function (savedName, query, filter) {
            this._savedQueries[savedName] = {
                query: (typeof query === 'string') ? this[query] : query,
                filter: filter
            }
        }

        // executes a savedQuery
        this.execQuery = function (savedName) {
            var sq = this.savedQueries[savedName];
            return sq.query(sq.filter);
        }

        /********
        Array modification
        *********/
        this.addItem = function (item, key) {
            this.array.push(item);
            return this;
        }

        this.removeItem = function (key) {
            this.array.splice(key, 1);
            return this;
        }

        this.getKey = function (index) {
            return index;
        }

        this.createNewOfSameType = function () {
            return new dgQry((this.keys) ? {} : []);
        }

    }).call(dgQry.prototype);

    window.dgQry = function (array) {
        return new dgQry(array);
    };
})();