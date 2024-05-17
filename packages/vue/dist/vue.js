var Vue = (function (exports) {
    'use strict';

    // 判断是否为一个数组
    // 判断是否为对象
    var isObject = function (val) {
        return val !== null && typeof val === "object";
    };
    // 判断数据是否改变
    var hasChanged = function (value, oldValue) {
        return !Object.is(value, oldValue);
    };
    // 判断是否为函数
    var isFunction = function (val) {
        return typeof val === "function";
    };

    var createDep = function (effects) {
        var dep = new Set(effects);
        return dep;
    };

    var targetMap = new WeakMap();
    function effect(fn) {
        var _effect = new ReactiveEffect(fn);
        // 完成第一次run执行
        _effect.run();
    }
    var activeEffect;
    var ReactiveEffect = /** @class */ (function () {
        function ReactiveEffect(fn, scheduler) {
            if (scheduler === void 0) { scheduler = null; }
            this.fn = fn;
            this.scheduler = scheduler;
        }
        ReactiveEffect.prototype.run = function () {
            // 标记当前触发的effect
            activeEffect = this;
            return this.fn();
        };
        return ReactiveEffect;
    }());
    /**
     * 收集依赖
     * @param target
     * @param key
     */
    function track(target, key) {
        if (!activeEffect)
            return;
        var depsMap = targetMap.get(target);
        if (!depsMap) {
            targetMap.set(target, (depsMap = new Map()));
        }
        var dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = createDep()));
        }
        trackEffects(dep);
        // 这个地方只设置了一对一的关联关系，如果一个key对应多个effect那就不行了
        // depsMap.set(key, activeEffect);
    }
    // 依次收集依赖
    function trackEffects(dep) {
        dep.add(activeEffect);
    }
    /**
     * 触发依赖
     * @param target
     * @param key
     * @param newValue
     */
    function trigger(target, key, newValue) {
        var depsMap = targetMap.get(target);
        if (!depsMap)
            return;
        var dep = depsMap.get(key);
        if (!dep)
            return;
        triggerEffects(dep);
    }
    // 依次触发依赖
    function triggerEffects(dep) {
        Array.from(dep).forEach(function (effect) {
            triggerEffect(effect);
        });
    }
    // 触发指定依赖
    function triggerEffect(effect) {
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
    }

    var get = createGetter();
    function createGetter() {
        return function get(target, key, receiver) {
            var res = Reflect.get(target, key, receiver);
            track(target, key);
            return res;
        };
    }
    var set = createSetter();
    function createSetter() {
        return function set(target, key, value, receiver) {
            var result = Reflect.set(target, key, value, receiver);
            trigger(target, key);
            return result;
        };
    }
    var mutableHandlers = {
        get: get,
        set: set,
    };

    // WeakMap的键必须是对象，且key弱引用（不影响垃圾回收，即key不再有任何引用的时候，会直接回收）
    // 也就是，一旦key里面的这个obj给清除了，则WeakMap对应的key也清除了
    var reactiveMap = new WeakMap();
    function reactive(target) {
        return createReactiveObject(target, mutableHandlers, reactiveMap);
    }
    function createReactiveObject(target, baseHandlers, proxyMap) {
        // 获取proxy缓存
        var existingProxy = proxyMap.get(target);
        if (existingProxy) {
            return existingProxy;
        }
        var proxy = new Proxy(target, baseHandlers);
        proxyMap.set(target, proxy);
        return proxy;
    }
    var toReactive = function (value) {
        return isObject(value) ? reactive(value) : value;
    };

    function ref(value) {
        return createRef(value, false);
    }
    function createRef(rawValue, shallow) {
        if (isRef(rawValue)) {
            return rawValue;
        }
        return new RefImpl(rawValue, shallow);
    }
    var RefImpl = /** @class */ (function () {
        function RefImpl(value, __v_isShallow) {
            this.__v_isShallow = __v_isShallow;
            this.dep = undefined;
            this.__v_isRef = true;
            this._rawValue = value;
            this._value = __v_isShallow ? value : toReactive(value);
        }
        Object.defineProperty(RefImpl.prototype, "value", {
            get: function () {
                // 收集依赖
                trackRefValue(this);
                return this._value;
            },
            set: function (newVal) {
                if (hasChanged(newVal, this._rawValue)) {
                    this._rawValue = newVal;
                    this._value = toReactive(newVal);
                    triggerRefValue(this);
                }
            },
            enumerable: false,
            configurable: true
        });
        return RefImpl;
    }());
    // 收集依赖
    function trackRefValue(ref) {
        if (activeEffect) {
            trackEffects(ref.dep || (ref.dep = createDep()));
        }
    }
    // 触发依赖
    function triggerRefValue(ref) {
        if (ref.dep) {
            triggerEffects(ref.dep);
        }
    }
    // 判断是否为ref
    function isRef(r) {
        return !!(r && r.__v_isRef === true);
    }

    var ComputedRefImpl = /** @class */ (function () {
        function ComputedRefImpl(getter) {
            var _this = this;
            this.dep = undefined;
            this.__v_isRef = true;
            this._dirty = true;
            this.effect = new ReactiveEffect(getter, function () {
                if (!_this._dirty) {
                    _this._dirty = true;
                    triggerRefValue(_this);
                }
            });
            this.effect.computed = this;
        }
        Object.defineProperty(ComputedRefImpl.prototype, "value", {
            get: function () {
                trackRefValue(this);
                // 只有数据脏了（变化了），才要执行effect
                if (this._dirty) {
                    this._dirty = false;
                    this._value = this.effect.run();
                }
                return this._value;
            },
            enumerable: false,
            configurable: true
        });
        return ComputedRefImpl;
    }());
    function computed(getterOrOptions) {
        var getter;
        var onlyGetter = isFunction(getterOrOptions);
        if (onlyGetter) {
            getter = getterOrOptions;
        }
        var cRef = new ComputedRefImpl(getter);
        return cRef;
    }

    exports.computed = computed;
    exports.effect = effect;
    exports.reactive = reactive;
    exports.ref = ref;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map
