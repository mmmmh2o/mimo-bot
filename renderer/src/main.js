import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'

// 路由
const routes = [
  { path: '/', name: 'Dashboard', component: () => import('./views/Dashboard.vue') },
  { path: '/flows', name: 'Flows', component: () => import('./views/FlowEditor.vue') },
  { path: '/variables', name: 'Variables', component: () => import('./views/Variables.vue') },
  { path: '/database', name: 'Database', component: () => import('./views/Database.vue') },
  { path: '/logs', name: 'Logs', component: () => import('./views/Logs.vue') },
  { path: '/settings', name: 'Settings', component: () => import('./views/Settings.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
