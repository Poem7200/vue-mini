var Vue = (function (exports) {
    'use strict';

    /**
     * 收集依赖
     * @param target
     * @param key
     */
    function track(target, key) {
        console.log("依赖收集", target, key);
    }
    /**
     * 触发依赖
     * @param target
     * @param key
     * @param newValue
     */
    function trigger(target, key, newValue) {
        console.log("依赖触发", target, key, newValue);
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
            trigger(target, key, value);
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

    exports.reactive = reactive;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map
