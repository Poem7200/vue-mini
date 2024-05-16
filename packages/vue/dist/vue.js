var Vue = (function (exports) {
    'use strict';

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
        function ReactiveEffect(fn) {
            this.fn = fn;
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
        effect.run();
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

    exports.effect = effect;
    exports.reactive = reactive;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map
