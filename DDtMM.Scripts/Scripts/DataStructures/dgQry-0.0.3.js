/***
By: Daniel Gimenez
License: Freeware
Description:
Adds functions to array
***/
(function () {
    // array keys
    var
        // predicate info predicate
        PI_PRED = 0,
        // predicate info parameter
        PI_PARAM = 1,
        // aggregate init value or function
        AGG_INIT = 0,
        // aggregate function
        AGG_FUNC = 1,
        // aggregate param
        AGG_PARAM = 2;

    // predefined predicates
    var predicates = {
        // always true
        defaultPredicate: function () {
            return true;
        },
        // not null or undefined
        notNull: function (value) {
            return (value != null);
        },
        // null or undefined
        isNull: function (value) {
            return (value == null);
        },
        // value in param
        inArray: function (value, key, array) {
            return (array.indexOf(value) > -1);
        },
        // value not in param
        notInArray: function (value, key, array) {
            return (array.indexOf(value) == -1);
        },
        // create negation of predicate
        negate: function (predicate) {
            return function (value, key, param) {
                return !predicate(value, key, param);
            }
        },
        defaultIfNull: function(predicate) {
            return predicate || predicates.defaultPredicate;
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

    var prefixOperators = {
        not: function (value) {
            return !value;
        }
    }

    function isFunction(object) {
        return typeof (object) == 'function';
    }



    var arrayModifiers = {
        addItem: function (item, key) {
            this.array.push(item);
        },

        removeAt: function (index) {
            this.array.splice(index, 1);
        },

        removeItem: function (key) {
            this.array.splice(key, 1);
        },   

        getKey: function (index) {
            return index;
        }
    }

    var objectModifiers = {
        addItem: function (item, key) {
            this.array.push(item);
            this.keys.push(key);
        },

        removeAt: function (index) {
            this.array.splice(index, 1);
            this.keys.splice(index, 1);
        },

        removeItem: function (key) {
            this.array.splice(this.keys.indexOf(key), 1);
        },

        getKey: function (index) {
            return this.keys[index];
        }
    }

    var dgQry = function (source) {
        this.savedQueries = {};
        this.predicateQueue = [];
        this.aggregateQueue = [];

        if (source.constructor == dgQry) {
            this.array = source.array;
            this.keys = source.keys;
            this.collectionModifier = source.collectionModifier;
            
        }
        else if (Array.isArray(source)) {
            // copy of array
            this.array = source.slice(0);
            this.keys = null;
            this.collectionModifier = arrayModifiers;
        }
        else if (source) {
            // treat as associative array
            this.array = [];
            this.keys = [];
            this.collectionModifier = objectModifiers;
            for (var i in source) {
                this.keys.push(i);
                this.array.push(source[i]);
            }
        }
    };

    (function () {
        this.array = null;
        this.keys = null;
        this.savedQueries = {};
        this.predicateQueue = [];
        this.aggregateQueue = [];
        this.collectionModifier = arrayModifiers;
        this._lastAggResults = [];

        /*****
        Filters
        ******/

        // returns an array of all found matches
        this.where = function (predicate, predicateParam) {
            this.predicateQueue.push([predicate, predicateParam]);

            return this;
        }


        this.go = function () {
            var result = this.createNewOfSameType(),
                executionSteps = [],
                continueProcessing, execution;
 

            if (this.predicateQueue.length) executionSteps.push(this._goProcessPredicates);
            if (this.aggregateQueue.length) {
                this._goInitAggregates();
                executionSteps.push(this._goProcessAggregates);
            }
            

            for (var i = 0, il = this.array.length; i < il; i++) {
                value = this.array[i];
                key = this.getKey(i);
                for (var j = 0, jl = executionSteps.length; j < jl; j++) {
                    // keep processing steps until one returns false.
                    if (!executionSteps[j].call(this, value, key)) break;
                }
            }

            this.predicateQueue = [];
            this.aggregateQueue = [];
        }

        this._goInitAggregates = function () {
            var valOrFunc;

            this._lastAggResults = [];

            for (var i = 0, il = this.aggregateQueue.length; i < il; i++) {
                this._lastAggResults.push(
                    (isFunction(valOrFunc = this.aggregateQueue[i][AGG_INIT])) ?
                    valOrFunc(predicate) : valOrFunc);
            }
        }

        this._goProcessPredicates = function (value, key) {
            var predInfo;
            for (var i = 0, il = this.predicateQueue.length; i < il; i++) {
                predInfo = this.predicateQueue[i];
                if (!predInfo[PI_PRED](value, key, predInfo[PI_PARAM])) {
                    this.removeItem(key);
                    return false;
                }
            }
            return true;
        }

        this._goProcessAggregates = function (value, key) {
            var predInfo;
            for (var i = 0, il = this._lastAggResults.length; i < il; i++) {
                aggInfo = this.aggregateQueue[i];
                this._lastAggResults[i] =
                    aggInfo[AGG_FUNC](this._lastAggResults[i], value, aggInfo[AGG_PARAM]);
            }
            return true;
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

        /*********
        set functions
        **********/
        this.set = function (predicate, obj) {
            var result = this.createNewOfSameType(),
                ary = new dgQry(obj).array,
                value, key;


            predicate = predicates.defaultIfNull(predicate);

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (!predicates.inArray(value = this.array[i], key = this.getKey(i), result.array) &&
                    predicate(value, key, ary)) result.addItem(value, key);
            }
            return result;
        }

        this.distinct = function () {
            var result = this.createNewOfSameType(),
                value, key;

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (!predicates.inArray(value = this.array[i], key = this.getKey(i), result.array))
                    result.addItem(value, key);
            }

            return result;
        }

        this.union = function (obj) {
            return new dgQry(this.array.concat(new dgQry(obj).array)).distinct();
        }
        this.intersect = function (obj) {
            return this.set(predicates.inArray, obj);
        }

        this.except = function (obj) {
            return this.set(predicates.notInArray, obj);
        }

        /********
        boolean value functions
        **********/
        this.all = function (predicate, predicateParam) {
            return (!this.findFirst(predicates.negate(predicate), predicateParam) || false);
        }

        this.any = function (predicate, predicateParam) {
            return (this.findFirst(predicate, predicateParam) && true);
        }

        this.contains = function (item) {
            return !predicates.inArray(item, 0, result);
        }

        /*********
        value functions
        **********/
        // return the first item that causes predicate to return true
        this.findFirst = function (predicate, predicateParam) {

            for (var i = 0, il = this.array.length; i < il; i++) {
                if (predicate(this.array[i], this.getKey(i), predicateParam)) return this.array[i];
            }
            return null;
        }

        // return the last item that causes predicate to return true
        this.findLast = function (predicate, predicateParam) {

            for (var i = this.array.length - 1; i >= 0; i--) {
                if (predicate(this.array[i], this.getKey(i), predicateParam)) return this.array[i];
            }
            return null;
        }


        /**********
        Aggregate functions
        ***********/
        // executes an aggregate function on an array.
        // init: function(predicate) or value
        // func: aggregate function
        // funcParam: object or value.
        this.addAggregate = function (init, func, predicate, funcParam, predParam) {
            if (predicate) {
                this.where(predicate, predParam);
            }
            this.aggregateQueue.push([init, func, funcParam]);
            return this;
        }

        this.aggGo = function () {
            this.go();
            return this._lastAggResults[0];
        }
  

        // returns the count of all the values that match evalutor
        this.count = function (predicate) {
            return this.addAggregate(0, aggFuncs.count, predicate).aggGo();
        }

        // sums all values
        this.sum = function (predicate) {
            return this.addAggregate(0, aggFuncs.sum, predicate).aggGo();
        }

        // product of all values
        this.product = function (predicate) {
            return this.addAggregate(1, aggFuncs.product, predicate).aggGo();
        }

        // get smallest value
        this.min = function (predicate) {
            return this.addAggregate(this.findFirst, aggFuncs.min, predicate).aggGo();
        }

        // get smallest value
        this.max = function (predicate) {
            return this.addAggregate(this.findFirst, aggFuncs.max, predicate).aggGo();
        }

        // average of values
        this.avg = function (predicate) {
            this.addAggregate(0, aggFuncs.sum, predicate)
                .addAggregate(0, aggFuncs.count, predicate).go();

            return (this._lastAggResults[1]) ? this._lastAggResults[0] / this._lastAggResults[1] : 0;
        }
        // variance
        this.var = function (predicate) {
            var avg = this.avg(predicate);

            if (avg) {
                var avg = (results[1]) ? results[0] / results[1] : 0;
                return this.addAggregate(0, aggFuncs.sumOfDifferenceSquared, null, avg).aggGo();
            }

            return 0;
        }

        this.stddev = function (predicate) {
            return Math.sqrt(this.var(predicate));
        }
        /**********
        Reusable queries
        **********/
        // saves a query for reuse
        // savedName is the name for later
        // query: the function name or function
        // predicate: the predicate to call
        this.saveQuery = function (savedName, query, predicate, predicateParam) {
            this._savedQueries[savedName] = {
                query: (typeof query === 'string') ? this[query] : query,
                predicate: predicate, 
                predicateParam: predicateParam
            }
        }

        // executes a savedQuery
        this.execQuery = function (savedName, predicateParam) {
            var sq = this.savedQueries[savedName];
            return sq.query(sq.predicate, predicateParam || sq.predicateParam);
        }

        /********
        Array modification
        *********/
        this.addItem = function (item, key) {
            this.collectionModifier.addItem.call(this,item,key)
            return this;
        }

        this.removeAt = function (index) {
            this.collectionModifier.removeAt.call(this, index)
            return this;
        }

        this.removeItem = function (key) {
            this.collectionModifier.removeItem.call(this, key)
            return this;
        }

        this.getKey = function (index) {
            return this.collectionModifier.getKey.call(this, index)
        }

        this.createNewOfSameType = function () {
            return new dgQry((this.keys) ? {} : []);
        }

    }).call(dgQry.prototype);

    window.dgQry = function (array) {
        return new dgQry(array);
    };
})();