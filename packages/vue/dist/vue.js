var Vue = (function (exports) {
    'use strict';

    var toDisplayString = function (val) {
        return String(val);
    };

    function normalizeClass(value) {
        var res = "";
        if (isString(value)) {
            res = value;
        }
        else if (isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                var normalized = normalizeClass(value[i]);
                if (normalized) {
                    res += normalized + " ";
                }
            }
        }
        else if (isObject(value)) {
            for (var name_1 in value) {
                if (value[name_1]) {
                    res += name_1 + " ";
                }
            }
        }
        return res.trim();
    }

    // 判断是否为一个数组
    var isArray = Array.isArray;
    // 判断是否为对象
    var isObject = function (val) {
        return val !== null && typeof val === "object";
    };
    // 判断是否为字符串
    var isString = function (val) {
        return typeof val === "string";
    };
    // 判断数据是否改变
    var hasChanged = function (value, oldValue) {
        return !Object.is(value, oldValue);
    };
    // 判断是否为函数
    var isFunction = function (val) {
        return typeof val === "function";
    };
    var extend = Object.assign;
    var EMPTY_OBJ = {};
    var onRE = /^on[^a-z]/;
    var isOn = function (key) { return onRE.test(key); };

    var createDep = function (effects) {
        var dep = new Set(effects);
        return dep;
    };

    var targetMap = new WeakMap();
    function effect(fn, options) {
        var _effect = new ReactiveEffect(fn);
        if (options) {
            extend(_effect, options);
        }
        if (!options || !options.lazy) {
            // 完成第一次run执行
            _effect.run();
        }
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
        ReactiveEffect.prototype.stop = function () { };
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
        // 先执行计算属性的effect
        Array.from(dep).forEach(function (effect) {
            effect.computed && triggerEffect(effect);
        });
        // 再执行非计算属性的effect
        Array.from(dep).forEach(function (effect) {
            !effect.computed && triggerEffect(effect);
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
        // 这个属性是用来判断是否为reactive的
        proxy["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */] = true;
        proxyMap.set(target, proxy);
        return proxy;
    }
    var toReactive = function (value) {
        return isObject(value) ? reactive(value) : value;
    };
    function isReactive(value) {
        return !!(value && value["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */]);
    }

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

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    var isFlushPending = false;
    var resolvedPromise = Promise.resolve();
    var pendingPreFlushCbs = [];
    function queuePreFlushCb(cb) {
        queueCb(cb, pendingPreFlushCbs);
    }
    function queueCb(cb, pendingQueue) {
        pendingQueue.push(cb);
        queueFlush();
    }
    function queueFlush() {
        if (!isFlushPending) {
            isFlushPending = true;
            resolvedPromise.then(flushJobs);
        }
    }
    function flushJobs() {
        isFlushPending = false;
        flushPreFlushCbs();
    }
    function flushPreFlushCbs() {
        if (pendingPreFlushCbs.length) {
            var activePreFlushCbs = __spreadArray([], __read(new Set(pendingPreFlushCbs)), false);
            pendingPreFlushCbs.length = 0;
            for (var i = 0; i < activePreFlushCbs.length; i++) {
                activePreFlushCbs[i]();
            }
        }
    }

    function watch(source, cb, options) {
        return doWatch(source, cb, options);
    }
    function doWatch(source, cb, _a) {
        var _b = _a === void 0 ? EMPTY_OBJ : _a, immediate = _b.immediate, deep = _b.deep;
        var getter;
        if (isReactive(source)) {
            getter = function () { return source; };
            deep = true;
        }
        else {
            getter = function () { };
        }
        if (cb && deep) {
            var baseGetter_1 = getter;
            getter = function () { return traverse(baseGetter_1()); };
        }
        var oldValue = {};
        // 本质上为了拿到newValue
        var job = function () {
            if (cb) {
                var newValue = effect.run();
                if (deep || hasChanged(newValue, oldValue)) {
                    cb(newValue, oldValue);
                    oldValue = newValue;
                }
            }
        };
        var scheduler = function () { return queuePreFlushCb(job); };
        var effect = new ReactiveEffect(getter, scheduler);
        if (cb) {
            if (immediate) {
                job();
            }
            else {
                oldValue = effect.run();
            }
        }
        else {
            effect.run();
        }
        return function () {
            effect.stop();
        };
    }
    function traverse(value) {
        if (!isObject(value)) {
            return value;
        }
        for (var key in value) {
            traverse(value[key]);
        }
        return value;
    }

    var Fragment = Symbol("Fragment");
    var Text = Symbol("Text");
    var Comment = Symbol("Comment");
    function isVNode(value) {
        return value ? value.__v_isVNode === true : false;
    }
    /**
     * 生成一个VNode对象，并返回
     * @param type vnode类型
     * @param props 标签/自定义属性
     * @param children 子节点
     * @returns vnode对象
     */
    function createVNode(type, props, children) {
        if (props) {
            var klass = props.class; props.style;
            if (klass && !isString(klass)) {
                props.class = normalizeClass(klass);
            }
        }
        var shapeFlag = isString(type)
            ? 1 /* ShapeFlags.ELEMENT */
            : isObject(type)
                ? 4 /* ShapeFlags.STATEFUL_COMPONENT */
                : 0;
        return createBaseVNode(type, props, children, shapeFlag);
    }
    // 创建基础vnode
    function createBaseVNode(type, props, children, shapeFlag) {
        var vnode = {
            __v_isVNode: true,
            type: type,
            props: props,
            shapeFlag: shapeFlag,
            key: (props === null || props === void 0 ? void 0 : props.key) || null,
        };
        normalizeChildren(vnode, children);
        return vnode;
    }
    function normalizeChildren(vnode, children) {
        var type = 0;
        if (children == null) {
            children = null;
        }
        else if (isArray(children)) {
            type = 16 /* ShapeFlags.ARRAY_CHILDREN */;
        }
        else if (typeof children === "object") ;
        else if (isFunction(children)) ;
        else {
            children = String(children);
            type = 8 /* ShapeFlags.TEXT_CHILDREN */;
        }
        vnode.children = children;
        vnode.shapeFlag |= type;
    }
    function isSameVNodeType(oldVNode, newVNode) {
        return oldVNode.type === newVNode.type && oldVNode.key === newVNode.key;
    }
    function createCommentVNode(text) {
        return createVNode(Comment, null, text);
    }

    function h(type, propsOrChildren, children) {
        var l = arguments.length;
        if (l == 2) {
            if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
                if (isVNode(propsOrChildren)) {
                    return createVNode(type, null, [propsOrChildren]);
                }
                return createVNode(type, propsOrChildren, []);
            }
            else {
                return createVNode(type, null, propsOrChildren);
            }
        }
        else {
            if (l > 3) {
                children = Array.prototype.slice.call(arguments, 2);
            }
            else if (l === 3 && isVNode(children)) {
                children = [children];
            }
            return createVNode(type, propsOrChildren, children);
        }
    }

    function renderComponentRoot(instance) {
        var vnode = instance.vnode, render = instance.render, _a = instance.data, data = _a === void 0 ? {} : _a;
        var result;
        try {
            if (vnode.shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */) {
                result = normalizeVNode(render.call(data, data));
            }
        }
        catch (err) {
            console.error(err);
        }
        return result;
    }
    function normalizeVNode(child) {
        if (typeof child === "object") {
            // child是对象意味着已经是VNode了，其实可以直接返回，这里是对标了源码
            return cloneIfMounted(child);
        }
        else {
            return createVNode(Text, null, String(child));
        }
    }
    function cloneIfMounted(child) {
        return child;
    }

    function injectHook(type, hook, target) {
        if (target) {
            target[type] = hook;
            return hook;
        }
    }
    var createHook = function (lifecycle) {
        return function (hook, target) { return injectHook(lifecycle, hook, target); };
    };
    var onBeforeMount = createHook("bm" /* LifecycleHooks.BEFORE_MOUNT */);
    var onMounted = createHook("m" /* LifecycleHooks.MOUNTED */);

    var uid = 0;
    function createComponentInstance(vnode) {
        var type = vnode.type;
        var instance = {
            uid: uid++,
            vnode: vnode,
            type: type,
            subTree: null,
            effect: null,
            update: null,
            render: null,
            // 生命周期相关
            isMounted: false,
            bc: null,
            c: null,
            bm: null,
            m: null,
        };
        return instance;
    }
    function setupComponent(instance) {
        setupStatefulComponent(instance);
    }
    function setupStatefulComponent(instance) {
        var Component = instance.type;
        // 提供了两种api：composition和setup
        var setup = Component.setup;
        if (setup) {
            var setupResult = setup();
            handleSetupResult(instance, setupResult);
        }
        else {
            finishComponentSetup(instance);
        }
    }
    function handleSetupResult(instance, setupResult) {
        if (isFunction(setupResult)) {
            instance.render = setupResult;
        }
        finishComponentSetup(instance);
    }
    function finishComponentSetup(instance) {
        var Component = instance.type;
        if (!instance.render) {
            instance.render = Component.render;
        }
        applyOptions(instance);
    }
    function applyOptions(instance) {
        var _a = instance.type, dataOptions = _a.data, beforeCreate = _a.beforeCreate, created = _a.created, beforeMount = _a.beforeMount, mounted = _a.mounted;
        // beforeCreate在数据初始化之前
        if (beforeCreate) {
            callHook(beforeCreate, instance.data);
        }
        if (dataOptions) {
            var data = dataOptions();
            if (isObject(data)) {
                instance.data = reactive(data);
            }
        }
        // 数据初始化完成后，created执行
        if (created) {
            callHook(created, instance.data);
        }
        function registerLifecycleHook(register, hook) {
            register(hook === null || hook === void 0 ? void 0 : hook.bind(instance.data), instance);
        }
        registerLifecycleHook(onBeforeMount, beforeMount);
        registerLifecycleHook(onMounted, mounted);
    }
    function callHook(hook, proxy) {
        hook.bind(proxy)();
    }

    function createRenderer(options) {
        return baseCreateRenderer(options);
    }
    function baseCreateRenderer(options) {
        var hostInsert = options.insert, hostPatchProp = options.patchProp, hostCreateElement = options.createElement, hostSetElementText = options.setElementText, hostRemove = options.remove, hostCreateText = options.createText, hostSetText = options.setText, hostCreateComment = options.createComment;
        var processText = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                // 挂载
                newVNode.el = hostCreateText(newVNode.children);
                hostInsert(newVNode.el, container, anchor);
            }
            else {
                // 更新
                var el = (newVNode.el = oldVNode.el);
                if (newVNode.children !== oldVNode.children) {
                    hostSetText(el, newVNode.children);
                }
            }
        };
        var processComment = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                newVNode.el = hostCreateComment(newVNode.children);
                hostInsert(newVNode.el, container, anchor);
            }
            else {
                newVNode.el = oldVNode.el;
            }
        };
        var processElement = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                // 挂载
                mountElement(newVNode, container, anchor);
            }
            else {
                // 更新
                patchElement(oldVNode, newVNode);
            }
        };
        var processFragment = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                mountChildren(newVNode.children, container, anchor);
            }
            else {
                patchChildren(oldVNode, newVNode, container, anchor);
            }
        };
        var processComponent = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                mountComponent(newVNode, container, anchor);
            }
        };
        var mountComponent = function (initialVNode, container, anchor) {
            initialVNode.component = createComponentInstance(initialVNode);
            var instance = initialVNode.component;
            setupComponent(instance);
            setupRenderEffect(instance, initialVNode, container, anchor);
        };
        var setupRenderEffect = function (instance, initialVNode, container, anchor) {
            var componentUpdateFn = function () {
                if (!instance.isMounted) {
                    // beforeMount和mounted生命周期
                    var bm = instance.bm, m = instance.m;
                    bm && bm();
                    var subTree = (instance.subTree = renderComponentRoot(instance));
                    patch(null, subTree, container, anchor);
                    // 挂载完成后，触发mounted
                    m && m();
                    initialVNode.el = subTree.el;
                    // 渲染完成后，更新渲染标记
                    instance.isMounted = true;
                }
                else {
                    var next = instance.next, vnode = instance.vnode;
                    if (!next) {
                        next = vnode;
                    }
                    var nextTree = renderComponentRoot(instance);
                    var prevTree = instance.subTree;
                    instance.subTree = nextTree;
                    patch(prevTree, nextTree, container, anchor);
                    next.el = nextTree.el;
                }
            };
            var effect = (instance.effect = new ReactiveEffect(componentUpdateFn, function () { return queuePreFlushCb(update); }));
            var update = (instance.update = function () { return effect.run(); });
            update();
        };
        var mountElement = function (vnode, container, anchor) {
            var type = vnode.type, props = vnode.props, shapeFlag = vnode.shapeFlag;
            // 创建element
            var el = (vnode.el = hostCreateElement(type));
            if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                // 设置文本
                hostSetElementText(el, vnode.children);
            }
            else if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                mountChildren(vnode.children, el, anchor);
            }
            // 设置props
            if (props) {
                for (var key in props) {
                    hostPatchProp(el, key, null, props[key]);
                }
            }
            // 插入
            hostInsert(el, container, anchor);
        };
        var patchElement = function (oldVNode, newVNode) {
            var el = (newVNode.el = oldVNode.el);
            var oldProps = oldVNode.props || EMPTY_OBJ;
            var newProps = newVNode.props || EMPTY_OBJ;
            patchChildren(oldVNode, newVNode, el, null);
            patchProps(el, newVNode, oldProps, newProps);
        };
        var mountChildren = function (children, container, anchor) {
            if (isString(children)) {
                children = children.split("");
            }
            for (var i = 0; i < children.length; i++) {
                var child = (children[i] = normalizeVNode(children[i]));
                patch(null, child, container, anchor);
            }
        };
        var patchChildren = function (oldVNode, newVNode, container, anchor) {
            var c1 = oldVNode && oldVNode.children;
            var c2 = newVNode && newVNode.children;
            var prevShapeFlag = oldVNode ? oldVNode.shapeFlag : 0;
            var newShapeFlag = newVNode.shapeFlag;
            if (newShapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                if (c2 !== c1) {
                    // 挂载新的子节点文本
                    hostSetElementText(container, c2);
                }
            }
            else {
                if (prevShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                    if (newShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                        // diff计算
                        patchKeyedChildren(c1, c2, container, anchor);
                    }
                }
                else {
                    if (prevShapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                        // 删除旧节点text
                        hostSetElementText(container, "");
                    }
                }
            }
        };
        var patchKeyedChildren = function (oldChildren, newChildren, container, parentAnchor) {
            var i = 0;
            var newChildrenLength = newChildren.length;
            var oldChildrenEnd = oldChildren.length - 1;
            var newChildrenEnd = newChildrenLength - 1;
            // 场景1: 自前向后
            while (i <= oldChildrenEnd && i <= newChildrenEnd) {
                var oldVNode = oldChildren[i];
                var newVNode = normalizeVNode(newChildren[i]);
                if (isSameVNodeType(oldVNode, newVNode)) {
                    patch(oldVNode, newVNode, container, null);
                }
                else {
                    break;
                }
                i++;
            }
            // 场景2：自后向前
            while (i <= oldChildrenEnd && i <= newChildrenEnd) {
                var oldVNode = oldChildren[oldChildrenEnd];
                var newVNode = normalizeVNode(newChildren[newChildrenEnd]);
                if (isSameVNodeType(oldVNode, newVNode)) {
                    patch(oldVNode, newVNode, container, null);
                }
                else {
                    break;
                }
                oldChildrenEnd--;
                newChildrenEnd--;
            }
            // 场景3：新节点多于旧节点
            // i移动到了最后一个位置，如果两条都通过，说明旧节点数量少于新节点
            if (i > oldChildrenEnd) {
                if (i <= newChildrenEnd) {
                    var nextPos = newChildrenEnd + 1;
                    /**
                     * 下一个插入的位置
                     * 1. 插入在后，则新节点的末尾下标+1 >= 新节点数量，插入位置应该是父节点anchor（最后一个）
                     * 2. 插入在前，因为场景2，新节点末尾下标挪到0了，所以新节点末尾下标+1 < 新节点数量，插入的位置就应该是新节点末尾下标+1这个地方之前
                     */
                    var anchor = nextPos < newChildrenLength ? newChildren[nextPos].el : parentAnchor;
                    while (i <= newChildrenEnd) {
                        patch(null, normalizeVNode(newChildren[i]), container, anchor);
                        i++;
                    }
                }
            }
            // 场景4：旧节点多于新节点
            else if (i > newChildrenEnd) {
                while (i <= oldChildrenEnd) {
                    unmount(oldChildren[i]);
                    i++;
                }
            }
            // 场景5：乱序
            else {
                var oldStartIndex = i;
                var newStartIndex = i;
                // 第一部分：创建新节点的key->index的map映射
                var keyToNewIndexMap = new Map();
                for (i = newStartIndex; i <= newChildrenEnd; i++) {
                    var nextChild = normalizeVNode(newChildren[i]);
                    if (nextChild.key != null) {
                        keyToNewIndexMap.set(nextChild.key, i);
                    }
                }
                // 第二部分：循环旧节点，完成打补丁/删除（不移动）
                var j = void 0;
                var patched = 0; // 已经打补丁的数量（针对新节点）
                var toBePatched = newChildrenEnd - newStartIndex + 1; // 需要打补丁的数量（针对新节点）
                var moved = false; // 标记当前节点是否需要移动
                var maxNewIndexSoFar = 0; // 配合moved使用，保存当前最大新节点的index
                // 新节点下标到旧节点下标的map，并给这个map每一项都赋值0
                // 这个数组的下标是新节点的下标，每个下标的值是旧节点的对应key的元素的index+1
                // 例如新节点0对应的旧节点是在1，则记录为[2]
                var newIndexToOldIndexMap = new Array(toBePatched);
                for (i = 0; i < toBePatched; i++)
                    newIndexToOldIndexMap[i] = 0;
                // 循环旧节点
                for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
                    var prevChild = oldChildren[i];
                    // 如果已经打补丁的数量超过了需要打补丁的数量，开始卸载
                    if (patched >= toBePatched) {
                        unmount(prevChild);
                        continue;
                    }
                    // 新节点要存放的位置
                    var newIndex = void 0;
                    if (prevChild.key != null) {
                        // 从之前新节点key->index的map中拿到新节点位置
                        newIndex = keyToNewIndexMap.get(prevChild.key);
                    }
                    // 这里源码里面有个else，是处理那些没有key的节点的
                    // 没找到新节点索引，说明旧节点应该删除了
                    if (newIndex === undefined) {
                        unmount(prevChild);
                    }
                    // 找到新节点索引，应该打补丁（先打补丁）
                    else {
                        newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1;
                        // 新节点index和当前最大新节点index比较，如果不比它大，则应该触发移动
                        if (newIndex >= maxNewIndexSoFar) {
                            maxNewIndexSoFar = newIndex;
                        }
                        else {
                            moved = true;
                        }
                        patch(prevChild, newChildren[newIndex], container, null);
                        patched++;
                    }
                }
                // 第三部分：移动和挂载
                // 拿到newIndex到oldIndex这个映射数组的最长递增子序列
                var increasingNewIndexSequence = moved
                    ? getSequence(newIndexToOldIndexMap)
                    : [];
                j = increasingNewIndexSequence.length - 1;
                // 循环倒序，把需要patch的节点做一遍处理
                for (i = toBePatched - 1; i >= 0; i--) {
                    // 拿到新节点
                    var nextIndex = newStartIndex + i;
                    var nextChild = newChildren[nextIndex];
                    // 类似场景四，做插入处理
                    var anchor = nextIndex + 1 < newChildrenLength
                        ? newChildren[nextIndex + 1].el
                        : parentAnchor;
                    // 新节点没有找到旧节点，插入
                    if (newIndexToOldIndexMap[i] === 0) {
                        patch(null, nextChild, container, anchor);
                    }
                    // 如果需要移动，根据最长递增子序列做处理
                    else if (moved) {
                        // 如果不存在最长递增子序列/当前index不是最长递增子序列的最后一个元素，做移动
                        if (j < 0 || i !== increasingNewIndexSequence[j]) {
                            move(nextChild, container, anchor);
                        }
                        else {
                            j--;
                        }
                    }
                }
            }
        };
        var patchProps = function (el, vnode, oldProps, newProps) {
            if (oldProps !== newProps) {
                for (var key in newProps) {
                    var next = newProps[key];
                    var prev = oldProps[key];
                    if (next !== prev) {
                        hostPatchProp(el, key, prev, next);
                    }
                }
                if (oldProps !== EMPTY_OBJ) {
                    for (var key in oldProps) {
                        // 对于老的props中有的，但是新的没有的，就不用留一个空值，而是删除
                        if (!(key in newProps)) {
                            hostPatchProp(el, key, oldProps[key], null);
                        }
                    }
                }
            }
        };
        var patch = function (oldVNode, newVNode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            if (oldVNode === newVNode) {
                return;
            }
            // 判断新旧节点是否是同一元素
            if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
                unmount(oldVNode);
                oldVNode = null;
            }
            var type = newVNode.type, shapeFlag = newVNode.shapeFlag;
            switch (type) {
                case Text:
                    processText(oldVNode, newVNode, container, anchor);
                    break;
                case Comment:
                    processComment(oldVNode, newVNode, container, anchor);
                    break;
                case Fragment:
                    processFragment(oldVNode, newVNode, container, anchor);
                    break;
                default:
                    if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                        processElement(oldVNode, newVNode, container, anchor);
                    }
                    else if (shapeFlag & 6 /* ShapeFlags.COMPONENT */) {
                        // 组件挂载
                        processComponent(oldVNode, newVNode, container, anchor);
                    }
            }
        };
        var unmount = function (vnode) {
            hostRemove(vnode.el);
        };
        // 渲染：把vnode渲染到指定container下
        var render = function (vnode, container) {
            if (vnode === null) {
                // 卸载
                if (container._vnode) {
                    unmount(container._vnode);
                }
            }
            else {
                patch(container._vnode || null, vnode, container);
            }
            container._vnode = vnode;
        };
        // 移动节点到指定位置
        var move = function (vnode, container, anchor) {
            var el = vnode.el;
            hostInsert(el, container, anchor);
        };
        return {
            render: render,
        };
    }
    /**
     * 1.先拿到当前元素
     * 2.看当前元素是否比之前结果的最后一个大
     * 2.1 是，存储
     * 2.2 不是，用当前的替换刚才的（用二分查找实现）
     */
    // 获取最长递增子序列的下标
    function getSequence(arr) {
        // 生成arr的浅拷贝
        var p = arr.slice();
        // 最长递增子序列下标
        var result = [0]; // 暂时把第一项存入最后结果
        var i, j, u, v, c;
        for (i = 0; i < arr.length; i++) {
            // 拿到每一个元素
            var arrI = arr[i];
            // 这里不为零是因为会不停改变数组的值，0表示的是下标，不具备比较的意义
            if (arrI !== 0) {
                // j是目前拿到的最长递增子序列最后一项的值（即原数组中下标）
                j = result[result.length - 1];
                // 如果result中最后一项比当前元素值小，则应该把当前值存起来
                if (arr[j] < arrI) {
                    // result变化前，记录result更新前最后一个索引的值是多少
                    p[i] = j;
                    result.push(i);
                    continue;
                }
                // 针对result开始二分查找，目的是找到需要变更的result的下标
                u = 0;
                v = result.length - 1;
                while (u < v) {
                    // 平分，向下取整，拿到对比位置的中间位置（例如0和1拿到0）
                    c = (u + v) >> 1;
                    // 看当前中间位的arr值是否小于当前值，是的话，向右侧继续去比对
                    if (arr[result[c]] < arrI) {
                        u = c + 1;
                    }
                    // 如果不是，右侧缩窄到中间位置，再去做二分（说明右侧数字都比arrI大）
                    else {
                        v = c;
                    }
                }
                // 在result中，用更大值的下标，替换原来较小值的下标
                if (arrI < arr[result[u]]) {
                    if (u > 0) {
                        p[i] = result[u - 1];
                    }
                    result[u] = i;
                }
            }
        }
        // 回溯
        u = result.length;
        v = result[u - 1];
        while (u-- > 0) {
            result[u] = v;
            v = p[v];
        }
        return result;
    }

    var doc = document;
    var nodeOps = {
        insert: function (child, parent, anchor) {
            parent.insertBefore(child, anchor || null);
        },
        createElement: function (tag) {
            var el = doc.createElement(tag);
            return el;
        },
        setElementText: function (el, text) {
            el.textContent = text;
        },
        remove: function (child) {
            var parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        },
        createText: function (text) { return doc.createTextNode(text); },
        setText: function (node, text) { return (node.nodeValue = text); },
        createComment: function (text) { return doc.createComment(text); },
    };

    function patchClass(el, value) {
        if (value === null) {
            el.removeAttribute("class");
        }
        else {
            el.className = value;
        }
    }

    function patchDOMProp(el, key, value) {
        try {
            el[key] = value;
        }
        catch (err) {
            console.error(err);
        }
    }

    function patchAttr(el, key, value) {
        if (value == null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, value);
        }
    }

    function patchStyle(el, prev, next) {
        var style = el.style;
        var isCssString = isString(style);
        if (next && !isCssString) {
            // 新样式挂载
            for (var key in next) {
                setStyle(style, key, next[key]);
            }
            // 旧样式处理
            if (prev && !isString(prev)) {
                for (var key in prev) {
                    if (next[key] == null) {
                        setStyle(style, key, "");
                    }
                }
            }
        }
    }
    function setStyle(style, name, value) {
        style[name] = value;
    }

    function patchEvent(el, rawName, prevValue, nextValue) {
        var invokers = el._vei || (el._vei = {});
        var existingInvoker = invokers[rawName];
        if (nextValue && existingInvoker) {
            existingInvoker.value = nextValue;
        }
        else {
            var name_1 = parseName(rawName);
            if (nextValue) {
                var invoker = (invokers[rawName] = createInvoker(nextValue));
                el.addEventListener(name_1, invoker);
            }
            else if (existingInvoker) {
                el.removeEventListener(name_1, existingInvoker);
                invokers[rawName] = undefined;
            }
        }
    }
    function parseName(name) {
        return name.slice(2).toLowerCase();
    }
    function createInvoker(initialValue) {
        var invoker = function (e) {
            invoker.value && invoker.value();
        };
        invoker.value = initialValue;
        return invoker;
    }

    var patchProp = function (el, key, prevValue, nextValue) {
        if (key === "class") {
            patchClass(el, nextValue);
        }
        else if (key === "style") {
            patchStyle(el, prevValue, nextValue);
        }
        else if (isOn(key)) {
            patchEvent(el, key, prevValue, nextValue);
        }
        else if (shouldSetAsProp(el, key)) {
            patchDOMProp(el, key, nextValue);
        }
        else {
            patchAttr(el, key, nextValue);
        }
    };
    function shouldSetAsProp(el, key) {
        if (key === "form")
            return false;
        // input的list属性必须通过setAttribute设置
        if (key === "list" && el.tagName === "INPUT")
            return false;
        if (key === "type" && el.tagName === "TEXTAREA")
            return false;
        return key in el;
    }

    var rendererOptions = extend({ patchProp: patchProp }, nodeOps);
    var renderer;
    function ensureRenderer() {
        return renderer || (renderer = createRenderer(rendererOptions));
    }
    var render = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = ensureRenderer()).render.apply(_a, __spreadArray([], __read(args), false));
    };

    function createParserContext(content) {
        return {
            source: content,
        };
    }
    function createRoot(children) {
        return {
            type: 0 /* NodeTypes.ROOT */,
            children: children,
            loc: {},
        };
    }
    function baseParse(content) {
        var context = createParserContext(content);
        var children = parseChildren(context, []);
        return createRoot(children);
    }
    function parseChildren(context, ancestors) {
        var nodes = [];
        while (!isEnd(context, ancestors)) {
            var s = context.source;
            var node = void 0;
            if (startsWith(s, "{{")) {
                // 模板语法
                node = parseInterpolation(context);
            }
            else if (s[0] === "<") {
                // 可能是标签的开始
                if (/[a-z]/i.test(s[1])) {
                    // 确定是标签的开始
                    node = parseElement(context, ancestors);
                }
            }
            // 如果检测出来不是node节点，说明是文本，要做文本的处理
            if (!node) {
                node = parseText(context);
            }
            // 把当前处理好的节点push
            pushNode(nodes, node);
        }
        return nodes;
    }
    function parseInterpolation(context) {
        // 模板表达式以{{ XX }}格式呈现
        var _a = __read(["{{", "}}"], 2), open = _a[0], close = _a[1];
        advanceBy(context, open.length);
        var closeIndex = context.source.indexOf(close, open.length);
        var preTrimContext = parseTextData(context, closeIndex);
        var content = preTrimContext.trim();
        advanceBy(context, close.length);
        return {
            type: 5 /* NodeTypes.INTERPOLATION */,
            content: {
                type: 4 /* NodeTypes.SIMPLE_EXPRESSION */,
                isStatic: false,
                content: content,
            },
        };
    }
    function parseElement(context, ancestors) {
        // 解析标签的tag
        var element = parseTag(context, 0 /* TagType.Start */);
        // 处理子标签
        ancestors.push(element);
        var children = parseChildren(context, ancestors);
        // 因为ancestors仅限于isEnd判断逻辑，所以结束以后要pop出来
        ancestors.pop();
        element.children = children;
        // 结束标签
        if (startsWithEndTagOpen(context.source, element.tag)) {
            parseTag(context, 1 /* TagType.End */);
        }
        return element;
    }
    function advanceSpaces(context) {
        var match = /^[\t\r\n\f ]+/.exec(context.source);
        if (match) {
            advanceBy(context, match[0].length);
        }
    }
    function parseAttributes(context, type) {
        var props = [];
        // 属性名的存放
        var attributeNames = new Set();
        // 当源码长度不为0，且剩下的内容不是标签结束的时候，说明还有属性，要循环处理
        while (context.source.length > 0 &&
            !startsWith(context.source, ">") &&
            !startsWith(context.source, "/>")) {
            var attr = parseAttribute(context, attributeNames);
            // 只有是开始标签，才去存放属性
            if (type === 0 /* TagType.Start */) {
                props.push(attr);
            }
            // 两个属性之间有空格，要右移到下一个属性/结尾位置
            advanceSpaces(context);
        }
        return props;
    }
    function parseAttribute(context, nameSet) {
        // 拿到属性名
        var match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source);
        var name = match[0];
        nameSet.add(name);
        // 右移继续准备拿到属性值
        advanceBy(context, name.length);
        var value = undefined;
        // 如果能有=出现，后面就是属性值了
        if (/^[^\t\r\n\f ]*=/.test(context.source)) {
            advanceSpaces(context);
            advanceBy(context, 1);
            advanceSpaces(context);
            // 获取属性值
            value = parseAttributeValue(context);
        }
        // v-指令处理
        if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
            // 拿到v-指令的名字（例如if/for等等）
            var match_1 = /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(name);
            var dirName = match_1[1];
            return {
                type: 7 /* NodeTypes.DIRECTIVE */,
                name: dirName,
                // 指令绑定的值
                exp: value && {
                    type: 4 /* NodeTypes.SIMPLE_EXPRESSION */,
                    content: value.content,
                    isStatic: false,
                    loc: {},
                },
                art: undefined,
                modifiers: undefined,
                loc: {},
            };
        }
        // 普通属性处理
        return {
            type: 6 /* NodeTypes.ATTRIBUTE */,
            name: name,
            value: value && {
                type: 2 /* NodeTypes.TEXT */,
                content: value.content,
                loc: {},
            },
            loc: {},
        };
    }
    // 单个属性值的处理
    function parseAttributeValue(context) {
        // 属性内容
        var content = "";
        // 第一位是引号（单双不确定，所以要拿到它，后面对应去匹配）
        var quote = context.source[0];
        var isQuoted = quote === "\"" || quote === "'";
        if (isQuoted) {
            // 右移引号宽度
            advanceBy(context, 1);
            var endIndex = context.source.indexOf(quote);
            // 没有找到结束引号，则后面内容都是属性值
            if (endIndex === -1) {
                content = parseTextData(context, context.source.length);
            }
            else {
                content = parseTextData(context, endIndex);
                // 右移引号宽度
                advanceBy(context, 1);
            }
        }
        return { content: content, isQuoted: isQuoted, loc: {} };
    }
    function parseText(context) {
        // 如果遇到下方的，表示普通文本的结束
        var endTokens = ["<", "{{"];
        // 临时用context的结尾当text的结尾，后面修正正确的结尾位置
        var endIndex = context.source.length;
        // 自后向前比对，找到正确的text结尾位置
        for (var i = 0; i < endTokens.length; i++) {
            var index = context.source.indexOf(endTokens[i], 1);
            if (index !== -1 && endIndex > index) {
                endIndex = index;
            }
        }
        var content = parseTextData(context, endIndex);
        return {
            type: 2 /* NodeTypes.TEXT */,
            content: content,
        };
    }
    // 拿到文本数据，并把源代码光标右移
    function parseTextData(context, length) {
        var rawText = context.source.slice(0, length);
        advanceBy(context, length);
        return rawText;
    }
    function parseTag(context, type) {
        // type用来看后续位移长度
        var match = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source);
        var tag = match[1];
        // 根据tag的名称长度，右移source位置（<+tag名字）
        advanceBy(context, match[0].length);
        // 属性和指令的处理
        advanceSpaces(context);
        var props = parseAttributes(context, type);
        // 判断是否为自闭合标签：是的话右移2，否则右移1
        var isSelfClosing = startsWith(context.source, "/>");
        advanceBy(context, isSelfClosing ? 2 : 1);
        var tagType = 0 /* ElementTypes.ELEMENT */;
        return {
            // 标记当前是element节点
            type: 1 /* NodeTypes.ELEMENT */,
            tag: tag,
            tagType: tagType,
            props: props,
            children: [],
        };
    }
    function pushNode(nodes, node) {
        nodes.push(node);
    }
    // 判断当前标签是否为结束标签
    function isEnd(context, ancestors) {
        var s = context.source;
        if (startsWith(s, "</")) {
            for (var i = ancestors.length - 1; i >= 0; i--) {
                if (startsWithEndTagOpen(s, ancestors[i].tag)) {
                    return true;
                }
            }
        }
        return !s;
    }
    // 判断是否为结束标签的开始（例如</div，这一段完整的才是结束标签的开始）
    function startsWithEndTagOpen(source, tag) {
        /**
         * 三个条件
         * 1.以</开头
         * 2.从2-tag结束为止截出来的内容，和给的tag一样（确定了同名tag）
         * 3.后面要紧跟有效的结束内容，而不是继续有其他一些文字
         */
        return (startsWith(source, "</") &&
            source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
            /[\t\r\n\f />]/.test(source[2 + tag.length] || ">"));
    }
    function startsWith(source, searchString) {
        return source.startsWith(searchString);
    }
    function advanceBy(context, numberOfCharacters) {
        var source = context.source;
        context.source = source.slice(numberOfCharacters);
    }

    function isSingleElementRoot(root, child) {
        var children = root.children;
        return children.length === 1 && child.type === 1 /* NodeTypes.ELEMENT */;
    }

    var _a;
    var CREATE_ELEMENT_VNODE = Symbol("createElementVNode");
    var CREATE_VNODE = Symbol("createVNode");
    var TO_DISPLAY_STRING = Symbol("toDisplayString");
    var CREATE_COMMENT = Symbol("createCommentVNode");
    var helperNameMap = (_a = {},
        _a[CREATE_ELEMENT_VNODE] = "createElementVNode",
        _a[CREATE_VNODE] = "createVNode",
        _a[TO_DISPLAY_STRING] = "toDisplayString",
        _a[CREATE_COMMENT] = "createCommentVNode",
        _a);

    // 创建一个全局通用的上下文对象
    function createTransformContext(root, _a) {
        var _b = _a.nodeTransforms, nodeTransforms = _b === void 0 ? [] : _b;
        var context = {
            nodeTransforms: nodeTransforms,
            root: root,
            helpers: new Map(),
            currentNode: root,
            parent: null,
            childIndex: 0,
            helper: function (name) {
                var count = context.helpers.get(name) || 0;
                context.helpers.set(name, count + 1);
                return name;
            },
            replaceNode: function (node) {
                context.parent.children[context.childIndex] = context.currentNode = node;
            },
        };
        return context;
    }
    function transform(root, options) {
        var context = createTransformContext(root, options);
        traverseNode(root, context);
        createRootCodegen(root);
        root.helpers = __spreadArray([], __read(context.helpers.keys()), false);
        root.components = [];
        root.directives = [];
        root.imports = [];
        root.hoists = [];
        root.temps = [];
        root.cached = [];
    }
    function traverseNode(node, context) {
        context.currentNode = node;
        var nodeTransforms = context.nodeTransforms;
        var exitFns = [];
        for (var i_1 = 0; i_1 < nodeTransforms.length; i_1++) {
            var onExit = nodeTransforms[i_1](node, context);
            if (onExit) {
                if (isArray(onExit)) {
                    exitFns.push.apply(exitFns, __spreadArray([], __read(onExit), false));
                }
                else {
                    exitFns.push(onExit);
                }
            }
            if (!context.currentNode) {
                return;
            }
            else {
                node = context.currentNode;
            }
        }
        switch (node.type) {
            // 处理子节点
            case 10 /* NodeTypes.IF_BRANCH */:
            case 1 /* NodeTypes.ELEMENT */:
            case 0 /* NodeTypes.ROOT */:
                traverseChildren(node, context);
                break;
            case 5 /* NodeTypes.INTERPOLATION */:
                context.helper(TO_DISPLAY_STRING);
                break;
            case 9 /* NodeTypes.IF */:
                for (var i_2 = 0; i_2 < node.branches.length; i_2++) {
                    traverseNode(node.branches[i_2], context);
                }
                break;
        }
        // 退出阶段，倒序出
        context.currentNode = node;
        var i = exitFns.length;
        while (i--) {
            exitFns[i]();
        }
    }
    function traverseChildren(parent, context) {
        parent.children.forEach(function (node, index) {
            context.parent = parent;
            context.childIndex = index;
            traverseNode(node, context);
        });
    }
    function createRootCodegen(root) {
        var children = root.children;
        // Vue2只支持单个根节点，Vue3支持多个，这里只写了处理单个的
        if (children.length === 1) {
            var child = children[0];
            if (isSingleElementRoot(root, child) && child.codegenNode) {
                root.codegenNode = child.codegenNode;
            }
        }
    }
    // 针对指令的处理
    // name是指令名字
    // fn是指令的具体处理方法，通常是闭包函数
    // 返回闭包函数，就是指令对应的处理函数
    function createStructuralDirectiveTransform(name, fn) {
        // 检测指令是否匹配
        var matches = isString(name)
            ? function (n) { return n === name; }
            : function (n) { return name.test(n); };
        return function (node, context) {
            // 因为所有的指令都绑定在ELEMENT节点上，所以只处理ELEMENT节点
            if (node.type === 1 /* NodeTypes.ELEMENT */) {
                var props = node.props;
                var exitFns = [];
                // 因为指令实际存在属性中，因此遍历属性，找到其中的指令
                for (var i = 0; i < props.length; i++) {
                    var prop = props[i];
                    if (prop.type === 7 /* NodeTypes.DIRECTIVE */ && matches(prop.name)) {
                        // 删除这个属性（因为它本来就不是属性，而是因为位置在属性上）
                        props.splice(i, 1);
                        i--;
                        // 执行传入的方法，当有返回值的时候，推入这个exitFns列表
                        var onExit = fn(node, prop, context);
                        if (onExit)
                            exitFns.push(onExit);
                    }
                }
                return exitFns;
            }
        };
    }

    function isText(node) {
        return [5 /* NodeTypes.INTERPOLATION */, 2 /* NodeTypes.TEXT */].includes(node.type);
    }
    function getVNodeHelper(ssr, isComponent) {
        return ssr || isComponent ? CREATE_VNODE : CREATE_ELEMENT_VNODE;
    }
    function getMemoedVNodeCall(node) {
        return node;
    }

    var aliasHelper = function (s) { return "".concat(helperNameMap[s], ": _").concat(helperNameMap[s]); };
    function createCodegenContext(ast) {
        var context = {
            // render函数代码字符串
            code: "",
            // 运行时全局变量名
            runtimeGlobalName: "Vue",
            source: ast.loc.source,
            indentLevel: 0,
            isSSR: false,
            helper: function (key) {
                return "_".concat(helperNameMap[key]);
            },
            push: function (code) {
                context.code += code;
            },
            newline: function () {
                newline(context.indentLevel);
            },
            indent: function () {
                newline(++context.indentLevel);
            },
            deindent: function () {
                newline(--context.indentLevel);
            },
        };
        function newline(n) {
            context.code += "\n" + "  ".repeat(n);
        }
        return context;
    }
    function generate(ast) {
        var context = createCodegenContext(ast);
        var push = context.push, newline = context.newline, indent = context.indent, deindent = context.deindent;
        genFunctionPreamble(context);
        var functionName = "render";
        var args = ["_ctx", "_cache"];
        var signature = args.join(", ");
        push("function ".concat(functionName, "(").concat(signature, ") {"));
        indent();
        push("with (_ctx) {");
        indent();
        var hasHelpers = ast.helpers.length > 0;
        if (hasHelpers) {
            push("const { ".concat(ast.helpers.map(aliasHelper).join(", "), " } = _Vue"));
            push("\n");
            newline();
        }
        newline();
        push("return ");
        if (ast.codegenNode) {
            genNode(ast.codegenNode, context);
        }
        else {
            push("null");
        }
        deindent();
        push("}");
        deindent();
        push("}");
        return {
            ast: ast,
            code: context.code,
        };
    }
    function genFunctionPreamble(context) {
        var push = context.push, runtimeGlobalName = context.runtimeGlobalName, newline = context.newline;
        var VueBinding = runtimeGlobalName;
        push("const _Vue = ".concat(VueBinding, "\n"));
        newline();
        push("return ");
    }
    function genNode(node, context) {
        switch (node.type) {
            case 1 /* NodeTypes.ELEMENT */:
            case 9 /* NodeTypes.IF */:
                genNode(node.codegenNode, context);
                break;
            case 13 /* NodeTypes.VNODE_CALL */:
                genVNodeCall(node, context);
                break;
            case 2 /* NodeTypes.TEXT */:
                genText(node, context);
                break;
            // 简单表达式
            case 4 /* NodeTypes.SIMPLE_EXPRESSION */:
                genExpression(node, context);
                break;
            // 插值表达式
            case 5 /* NodeTypes.INTERPOLATION */:
                genInterpolation(node, context);
                break;
            // 复合表达式（即简单+插值）
            case 8 /* NodeTypes.COMPOUND_EXPRESSION */:
                genCompoundExpression(node, context);
                break;
            // JS调用表达式（用来渲染v-if为false时候的内容）
            case 14 /* NodeTypes.JS_CALL_EXPRESSION */:
                genCallExpression(node, context);
                break;
            // JS的条件表达式（用来渲染三元表达式）
            case 19 /* NodeTypes.JS_CONDITIONAL_EXPRESSION */:
                genConditionalExpression(node, context);
                break;
        }
    }
    function genCallExpression(node, context) {
        var push = context.push, helper = context.helper;
        var callee = isString(node.callee) ? node.callee : helper(node.callee);
        push(callee + "(", node);
        genNodeList(node.arguments, context);
        push(")");
    }
    function genConditionalExpression(node, context) {
        var test = node.test, alternate = node.alternate, consequent = node.consequent, needNewLine = node.newline;
        var push = context.push, newline = context.newline, indent = context.indent, deindent = context.deindent;
        // 添加v-if的条件值
        if (test.type === 4 /* NodeTypes.SIMPLE_EXPRESSION */) {
            genExpression(test, context);
        }
        needNewLine && indent();
        context.indentLevel++;
        // 问号
        needNewLine || push(" ");
        push("? ");
        // v-if为true的时候的展示内容
        genNode(consequent, context);
        context.indentLevel--;
        needNewLine && newline();
        needNewLine || push(" ");
        push(": ");
        var isNested = alternate.type === 19 /* NodeTypes.JS_CONDITIONAL_EXPRESSION */;
        if (!isNested) {
            context.indentLevel++;
        }
        // v-if为false的时候的处理内容（渲染v-if的注释节点）
        genNode(alternate, context);
        if (!isNested) {
            context.indentLevel--;
        }
        needNewLine && deindent(true);
    }
    function genCompoundExpression(node, context) {
        for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            // +，直接推入
            if (isString(child)) {
                context.push(child);
            }
            // 文本/插值表达式的处理在genNode中，需要递归
            else {
                genNode(child, context);
            }
        }
    }
    function genExpression(node, context) {
        var content = node.content, isStatic = node.isStatic;
        context.push(isStatic ? JSON.stringify(content) : content);
    }
    function genInterpolation(node, context) {
        var push = context.push, helper = context.helper;
        push("".concat(helper(TO_DISPLAY_STRING), "("));
        genNode(node.content, context);
        push(")");
    }
    function genText(node, context) {
        context.push(JSON.stringify(node.content), node);
    }
    function genVNodeCall(node, context) {
        var push = context.push, helper = context.helper;
        var tag = node.tag, props = node.props, children = node.children, patchFlag = node.patchFlag, dynamicProps = node.dynamicProps; node.directives; node.isBlock; node.disableTracking; var isComponent = node.isComponent;
        var callHelper = getVNodeHelper(context.isSSR, isComponent);
        push(helper(callHelper) + "(");
        var args = genNullableArgs([tag, props, children, patchFlag, dynamicProps]);
        genNodeList(args, context);
        push(")");
    }
    function genNullableArgs(args) {
        var i = args.length;
        while (i--) {
            if (args[i] != null)
                break;
        }
        return args.slice(0, i + 1).map(function (arg) { return arg || "null"; });
    }
    function genNodeList(nodes, context) {
        var push = context.push; context.newline;
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (isString(node)) {
                push(node);
            }
            else if (isArray(node)) {
                genNodeListAsArray(node, context);
            }
            else {
                genNode(node, context);
            }
            if (i < nodes.length - 1) {
                push(", ");
            }
        }
    }
    function genNodeListAsArray(nodes, context) {
        context.push("[");
        genNodeList(nodes, context);
        context.push("]");
    }

    function createVNodeCall(context, tag, props, children) {
        if (context) {
            // 最后触发的render函数中调用方法的名字
            context.helper(CREATE_ELEMENT_VNODE);
        }
        return {
            type: 13 /* NodeTypes.VNODE_CALL */,
            tag: tag,
            props: props,
            children: children,
        };
    }
    // TODO: 创建一个条件表达式（四个参数的含义）
    function createConditionalExpression(test, consequent, alternate, newline) {
        if (newline === void 0) { newline = true; }
        return {
            type: 19 /* NodeTypes.JS_CONDITIONAL_EXPRESSION */,
            test: test,
            consequent: consequent,
            alternate: alternate,
            newline: newline,
            loc: {},
        };
    }
    // 创建一个简单的表达式节点
    function createSimpleExpression(content, isStatic) {
        return {
            type: 4 /* NodeTypes.SIMPLE_EXPRESSION */,
            loc: {},
            content: content,
            isStatic: isStatic,
        };
    }
    // 创建一个JS属性的对象
    function createObjectProperty(key, value) {
        return {
            type: 16 /* NodeTypes.JS_PROPERTY */,
            loc: {},
            key: isString(key) ? createSimpleExpression(key, true) : key,
            value: value,
        };
    }
    function createCallExpression(callee, args) {
        return {
            type: 14 /* NodeTypes.JS_CALL_EXPRESSION */,
            loc: {},
            callee: callee,
            arguments: args,
        };
    }

    var transformElement = function (node, context) {
        return function postTransformElement() {
            node = context.currentNode;
            // 只有ELEMENT节点才能执行后续逻辑
            if (node.type !== 1 /* NodeTypes.ELEMENT */) {
                return;
            }
            var tag = node.tag;
            var vnodeTag = "\"".concat(tag, "\"");
            var vnodeProps = [];
            var vnodeChildren = node.children;
            node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren);
        };
    };

    // 把相邻的文本节点和表达式合并成一个表达式
    // 例如 hello {{ msg }}
    // 需要拼接成 hello + _toDisplayString(_ctx.msg)
    var transformText = function (node, context) {
        if ([
            0 /* NodeTypes.ROOT */,
            1 /* NodeTypes.ELEMENT */,
            11 /* NodeTypes.FOR */,
            10 /* NodeTypes.IF_BRANCH */,
        ].includes(node.type)) {
            return function () {
                var children = node.children;
                var currentContainer;
                // 遍历所有子节点
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    if (isText(child)) {
                        // 从当前节点的后一个开始遍历
                        for (var j = i + 1; j < children.length; j++) {
                            var next = children[j];
                            // 如果紧接着的节点也是文本节点，要把两个节点合并起来
                            if (isText(next)) {
                                // 还没有容器的时候，创建一个复合表达式节点
                                if (!currentContainer) {
                                    currentContainer = children[i] = createCompoundExpression([child], child.loc);
                                }
                                // 把之前的内容和当前的合并
                                currentContainer.children.push(" + ", next);
                                // 处理好了下一个child，把下一个child删了，光标左移
                                children.splice(j, 1);
                                j--;
                            }
                            else {
                                // 紧接着的节点不是文本节点，不需要合并
                                currentContainer = undefined;
                                break;
                            }
                        }
                    }
                }
            };
        }
    };
    function createCompoundExpression(children, loc) {
        return {
            type: 8 /* NodeTypes.COMPOUND_EXPRESSION */,
            loc: loc,
            children: children,
        };
    }

    // 实际的if的transform方法
    // 第一个参数是判断条件，即v-后面是if/else/else-if
    // 第二个参数是执行的函数，即onExit
    var transformIf = createStructuralDirectiveTransform(/^(if|else|else-if)$/, 
    // 第一个参数是node自己
    // 第二个参数实际上是prop属性
    // 第三个参数是上下文
    // 第四个参数是一个匿名函数，真实目的是往这个ifNode上面创建codegenNode属性
    function (node, dir, context) {
        return processIf(node, dir, context, function (ifNode, branch, isRoot) {
            var key = 0;
            return function () {
                if (isRoot) {
                    ifNode.codegenNode = createCodegenNodeForBranch(branch, key, context);
                }
            };
        });
    });
    // 真实处理if指令的部分
    function processIf(node, dir, context, processCodegen) {
        // 只有if指令才处理
        if (dir.name === "if") {
            // 创建一个branch属性
            var branch = createIfBranch(node, dir);
            var ifNode = {
                type: 9 /* NodeTypes.IF */,
                loc: {},
                branches: [branch],
            };
            // 上下文指向的node改成当前的ifNode
            context.replaceNode(ifNode);
            if (processCodegen) {
                return processCodegen(ifNode, branch, true);
            }
        }
    }
    function createIfBranch(node, dir) {
        return {
            type: 10 /* NodeTypes.IF_BRANCH */,
            loc: {},
            condition: dir.exp,
            children: [node],
        };
    }
    // 对if分支创建codegenNode属性
    function createCodegenNodeForBranch(branch, keyIndex, context) {
        // 如果v-if后面有条件，要根据条件创建三元表达式
        if (branch.condition) {
            return createConditionalExpression(branch.condition, createChildrenCodegenNode(branch, keyIndex), createCallExpression(context.helper(CREATE_COMMENT), ['"v-if"', "true"]));
        }
        // 没有条件，则只针对子节点创建codegenNode
        else {
            return createChildrenCodegenNode(branch, keyIndex);
        }
    }
    // 创建指定子节点的codegen
    // key都是0
    function createChildrenCodegenNode(branch, keyIndex) {
        var keyProperty = createObjectProperty("key", createSimpleExpression("".concat(keyIndex), false));
        var children = branch.children;
        var firstChild = children[0];
        var ret = firstChild.codegenNode;
        // 这个vnodeCall这里比较简单，就是node本身
        var vnodeCall = getMemoedVNodeCall(ret);
        injectProp(vnodeCall, keyProperty);
        return ret;
    }
    // 把属性注入到node的props中
    function injectProp(node, prop) {
        var propsWithInjection;
        var props = node.type === 13 /* NodeTypes.VNODE_CALL */ ? node.props : node.arguments[2];
        if (props == null || isString(props)) {
            propsWithInjection = createObjectExpression([prop]);
        }
        if (node.type === 13 /* NodeTypes.VNODE_CALL */) {
            node.props = propsWithInjection;
        }
    }
    function createObjectExpression(properties) {
        return {
            type: 15 /* NodeTypes.JS_OBJECT_EXPRESSION */,
            loc: {},
            properties: properties,
        };
    }

    function baseCompile(template, options) {
        if (options === void 0) { options = {}; }
        var ast = baseParse(template);
        transform(ast, extend(options, {
            nodeTransforms: [transformElement, transformText, transformIf],
        }));
        return generate(ast);
    }

    function compile(template, options) {
        return baseCompile(template, options);
    }

    function compileToFunction(template, options) {
        var code = compile(template, options).code;
        var render = new Function(code)();
        return render;
    }

    exports.Comment = Comment;
    exports.Fragment = Fragment;
    exports.Text = Text;
    exports.compile = compileToFunction;
    exports.computed = computed;
    exports.createCommentVNode = createCommentVNode;
    exports.createElementVNode = createVNode;
    exports.effect = effect;
    exports.h = h;
    exports.queuePreFlushCb = queuePreFlushCb;
    exports.reactive = reactive;
    exports.ref = ref;
    exports.render = render;
    exports.toDisplayString = toDisplayString;
    exports.watch = watch;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map
