/***
By: Daniel Gimenez
License: Freeware
Description:
Provides Form validation, access to form inputs, and placeholder polyfill
***/
var dgForms = (function ($) {
    $(document).ready(init);

    var supportsPlaceholders,
        supportsOnInput,
        supportsOnPropertyChange,
        isInitialized = false,
        usingPolyfillPlaceholder = false,
        awaitingAsyncValidationResult = false,
        asyncValidations = {
            keys: [],
            xhrs: [],
            createKey: function (field, validatorName) {
                if (field.name) return '.' + field.name + '$$' + validatorName;
                else if (field.id) return '#' + field.id + '$$' + validatorName;
                else throw ('name or id required');
            },
            add: function (field, validatorName, xhr) {
                var key = this.createKey(field, validatorName);

                this._remove(key);
                this.keys.push(key);
                this.xhrs.push(xhr);
            },
            _remove: function (key) {
                var xhrsIndex = this.keys.indexOf(key),
                    oldXhr;

                if (xhrsIndex >= 0) {
                    oldXhr = this.xhrs[xhrsIndex];
                    if (!oldXhr.statusText && oldXhr.abort) oldXhr.abort();
                    this.keys.splice(xhrsIndex, 1);
                    this.xhrs.splice(xhrsIndex, 1);
                    return true;
                }
                return false;
            },
            remove: function (field, validatorName) {
                return this._remove(this.createKey(field, validatorName));
            },
            hasValidations: function () { return this.keys.length; }
        };
    syncedFields = {
        masterFields: [],
        masterFollowers: {}, // props are masterFields indices
        addToMaster: function (master, follower) {
            var followers = this.getFollowers(master);
            if (!followers) {
                masterIndex = this.masterFields.push(master) - 1;
                this.masterFollowers[masterIndex] = [follower];
            } else {
                // don't re-add the same thing.
                if (followers.indexOf(follower) == -1)
                    followers.push(follower);
            }
        },
        removeFromMaster: function (master, follower) {
            var followers = this.getFollowers(master);
            if (followers) {
                var followerIndex = followers.indexOf(follower);
                if (followerIndex > -1) {
                    followers.splice(followerIndex, 1);
                }
            }
        },
        getFollowers: function (master) {
            var masterIndex = this.masterFields.indexOf(master);
            if (masterIndex > -1) {
                return this.masterFollowers[masterIndex];
            }
            return null;
        },
        eachFollower: function (master, func) {
            var followers = this.getFollowers(master);
            if (followers) {
                for (var i = 0, il = followers.length; i < il; i++) {
                    func(master, followers[i]);
                }
            }
        }
    };

    var my = {
        options: {},
        validators: {},
        syncFields: syncFields,
        validationResultType: {
            failed: false,
            success: true,
            wait: 'wait'
        },
        addValidator: addValidator,
        validate: validate,
        validateField: validateField,
        onAsyncValidationComplete: onAsyncValidationComplete,
        validationCompleted: null,
        liveValidate: liveValidate,
        validatedFields: [],
        setFieldValidationStatus: setFieldValidationStatus,
        getElementUIValue: getElementUIValue,
        setElementUIValue: setElementUIValue,
        getFormValues: getFormValues
    };


    my.options.enablePlaceholderPolyfill = true;
    my.options.defaultClass = 'input-default';

    // email validator
    my.validators.email = createValidator();
    //my.validators.email.re = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
    my.validators.email.validate =
        function (inputValue) {
            return this.re.test(inputValue);
        };


    // required field
    my.validators.required = createValidator();
    my.validators.required.re = /./;
    my.validators.required.validate =
        function (inputValue) {
            return this.re.test(inputValue);
        };


    // do inputs match?
    my.validators.match = createValidator();
    my.validators.match.validate =
        function (inputValue, otherInputID) {
            return ($('#' + otherInputID).val() == inputValue);
        };

    // executes another validator
    my.validators.trigger = createValidator();
    my.validators.trigger.validate =
        function (inputValue, otherInputID) {
            var otherElem = document.getElementById(otherInputID);

            // only trigger if has been touched in the first place.
            if (hasBeenValidated(otherElem)) {
                var failedValidator = validateField(otherElem);
                updateFieldUIForValidity(otherElem, failedValidator);
            }
            // triggers never fail
            return true;
        };

    // cc expiration validator.  A card is expired the first of the month after the input.
    my.validators.ccexpiration = createValidator();
    my.validators.ccexpiration.validate =
        function (yearValue, monthInputID) {
            try {
                // Javascript wierdness: setMonth goes from 0 to 11 (whereas normally its 1 - 12).
                // If it wasn't for this quirk I would have to add 1 since an
                // expiration date for a credit card expires on the last day of the month.
                var ccexpiry = new Date(yearValue, getActualValue(document.getElementById(monthInputID)), 1);
                return (ccexpiry > new Date());
            } catch (err) {
                return false;
            }
        };

    // regular expression validator
    my.validators.re = createValidator();
    my.validators.re.validate =
        function (inputValue, pattern) {
            if (pattern) {
                var re;
                if (pattern.substr(0, 1) == '/') {
                    var seperatorIndex = pattern.lastIndexOf('/');
                    re = new RegExp(pattern.substr(1, seperatorIndex - 2), pattern.substr(seperatorIndex + 1));

                } else {
                    re = new RegExp('^' + pattern + '$', 'i');
                }
                return re.test(inputValue);
            }
            return false;
        };


    function createValidator() {
        return new function () {
            this.isAjax = false;
            this.validate = function () { return false; };
        };
    }
    // adds a new validator and returns the object so that it can be added to if required
    function addValidator(validatorName, validatorFunction) {
        var newValidator = createValidator();

        if (validatorFunction) newValidator.validate = validatorFunction;

        my.validators[validatorName] = newValidator;

        return newValidator;
    }

    // syncs to inputs, with one as the master.
    function syncFields(masterElem, follwerElem, unsync) {
        if (!unsync) {
            setElementUIValue(follwerElem, getElementUIValue(masterElem));
            syncedFields.addToMaster(masterElem, follwerElem);
        } else {
            syncedFields.removeFromMaster(masterElem, follwerElem);
        }

    }

    // call the first time this is started
    function init() {
        if (!isInitialized) {
            var inputElement = document.createElement('input');
            supportsPlaceholders = (inputElement.placeholder !== undefined);
            supportsOnInput = testEvent(inputElement, 'oninput');
            supportsOnPropertyChange = testEvent(inputElement, 'onpropertychange');
            delete inputElement;
            isInitialized = true;
        }
    }
    // start validating form while it is changed
    function liveValidate() {
        init();

        // from http://www.cssnewbie.com/cross-browser-support-for-html5-placeholder-text-in-forms/#.UajNu5xFE7M
        if (!supportsPlaceholders && my.options.enablePlaceholderPolyfill) {

            usingPolyfillPlaceholder = true;
            var active = document.activeElement;
            $(':text').focus(function () {
                    if ($(this).attr('placeholder') && $(this).val() == $(this).attr('placeholder')) {
                        $(this).val('').removeClass('hasPlaceholder');
                    }
                }).blur(function () {
                    if ($(this).attr('placeholder') && (!$(this).val() || $(this).val() == $(this).attr('placeholder'))) {
                        $(this).val($(this).attr('placeholder')).addClass('hasPlaceholder');
                    }
                });


            $('form').submit(function () {
                $(this).find('.hasPlaceholder').each(function () { $(this).val(''); });
            });

            $(':text').blur();
            $(active).focus();

        }

        $('[data-validate]')
            .blur(function () {
                updateFieldUIForValidity(this, validateField(this));
                updateFieldUIForDefaultValue(this, false);
            }).focus(function () {
                updateFieldUIForDefaultValue(this, true);
            }).each(function () {
                bindToInputUpdate(this, function (ev) {
                    if (hasValue(getInputType(this), 'checkbox', 'radio') ||
                        my.validatedFields.indexOf(this) >= 0 ||
                        $(this).attr('data-validateRT') == 'true') {
                        updateFieldUIForValidity(this, validateField(this));
                    }

                    syncedFields.eachFollower(this, function (master, follower) {
                        setElementUIValue(follower, getElementUIValue(master));
                        updateFieldUIForValidity(follower, validateField(follower));
                        updateFieldUIForDefaultValue(follower, follower);
                    });

                    return false;
                });
            });

    }

    // validatess all of the inputs within a dom element
    function validate() {
        var failedValidator;

        $('[data-validate]').each(function () {
            failedValidator = validateField(this);
            updateFieldUIForValidity(this, failedValidator);
            if (my.options.replaceDefault) {
                updateFieldUIForDefaultValue(this, true);
            }
        });

        if (asyncValidations.hasValidations()) {
            awaitingAsyncValidationResult = true;
        }
        else {
            my.validationCompleted($('[data-validate].invalid').length === 0);
        }

    }

    // sets the valid status of an element
    function setFieldValidationStatus(fieldElem, validatorName, isValid) {
        updateFieldUIForValidity(fieldElem, (isValid) ? null : validatorName);
    }

    // depending on if the input has default value, toggles the default css class and sets blanks to default value.
    function updateFieldUIForDefaultValue(fieldElem, isFocused) {
        var inputType,
            nodeName = fieldElem.nodeName;

        if (nodeName == 'SELECT' || (nodeName == 'INPUT' && getInputType(fieldElem) == 'text')) {
            var elementValue = getElementUIValue(fieldElem);
            var currentIsDefault = (
                (elementValue == getElementDefault(fieldElem) && usingPolyfillPlaceholder)
                || elementValue === '');

            if (isFocused) {
                updateFieldClass(fieldElem, my.options.defaultClass, null);
            }
            else if (!isFocused && currentIsDefault) {
                updateFieldClass(fieldElem, null, my.options.defaultClass);
            }
        }
    }

    // updates the ui, adding and removing the class invalid as appropriate
    function updateFieldUIForValidity(fieldElem, failedValidator) {
        if (failedValidator) {
            updateFieldClass(fieldElem, null, 'invalid', failedValidator);
        } else {
            updateFieldClass(fieldElem, 'invalid', null);
        }
    }

    // updates css classes for form fields
    function updateFieldClass(fieldElem, removeClassName, addClassName, matchValidator) {

        var relatedSelector = '[data-updateuifor~="' + fieldElem.id + '"]';

        // if the input has a name, try to update all elements with the same name
        if (fieldElem.name) {
            relatedSelector += ', [data-updateuifor~="' + fieldElem.name + '"]';
            $('[name="' + fieldElem.name + '"]').removeClass(removeClassName)
                .addClass(addClassName).each(function () {

                    if (this.id) $('label[for="' + this.id + '"]')
                        .removeClass(removeClassName).addClass(addClassName);
                });
        } else {
            $(fieldElem).removeClass(removeClassName).addClass(addClassName);
            $('label[for="' + fieldElem.id + '"]').removeClass(removeClassName).addClass(addClassName);
        }


        // shared messages could have a problem
        if (!matchValidator) {
            $(relatedSelector).removeClass(removeClassName).addClass(addClassName);
        } else {
            $(relatedSelector)
                .filter('[data-validator~="' + matchValidator + '"], :not([data-validator])')
                .removeClass(removeClassName).addClass(addClassName);
        }
    }

    // validates a dom element, returns the first failed validator
    function validateField(fieldElem) {
        //fieldElem.dataset.validate failed on some browsers.
        var validatorAttr = $(fieldElem).attr('data-validate'),
            isNegated = ($(fieldElem).attr('data-validationnegated') || false),
            // matches FUNCTION:Optional Parameter. group 2 is single quoted, group 3 has no quotes.
            attrRe = /([^:;]+)(?::(?:(?:'(.*?)')|([^';]*)))?(?:;|$)/g,
            match, validatorName, validator, parameter, validationResult, failedValidator = null;

        if (!hasBeenValidated(fieldElem)) my.validatedFields.push(fieldElem);

        while ((match = attrRe.exec(validatorAttr))) {
            validatorName = match[1];
            validator = my.validators[validatorName];
            parameter = (match[2] !== undefined) ? match[2] : match[3];
            // xor on negated so if true, a valid result would be invalid
            validationResult = validator.validate(getActualValue(fieldElem), parameter, fieldElem);

            if (!validator.isAjax) {
                if ((isNegated) ? validationResult : !validationResult) {
                    failedValidator = validatorName;
                    break;
                }
            }
            else {
                asyncValidations.add(fieldElem, validatorName, validationResult);
                if (validationResult.textStatus) onAsyncValidationComplete(failedValidator, validatorName);
            }
        }

        return failedValidator;
    }

    // checks to see if there are anymore async validations waiting and
    // if there are none, clears the waiting flage and executed the validationCompleted
    // callback.
    function onAsyncValidationComplete(fieldElem, validatorName) {
        asyncValidations.remove(fieldElem, validatorName);
        if (awaitingAsyncValidationResult
            && !asyncValidations.hasValidations()
            && my.validationCompleted) {

            awaitingAsyncValidationResult = false;
            my.validationCompleted($('[data-validate].invalid').length === 0);
        }
    }

    function hasBeenValidated(fieldElem) {
        return (my.validatedFields.indexOf(fieldElem) >= 0);
    }

    // bind to input update.  If unbind is true, then unbinds events to element
    function bindToInputUpdate(fieldElem, func, unbind) {
        var nodeName = fieldElem.nodeName,
            binder = (unbind) ? 'off' : 'on';

        if ((nodeName == 'TEXTAREA') || (nodeName == 'INPUT' &&
            hasValue(fieldElem.type, 'text', 'password'))) {
            $(fieldElem)[binder]('keyup', func);
        }
        if (supportsOnInput) $(fieldElem)[binder]('input', func);
        else if (supportsOnPropertyChange) $(fieldElem)[binder]('propertychange', func);
        $(fieldElem)[binder]('change', func);
    }

    // if element value is still default value, then return the ifDefaultValue
    // this is required if we are polyfilling the placeholder attribute
    function getActualValue(elem, ifDefaultValue) {
        if (ifDefaultValue === undefined) ifDefaultValue = '';
        // if the element has a name get the form value, else get 
        // the value of the current element.
        var elementValue = (elem.name) ?
            getFormValue(elem.name) : getElementUIValue(elem);

        var value = (elementValue == getElementDefault(elem)) ? ifDefaultValue : elementValue;
        return value;
    }

    function getElementDefault(elem) {
        // can't user elem.placeholder as it does not work in some browsers (hence the polyfill)
        var placeholderVal;
        return (usingPolyfillPlaceholder && (placeholderVal = $(elem).attr('placeholder')) != null) ?
            placeholderVal : '';
    }

    // gets the value of what the user interacts with.  so that radios and checks return check state
    // not input value.
    function getElementUIValue(elem) {
        if (!elem) return null;

        switch (elem.nodeName) {
            case 'INPUT':
                var type = getInputType(elem);
                switch (type) {
                    case 'checkbox':
                    case 'radio':
                        return (elem.checked || false);
                    default:
                        return elem.value;
                }
            case 'SELECT':
                var selectedOptions = [];
                for (var i = 0, il = elem.options.length; i < il; i++) {
                    if (elem.options[i].selected) selectedOptions.push(elem.options[i].value);
                }
                return (selectedOptions.length <= 1) ?
                    selectedOptions.join(',') : selectedOptions;
            default:
                return elem.innerHTML;
        }
    }

    // sets the value of an element.  if that element is checkable then the function
    // will update the checkbox not the value.  A select element expects an array
    // for multiple values.  Options will be selected that match array.
    function setElementUIValue(elem, value) {
        if (!elem) return;

        switch (elem.nodeName) {
            case 'INPUT':
                var type = getInputType(elem);
                switch (type) {
                    case 'checkbox':
                    case 'radio':
                        elem.checked = value;
                        break;
                    default:
                        elem.value = value;
                        break;
                }
                break;
            case 'SELECT':
                if (!isArray(value)) value = [value];
                for (var i = 0, il = elem.options.length; i < il; i++) {
                    if (value.indexOf(elem.options[i].value) >= 0) {
                        elem.options[i].selected = true;
                    }
                    else elem.options[i].selected = false;
                }
                break;
            default:
                elem.innerHTML = value;
                break;
        }
    }

    function getElementValue(elem) {
        var value = getElementUIValue(elem);
        return (value === true) ? elem.value : (value === false) ? null : value;
    }

    // gets input value by name
    function getFormValue(name) {
        var values = [], value;
        $('[name="' + name + '"]').each(function () {
            value = getElementValue(this);
            if (isArray(value)) values.concat(value);
            else if (value != null) values.push(value);
        });
        return (values.length <= 1) ? values.join(',') : values;
    }

    // returns the element type.  Assumes inputElem is not null.
    function getInputType(inputElem) {
        return (inputElem.type) ? inputElem.type.toLowerCase() : 'text';
    }

    function getFormValues(parentElem) {
        if (!parentElem) parentElem = document;
        var formValues = {},
            name, value, currentValue;

        $(parentElem).find('input, select, textarea').each(function () {
            if ((name = this.name || this.id) && (value = getElementValue(this))) {
                if (value) {
                    currentValue = formValues[name];
                    if (currentValue == null) formValues[name] = value;
                    else if (isArray(currentValue)) formValues[name].push(value);
                    else formValues[name] = [currentValue, value];
                }
            }
        });
        return formValues;
    }

    // isArray polyfill
    function isArray(obj) {
        Object.prototype.toString.call(obj) === '[object Array]';
    }

    // returns strToFind if match in arguments (past the first arg 
    // which is strToFind of course).  Otherwise null.
    function hasValue(strToFind) {
        for (var i = 1, il = arguments.length; i < il; i++) {
            if (strToFind == arguments[i]) return strToFind;
        }
        return null;
    }

    // is an event supported on element type;
    function testEvent(testOnElem, eventName) {
        var isSupported = (eventName in testOnElem);
        if (!isSupported) {
            testOnElem.setAttribute(eventName, 'return;');
            isSupported = typeof testOnElem[eventName] == 'function';
        }
        return isSupported;
    }

    return my;
}(jQuery));
