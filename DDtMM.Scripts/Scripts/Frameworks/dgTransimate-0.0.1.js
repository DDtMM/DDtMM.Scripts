(function() {
    var setTransFunc, getTransFunc, getTimestamp, PROP_KEYS;
        reFindTransforms = /(\w+)\s*\(([^)]*)\)/g,
        reParametersSplit = /\s*,\s*/g;

    PROP_KEYS = {
        transformOrigin: 'transformOrigin',
        transformStyle: 'transformStyle',
        perspective: 'perspective',
        perspectiveOrigin: 'perspectiveOrigin',
        backfaceVisibility: 'backfaceVisibility',
    };

    function isString(str) {
        return ( Object.prototype.toString.call(str) == '[object String]' ) ;
    }
    // make sure cross browser...
    // I don't know if this is nescessary.  Every browser I tried worked on the first options.
    (function () {
        var testElem = document.createElement('DIV');
        if (testElem.style.transform !== undefined) {
            setTransFunc = function (elem, str) {
                elem.style.transform = str;
            };
            getTransFunc = function (elem) {
                return elem.style.transform;
            };
            
        }
        else if (testElem.style.WebkitTransform !== undefined) {
            setTransFunc = function (elem, str) {
                elem.style.WebkitTransform = str;
            };
            getTransFunc = function (elem) {
                return elem.style.WebkitTransform;
            };
            for (var i in PROP_KEYS) {
                PROP_KEYS[i] = 'Webkit' + PROP_KEYS[i].substring(0, 1).toUpperCase() + PROP_KEYS[i].substring(1);
            }
        }
        else if (testElem.style.msTransform !== undefined) {
            setTransFunc = function (elem, str) {
                elem.style.msTransform = str;
            };
            getTransFunc = function (elem) {
                return elem.style.msTransform;
            };
            for (var i in PROP_KEYS) {
                PROP_KEYS[i] = 'ms' + PROP_KEYS[i].substring(0, 1).toUpperCase() + PROP_KEYS[i].substring(1);
            }
        }
        else {
            throw ('unable to detect set/get methods for transform style.');
        }

        // get timer from http://stackoverflow.com/questions/6875625/does-javascript-provide-a-high-resolution-timer
        if (window.performance.now) {
            getTimestamp = function () { return window.performance.now(); };
        } else if (window.performance.webkitNow) {
            getTimestamp = function () { return window.performance.webkitNow(); };
        } else {
            getTimestamp = function () { return new Date().getTime(); };
        }

    }).call();

    function createLikeTransWithZeroValuedParams(sourceTrans) {
        var parameters = [];

        for (var i = 0, il = sourceTrans.parameters.length; i < il; i++) {
            parameters.push({ text: 0, number: 0 });
        }

        return {
            name: sourceTrans.name,
            parameters: parameters
        };
    }
    


    // creates a regular expression to match a transform of a specific name
    // !uses caches re so not for re.exec!
    function createTransformRe(name) {
        var re;

        if (!(re = nameTransformCache[name])) {
            re = new RegExp(name + "\\s*\\([^)]*\\)", "gi"); 
        }
        
        return re;
    }
    var nameTransformCache = { };

    // parameter on transform
    var TransformParameter = function (number, unit) {
        this.number = Number(number);
        this.unit = unit || '';
    };

    (function () {
        this.number = 0;
        this.unit = '';

        this.toString = function () {
            return this.number + this.unit;
        };
    }).call(TransformParameter.prototype);

    function createParameterArray (parameterStr) {
        var match,
        parameters = [];
        reNumberUnit = /(\d+(?:\.\d+)?)([^,)]+)?/g; ///(\d+(?:\.\d+)?)(%|\w+)?/g;

        while (match = reNumberUnit.exec(parameterStr)) {
            parameters.push(new TransformParameter(match[1], match[2]));
        }

        return parameters;
    }
    // single transform
    var TransformDescription = function (name, parameters) {
        this.name = name;
        this.parameters = (!Array.isArray(parameters)) ? createParameterArray(parameters) : parameters;
    };

    (function () {
        this.name = '';
        this.parameters = [];

        this.toString = function () {
            return this.name + '(' + this.parameters.join(', ') + ')';
        };
    }).call(TransformDescription.prototype);

    // transforms on an element
    var ElementTransforms = function (str) {
        this.transforms = [];
        this.names = [];

        if (str) {
            var match, name, parameters;

            while (match = reFindTransforms.exec(str)) {
                this.add(match[1], match[2]);
            }
        }
    };

    (function () {
        this.transforms = [];
        this.names = [];

        this.add = function (name, parameters) {
            this.transforms.push(new TransformDescription(name, parameters));
            this.names.push(name);
        };

        this.getByName = function (name) {
            return this.transforms[this.names.indexOf(name)];
        };

        this.contains = function (name) {
            return this.names.indexOf(name);
        };

        this.toString = function () {
            return this.transforms.join(' ');
        };
    }).call(ElementTransforms.prototype);

    var Animator = (function () {
        var inProgress = [],
            timeoutId = -1;

        // an animation description with one or more transforms to animate
        function add(animationDesc) {
            inProgress.push(animationDesc);
            if (timeoutId == -1) start();
        }

        function start() {
            stepTime = new Date();
            timeoutId = setInterval(step, this.stepDelay);
        }

        function stop() {
            clearInterval(timeoutId);
            timeoutId = -1;
        }
        function step() {
            var stepTime,
                desc,
                progress,
                trans,
                transUpdates,
                paramUpdates,
                startParam,
                endParam;
                
            stepTime = getTimestamp();

            // update elements
            for (var i = inProgress.length - 1; i >= 0; i--) {
                desc = inProgress[i];
                
                progress = Math.min((stepTime - desc.time) / desc.duration, 1);

                transUpdates = new ElementTransforms();

                // update element
                for (var j = 0, jl = desc.items.length; j < jl; j++) {
                    paramUpdates = [];
                    trans = desc.items[j];

                    // update parameters
                    for (var k = 0, kl = trans.end.length; k < kl; k++) {
                        startParam = trans.start[k];
                        endParam = trans.end[k];
                        paramUpdates.push(new TransformParameter(
                            startParam.number + (endParam.number - startParam.number) * progress,
                            endParam.unit));
                        
                    }

                    transUpdates.add(trans.name, paramUpdates);
                }


                // save update
                desc.me._updateFromElementTransforms(transUpdates);

                // remove completed
                if (progress == 1) {
                    inProgress.splice(i, 1);
                    if (desc.callback) desc.callback.call(desc.me);
                }

            }

            // stop if empty
            if (!inProgress.length) stop();
        }
        return my = {
            stepDelay: 20,
            add: add
        };
    })();

    // Tranz
    var Tranz = function (elem) {
        this.elem = (typeof elem == 'string') ? document.getElementById(elem) : elem;
    };

    (function () {
        this.elem = null;
        // sets transform style
        this.set = function (str) {
            setTransFunc(this.elem, str);
            return this;
        };
        // gets string of transform style
        this.get = function () {
            return getTransFunc(this.elem);
        };
        // adds a trasnform. Use update(str) to replace existing transforms.
        this.add = function (str) {
            this.set(this.get() + ' ' + str);
            return this;
        };
        // sets or gets transform property, key can be either a string, or an object like { a: b, c: d } to set values
        this.prop = function (key, value) {
            console.log('hi1');
            if (!isString(key)) return this.setProps(key);
            if (value !== undefined) {
                this.elem.style[PROP_KEYS[key] || key] = value;
                console.log('hi2');
                return this;
            }
            console.log('hi');
            return this.elem.style[PROP_KEYS[key] || key];
        };
        // sets props from object
        this.setProps = function (obj) {
            for (var i in obj) {
                this.elem.style[PROP_KEYS[i.toString()] || i] = obj[i];
            }
            return this;
        }
        // return true if a transform
        this.contains = function (name) {
            return createTransformRe(name).test(this.get());
        };

        // updates transforms with transform[s] from string.  
        // Replaces existing transforms, adds new ones to the end
        this.update = function (transforms) {
            return (transforms.constructor == ElementTransforms) ?
                this._updateFromElementTransforms(transforms) : this._updateFromString(transforms);
        };

        this._updateFromElementTransforms = function (elemTrans) {
            var transformText = this.get(),
                transform;

            for (var i = 0, il = elemTrans.transforms.length; i < il; i++) {
                transform = elemTrans.transforms[i];

                if (transformText.indexOf(transform.name) > -1) {
                    transformText = transformText.replace(createTransformRe(transform.name), transform.toString());
                } else {
                    transformText += ' ' + transform.toString();
                }
            }
            this.set(transformText);

            return this;
        };
        this._updateFromString = function (str) {
            var match,
                transformText = this.get(),
                tranName;

            while (match = reFindTransforms.exec(str)) {
                tranName = match[1];
                if (transformText.indexOf(tranName) > -1) {
                    transformText = transformText.replace(createTransformRe(tranName), match);
                } else {
                    transformText += ' ' + match[0];
                }
            }
            this.set(transformText);

            return this;
        };
        // removes a transform
        this.remove = function (name) {
            this.set(this.get().replace(createTransformRe(name), ""));
            return this;
        };
        // represent transforms as object.  Might be easier later on to animate with this.
        // [str] is optional, if not provided gets transform of this instance.
        this.getTransformObject = function (str) {
            return new ElementTransforms(str);
        };
        // animate
        this.animate = function (str, duration, callback) {
            var match, thisTrans, thisItem, animateTrans, animItem,
                animationDescription = {
                    duration: duration,
                    items: [],
                    me: this,
                    time: getTimestamp(),
                    callback: callback
                };

            thisTrans = new ElementTransforms(this.get());
            animateTrans = new ElementTransforms(str);

            for (var i = 0, il = animateTrans.transforms.length; i < il; i++) {
                animItem = animateTrans.transforms[i];
                if (!(thisItem = thisTrans.getByName(animItem.name))) {
                    thisItem = createLikeTransWithZeroValuedParams(animItem);
                }

                animationDescription.items.push({
                    name: animItem.name,
                    start: thisItem.parameters,
                    end: animItem.parameters,
                });
            }

            Animator.add(animationDescription);
        };
    }).call(Tranz.prototype);

    // add a window module
    window.transimate = function (elem) {
        return new Tranz(elem);
    };
})();

