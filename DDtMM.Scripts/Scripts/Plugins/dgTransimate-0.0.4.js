(function ($) {
    var cssPrefix = '',
		stylePrefix = '',
		cssTransformKey = 'transform',
		styleTransformKey = 'transform',
        propKeys = { transformOrigin: 'transformOrigin' },
		reFindTransforms = /(\w+)\s*\(([^)]*)\)/g,
		reParametersSplit = /\s*,\s*/g,
		nameTransformCache = {};

	// make sure cross browser...
	// I don't know if this is nescessary.  Every browser I tried worked on the first options.
	(function () {
	    var $test = $('DIV');
	    var elem = $test[0];
	    
	    if (elem.style['-moz-transform'] !== undefined) { cssPrefix = '-moz-'; stylePrefix = 'Moz'; }
	    else if (elem.style['-ms-transform'] !== undefined) { cssPrefix = '-ms-'; stylePrefix = 'ms'; }
	    else if (elem.style['-webkit-transform'] !== undefined) { cssPrefix = '-webkit-'; stylePrefix = 'Webkit'; }
	    else if (elem.style['-webkit-transform'] !== undefined) { cssPrefix = '-o-'; stylePrefix = 'o'; }
	    else if (elem.style['transform'] !== undefined) { cssPrefix = ''; stylePrefix = ''; }
		else {
			throw ('unable to detect set/get methods for transform style.');
		}
		if (cssPrefix) {
			cssTransformKey = cssPrefix + cssTransformKey;
			styleTransformKey = stylePrefix + 'Transform';
		    // create other keys
			var keyValue;
			for (var i in propKeys) {
			    keyValue = propKeys[i];
			    propKeys[i] = stylePrefix + keyValue[0].toUpperCase() + keyValue.substring(1, keyValue.length);
			}
		}

		$.cssHooks.transformOrigin = {
		    set: function (elem, val, unit) {
		        if (!$.support.matrixFilter) {
		            val = (typeof val === 'string') ? val : val + (unit || '%');
		            elem.style[$.cssProps.transformOrigin] = val;
		        } else {
		            val = val.split(",");
		            $.cssHooks.transformOriginX.set(elem, val[0]);
		            if (val.length > 1) {
		                $.cssHooks.transformOriginY.set(elem, val[1]);
		            }
		        }
		    },
		    get: function (elem, computed) {
		        if (!$.support.matrixFilter) {
		            return elem.style[$.cssProps.transformOrigin];
		        } else {
		            var originX = $.data(elem, 'transformOriginX');
		            var originY = $.data(elem, 'transformOriginY');
		            return originX && originY && originX === originY ? originX : '50%';
		        }
		    }
		};
	}).call();

	function isString(str) {
		return (Object.prototype.toString.call(str) == '[object String]');
	}

    // creates a new transform description from base transform description 
	function createLikeTransWithBaseValuedParams(sourceTrans) {
	    var parameters = [],
            baseNumber = 0;
		
	    if (sourceTrans.name.substring(0, 5) == 'scale') baseNumber = 1;

		for (var i = 0, il = sourceTrans.parameters.length; i < il; i++) {
		    parameters.push({ text: 0, number: baseNumber });
		}

		return new TransformDescription(sourceTrans.name, parameters);
		//{
		//	name: sourceTrans.name,
		//	parameters: parameters
		//};
	}
    
	// creates a regular expression to match a transform of a specific name
	// !uses caches re so not for re.exec!
	function createTransformRe(name) {
		var re;

		if (!(re = nameTransformCache[name])) {
			re = new RegExp(name + "\\s*\\(([^)]*)\\)", "gi");
		}

		return re;
	}

	// parameter on transform
	var TransformParameter = function (number, unit) {
		this.number = Number(number);
		this.unit = unit || '';
	};

	(function () {
		this.number = 0;
		this.unit = '';

		this.translate = function (param) {
			return this.number += param.number;
		};

		this.toString = function () {
			return this.number + this.unit;
		};
	}).call(TransformParameter.prototype);

	function createParameterArray(parameterStr) {
		var match,
        parameters = [];
		reNumberUnit = /([\-+]?\d+(?:\.\d+)?)([^,\s)]+)?/g; ///(\d+(?:\.\d+)?)(%|\w+)?/g;

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

		this.translate = function (transParams) {
			for (var i = 0, il = Math.min(this.parameters.length, transParams.length) ; i < il; i++) {
				this.parameters[i].translate(transParams[i]);
			}
		};
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

	function get(elem) {
		//return window.getComputedStyle(elem, null).getPropertyValue(cssTransformKey);
		return elem.style[styleTransformKey];
	}
	function getParameters(elem, transformName) {
	    //return window.getComputedStyle(elem, null).getPropertyValue(cssTransformKey);
	    var re = createTransformRe(transformName),
            match;

	    if ((match = re.exec(get(elem)))) {
	        return createParameterArray(match[1]);
	    }

	    return null;

	}
	function set(elem, value) {

		return elem.style[styleTransformKey] = value;
	}

	function _updateFromElementTransforms(elem, elemTrans) {
		var transformText = get(elem).replace('none', ''),
			transform, propKey;

		for (var i = 0, il = elemTrans.transforms.length; i < il; i++) {
			transform = elemTrans.transforms[i];

		    // add properties support
			if (!(propKey = propKeys[transform.name])) {
			    if (transformText.indexOf(transform.name) > -1) {
			        transformText = transformText.replace(createTransformRe(transform.name), transform.toString());
			    } else {
			        transformText += ' ' + transform.toString();
			    }
			} else {
			    $(elem).css(propKey, transform.parameters.join(' '));
			}
		}

		set(elem, transformText);

		return this;
	}

	function _updateFromString(elem, str) {
		var match,
			transformText = get(elem).replace('none', ''),
			tranName, propKey;

		while (match = reFindTransforms.exec(str)) {
		    tranName = match[1];
		    if (!(propKey = propKeys[tranName])) {
		        if (transformText.indexOf(tranName) > -1) {
		            transformText = transformText.replace(createTransformRe(tranName), match);
		        } else {
		            transformText += ' ' + match[0];
		        }
		    }
		    else {
		        $(elem).css(propKey, match[1]);
		    }
		}
		set(elem, transformText);

		return this;
	}


	function animationSetup(elem, transformStr, options, animations) {
		if (!options) options = {};

		var match, thisTrans, thisItem, animateTrans, animItem, mode, propKey
            animationDescriptions = {
				items: []
			};

		thisTrans = new ElementTransforms(get(elem));
		animateTrans = new ElementTransforms(transformStr);

		for (var i = 0, il = animateTrans.transforms.length; i < il; i++) {
		    animItem = animateTrans.transforms[i];
		    if (!(propKey = propKeys[animItem.name])) {
		        if (!(thisItem = thisTrans.getByName(animItem.name))) {

		            thisItem = createLikeTransWithBaseValuedParams(animItem);
		        }
		    } else {
		        thisItem = new TransformDescription(animItem.name, elem.style[propKey]);
		    }
			
			if (options.mode == 'rel') animItem.translate(thisItem.parameters);

			animationDescriptions.items.push({
				name: animItem.name,
				start: thisItem.parameters,
				end: animItem.parameters,
			});
		}

		if (!animations) animations = {};
		animations['_dg.transimate'] = 0;

		$(elem).data('_dg.transimate', animationDescriptions).animate(animations, options);

	}

	function animationStep(now, fx) {
	    
		if (fx.prop === "_dg.transimate") {
			var 
				desc = $(this).data('_dg.transimate'),
				transUpdates = new ElementTransforms(),
				paramUpdates, trans, startParam, endParam;

			for (var i = 0, il = desc.items.length; i < il; i++) {
				paramUpdates = [];
				trans = desc.items[i];

				// update parameters
				for (var j = 0, jl = trans.end.length; j < jl; j++) {
					
					startParam = trans.start[j];
					endParam = trans.end[j];

					paramUpdates.push(new TransformParameter(
						startParam.number + (endParam.number - startParam.number) * fx.pos,
						endParam.unit));
					
				}

				transUpdates.add(trans.name, paramUpdates);
			}

			_updateFromElementTransforms(this, transUpdates);
		}
	}
	$.fn.transimate = function (method) {
		var jq = this;

		function jqGet(transformName) {
		    if (jq.length == 0) return null;
		    if (!transformName) {
		        return get(jq[0]);
		    }
		    else {
		        return getParameters(jq[0], transformName);
		    }
		}

		function jqSet(value) {
	
			return jq.each(function() { return set(this, value); });
		}

		function val(value) {
			if (value !== undefined) return jqSet($jq, value);
			return jqGet(jq);
		}

		function contains(name) {
			return createTransformRe(name).test(jq.css(cssTransformKey));
		}

		// updates transforms with transform[s] from string.  
		// Replaces existing transforms, adds new ones to the end
		function update(transforms) {
			var updateMethod = (transforms.constructor == ElementTransforms) ?
				_updateFromElementTransforms : _updateFromString;

			return jq.each(function () { updateMethod(this, transforms) });
		}
		function animate(transforms, options) {
			if (!options) options = {};
			options.step = animationStep;

			return jq.each(function () { animationSetup(this, transforms, options) });
		}
		switch (method) {
		    case 'get': return jqGet(arguments[1]);
			case 'set': return jqSet(arguments[1]);
			case 'val': return val(arguments[1]);
			case 'contains': return contains(arguments[1]);
			case 'update': return update(arguments[1]);
			case 'animate': return animate(arguments[1], arguments[2], arguments[3]);
		    default: { 
		        if (arguments.length == 1) {
		            return jqSet(arguments[0]);
		        } else {
		            return animate(arguments[0], arguments[1], arguments[2]);
		        }
		    }
		}
	};

}(jQuery));
