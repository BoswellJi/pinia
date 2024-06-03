import { Pinia, PiniaPlugin, setActivePinia, piniaSymbol } from './rootStore'
import { ref, App, markRaw, effectScope, isVue2, Ref } from 'vue-demi'
import { registerPiniaDevtools, devtoolsPlugin } from './devtools'
import { IS_CLIENT } from './env'
import { StateTree, StoreGeneric } from './types'

/**
 * 创建给应用使用的Pinia实例
 * Creates a Pinia instance to be used by the application
 */
export function createPinia(): Pinia {
  const scope = effectScope(true)
  // 注意：是否vue3 ssr有类似的东西，这里我们检查一个状态的window对象并且直接设置它
  // NOTE: here we could check the window object for a state and directly set it
  // if there is anything like it with Vue 3 SSR
  const state = scope.run<Ref<Record<string, StateTree>>>(() =>
    ref<Record<string, StateTree>>({})
  )!

  let _p: Pinia['_p'] = []
  // 插件再调用app.use(pinia)之前添加
  // plugins added before calling app.use(pinia)
  let toBeInstalled: PiniaPlugin[] = []

  const pinia: Pinia = markRaw({
    // 将pinia安装给vue应用
    install(app: App) {
      // 安装pinia的插件后，允许在组件setup之外调用useStore方法
      // this allows calling useStore() outside of a component setup after
      // installing pinia's plugin
      setActivePinia(pinia)
      // vue3处理
      if (!isVue2) {
        // vue应用实例
        pinia._a = app
        // 注册pinia实例
        app.provide(piniaSymbol, pinia)
        // 将pinia实例添加到vue应用的全局属性上`$pinia`
        app.config.globalProperties.$pinia = pinia
        /* istanbul ignore else */
        if (__USE_DEVTOOLS__ && IS_CLIENT) {
          registerPiniaDevtools(app, pinia)
        }
        // 保存pinia插件
        toBeInstalled.forEach((plugin) => _p.push(plugin))
        // 清空插件
        toBeInstalled = []
      }
    },
    // pinia自身是否存在插件
    use(plugin) {
      if (!this._a && !isVue2) {
        toBeInstalled.push(plugin)
      } else {
        _p.push(plugin)
      }
      return this
    },
    // pinia的插件容器
    _p,
    // it's actually undefined here
    // @ts-expect-error 当前app实例
    _a: null,
    // 副效果作用域
    _e: scope,
    // store容器
    _s: new Map<string, StoreGeneric>(),
    // 响应式 ref({}) 中存储每个store的state
    state,
  })

  // pinia devtools rely on dev only features so they cannot be forced unless
  // the dev build of Vue is used. Avoid old browsers like IE11.
  if (__USE_DEVTOOLS__ && typeof Proxy !== 'undefined') {
    pinia.use(devtoolsPlugin)
  }

  return pinia
}

/**
 * Dispose a Pinia instance by stopping its effectScope and removing the state, plugins and stores. This is mostly
 * useful in tests, with both a testing pinia or a regular pinia and in applications that use multiple pinia instances.
 * Once disposed, the pinia instance cannot be used anymore.
 *
 * @param pinia - pinia instance
 */
export function disposePinia(pinia: Pinia) {
  pinia._e.stop()
  pinia._s.clear()
  pinia._p.splice(0)
  pinia.state.value = {}
  // @ts-expect-error: non valid
  pinia._a = null
}
